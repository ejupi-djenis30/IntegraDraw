import { afterEach, describe, expect, it } from "vitest";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  assembleReleaseBundle,
  buildFileInventory,
  checksumText,
  compareReleaseBundles,
  createDeterministicZip,
  normalizeCycloneDx,
  normalizeJavaDependencyEvidence,
  normalizeWebDependencyEvidence,
  parseChangelogSections,
  parseChecksumText,
  publishRelease,
  readZipEntriesFromBuffer,
  repositoryRoot,
  validateCycloneDx,
  validateDependencyEvidenceAgainstSbom,
  validateExecutableJar,
  validateReleaseBundle,
  validateStaticWebArchive,
  validateVersionTexts,
  verifyRemoteAssetInventory,
} from "./release-core.mjs";

const version = "1.1.0";
const releaseDate = "2026-07-19";
const sourceCommit = "0123456789abcdef0123456789abcdef01234567";
const metadata = {
  version,
  releaseDate,
  outputTimestamp: `${releaseDate}T00:00:00Z`,
  sourceDateEpoch: Math.floor(Date.parse(`${releaseDate}T00:00:00Z`) / 1000),
};
const temporaryDirectories = [];

async function temporaryDirectory(label = "integradraw-release-") {
  const directory = await mkdtemp(join(tmpdir(), label));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixture(root, relativePath, contents) {
  const file = join(root, ...relativePath.split("/"));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
  return file;
}

function changelog(releaseVersion = version, date = releaseDate) {
  return `# Changelog

## Unreleased

- No unreleased changes.

## ${releaseVersion} — ${date}

- Added verified releases.
`;
}

function versionFixture(overrides = {}) {
  return {
    pom: `<project><groupId>com.planck</groupId><artifactId>integradraw</artifactId><version>${version}</version><properties><project.build.outputTimestamp>${releaseDate}T00:00:00Z</project.build.outputTimestamp></properties></project>`,
    packageJson: JSON.stringify({ name: "integradraw-web", version }),
    packageLockJson: JSON.stringify({ version, packages: { "": { version } } }),
    changelog: changelog(),
    ...overrides,
  };
}

function minimalBom(platform, dependencyRef = `${platform}:dependency`) {
  const root =
    platform === "java"
      ? {
          "bom-ref": `pkg:maven/com.planck/integradraw@${version}?type=jar`,
          type: "application",
          group: "com.planck",
          name: "integradraw",
          version,
        }
      : {
          "bom-ref": `integradraw-web@${version}`,
          type: "application",
          name: "integradraw-web",
          version,
        };
  const dependency = {
    "bom-ref": dependencyRef,
    type: "library",
    name: "dependency",
    version: "1.0.0",
  };
  if (platform === "java") dependency.group = "example";
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: { component: root },
    components: [dependency],
    dependencies: [
      { ref: root["bom-ref"], dependsOn: [dependencyRef] },
      { ref: dependencyRef, dependsOn: [] },
    ],
  };
}

async function createJar(root, manifest = undefined) {
  const input = join(root, "jar-input");
  await writeFixture(
    input,
    "META-INF/MANIFEST.MF",
    manifest ??
      `Manifest-Version: 1.0\r\nMain-Class: com.planck.Main\r\nImplementation-Title: IntegraDraw\r\nImplementation-Version: ${version}\r\n\r\n`,
  );
  await writeFixture(input, "com/planck/Main.class", Buffer.from([0xca, 0xfe, 0xba, 0xbe]));
  const output = join(root, `integradraw-${version}.jar`);
  await createDeterministicZip({ inputDirectory: input, outputFile: output, releaseDate });
  return output;
}

async function createWebArchive(root) {
  const input = join(root, "web-input");
  await writeFixture(
    input,
    "index.html",
    '<script type="module" src="/IntegraDraw/assets/app.js"></script><link rel="stylesheet" href="/IntegraDraw/assets/app.css">',
  );
  for (const file of [
    "brand-mark.svg",
    "favicon.svg",
    "poster.svg",
    "social-preview.png",
    "integradraw-demo.mp4",
    "assets/app.js",
    "assets/app.css",
  ]) {
    await writeFixture(input, file, Buffer.from(`fixture:${file}`));
  }
  const output = join(root, `integradraw-web-${version}.zip`);
  await createDeterministicZip({ inputDirectory: input, outputFile: output, releaseDate });
  return { input, output };
}

async function createBundle() {
  const root = await temporaryDirectory();
  const jar = await createJar(root);
  const { output: webArchive } = await createWebArchive(root);
  const projectJar = await writeFixture(root, `target/integradraw-${version}.jar`, await readFile(jar));
  expect(projectJar).toContain(`integradraw-${version}.jar`);
  const javaSbom = await writeFixture(
    root,
    "inputs/java.cdx.json",
    normalizeCycloneDx(minimalBom("java"), { platform: "java", version }),
  );
  const webSbom = await writeFixture(
    root,
    "inputs/web.cdx.json",
    normalizeCycloneDx(minimalBom("web"), { platform: "web", version }),
  );
  const javaDependencies = await writeFixture(
    root,
    "inputs/java-dependencies.txt",
    normalizeJavaDependencyEvidence(
      `com.planck:integradraw:jar:${version}\n\\- example:dependency:jar:1.0.0:runtime\n`,
      version,
    ),
  );
  const webDependencies = await writeFixture(
    root,
    "inputs/web-dependencies.json",
    normalizeWebDependencyEvidence(
      { name: "integradraw-web", version, dependencies: { dependency: { version: "1.0.0" } } },
      version,
    ),
  );
  const output = join(root, "release");
  await assembleReleaseBundle({
    root,
    outputDirectory: output,
    sourceCommit,
    metadata,
    webArchive,
    javaSbom,
    webSbom,
    javaDependencies,
    webDependencies,
  });
  return { root, output };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function successfulResult(body = "") {
  return { status: 0, stdout: typeof body === "string" ? body : JSON.stringify(body), stderr: "" };
}

function failedResult(message) {
  return { status: 1, stdout: "", stderr: message };
}

function mutationCalls(api) {
  return api.calls.filter((call) => {
    if (call[1] === "release") return true;
    const methodIndex = call.indexOf("--method");
    return methodIndex !== -1 && ["POST", "PATCH", "DELETE"].includes(call[methodIndex + 1]);
  });
}

function requestField(args, name) {
  const value = args.find((argument) => typeof argument === "string" && argument.startsWith(`${name}=`));
  return value?.slice(name.length + 1);
}

class FakeGitHubReleaseApi {
  constructor(inventory, options = {}) {
    this.inventory = inventory;
    this.calls = [];
    this.release = null;
    this.nextReleaseId = 42;
    this.defaultCommit = options.defaultCommit ?? sourceCommit;
    this.tagCommit = options.tagCommit ?? sourceCommit;
    this.contained = options.contained ?? true;
    this.publishedImmutable = options.publishedImmutable ?? true;
    this.failUpload = options.failUpload ?? false;
    this.mismatchUpload = options.mismatchUpload ?? false;
    this.ambiguousPublish = options.ambiguousPublish ?? false;
    this.paginateDrafts = options.paginateDrafts ?? false;
    this.duplicateRelease = options.duplicateRelease ?? false;
  }

  result = (command, args) => {
    expect(command).toBe("gh");
    this.calls.push([command, ...args]);
    if (args[0] === "release" && args[1] === "upload") return this.upload();
    expect(args[0]).toBe("api");
    const endpoint = args[1];
    const methodIndex = args.indexOf("--method");
    const method = methodIndex === -1 ? "GET" : args[methodIndex + 1];
    return this.api(endpoint, method, args);
  };

  api(endpoint, method, args) {
    if (endpoint.startsWith("repos/owner/repository/releases?")) {
      const page = Number(new URL(`https://example.test/?${endpoint.split("?")[1]}`).searchParams.get("page"));
      if (this.paginateDrafts && page === 1) {
        return successfulResult(Array.from({ length: 100 }, (_, index) => ({ tag_name: `v0.0.${index}` })));
      }
      const releases = this.release ? [this.release] : [];
      if (this.duplicateRelease && this.release) releases.push(structuredClone(this.release));
      return successfulResult(releases);
    }
    if (endpoint === "repos/owner/repository") {
      return successfulResult({ default_branch: "master" });
    }
    if (endpoint === `repos/owner/repository/git/ref/tags/v${version}`) {
      return successfulResult({ object: { type: "commit", sha: this.tagCommit } });
    }
    if (endpoint === "repos/owner/repository/git/ref/heads/master") {
      return successfulResult({ object: { type: "commit", sha: this.defaultCommit } });
    }
    if (endpoint === `repos/owner/repository/compare/${sourceCommit}...${this.defaultCommit}`) {
      return successfulResult({
        status: this.contained ? (this.defaultCommit === sourceCommit ? "identical" : "ahead") : "diverged",
        merge_base_commit: { sha: this.contained ? sourceCommit : "f".repeat(40) },
      });
    }
    if (endpoint === "repos/owner/repository/releases" && method === "POST") {
      this.release = {
        id: this.nextReleaseId,
        tag_name: requestField(args, "tag_name"),
        target_commitish: requestField(args, "target_commitish"),
        name: requestField(args, "name"),
        body: requestField(args, "body"),
        draft: true,
        prerelease: false,
        immutable: false,
        upload_url: `https://uploads.github.com/repos/owner/repository/releases/${this.nextReleaseId}/assets{?name,label}`,
        assets: [],
      };
      return successfulResult(this.release);
    }
    if (endpoint === `repos/owner/repository/releases/${this.nextReleaseId}` && method === "GET") {
      return successfulResult(this.release);
    }
    if (endpoint.startsWith("repos/owner/repository/releases/assets/") && method === "DELETE") {
      const id = Number(endpoint.split("/").at(-1));
      this.release.assets = this.release.assets.filter((asset) => asset.id !== id);
      return successfulResult();
    }
    if (endpoint === `repos/owner/repository/releases/${this.nextReleaseId}` && method === "PATCH") {
      this.release.draft = false;
      this.release.immutable = this.publishedImmutable;
      if (this.ambiguousPublish) return failedResult("connection closed after publication");
      return successfulResult(this.release);
    }
    if (endpoint === "repos/owner/repository/releases/latest") {
      return successfulResult({ id: this.release.id, tag_name: this.release.tag_name });
    }
    throw new Error(`Unexpected fake GitHub request: ${method} ${endpoint}`);
  }

  upload() {
    const assets = this.inventory.map((asset, index) => ({
      ...asset,
      id: 100 + index,
      state: "uploaded",
    }));
    if (this.mismatchUpload) assets[0].digest = `sha256:${"0".repeat(64)}`;
    if (this.failUpload) {
      this.release.assets = assets.slice(0, 1);
      return failedResult("upload interrupted");
    }
    this.release.assets = assets;
    return successfulResult();
  }
}

async function publishWithFake(output, api, overrides = {}) {
  return publishRelease({
    directory: output,
    tag: `v${version}`,
    repository: "owner/repository",
    metadata,
    sourceCommit,
    eventName: "push",
    refType: "tag",
    publicationAuthorized: true,
    runProcess: api.result,
    pause: async () => {},
    ...overrides,
  });
}

describe("release metadata", () => {
  it("parses only visible Markdown release headings", () => {
    const markdown = `# Changelog
<!--
## 9.9.9 — 2026-01-01
-->
\`\`\`md
## 8.8.8 — 2026-01-01
\`\`\`
## Unreleased
## 1.1.0 — 2026-07-19
- Visible release note.
`;
    expect(parseChangelogSections(markdown).map(({ title }) => title)).toEqual([
      "Unreleased",
      "1.1.0 — 2026-07-19",
    ]);
    expect(validateVersionTexts({ ...versionFixture(), changelog: markdown })).toMatchObject({ version });
  });

  it("rejects prerelease and build-metadata versions", () => {
    for (const unstable of ["1.1.0-rc.1", "1.1.0+build.1"]) {
      expect(() =>
        validateVersionTexts({
          ...versionFixture(),
          pom: `<project><groupId>com.planck</groupId><artifactId>integradraw</artifactId><version>${unstable}</version><properties><project.build.outputTimestamp>${releaseDate}T00:00:00Z</project.build.outputTimestamp></properties></project>`,
          packageJson: JSON.stringify({ name: "integradraw-web", version: unstable }),
          packageLockJson: JSON.stringify({ version: unstable, packages: { "": { version: unstable } } }),
          changelog: changelog(unstable),
        }),
      ).toThrow("stable MAJOR.MINOR.PATCH");
    }
  });

  it("rejects headings hidden in comments or fences", () => {
    const hidden = `# Changelog\n## Unreleased\n<!-- ## ${version} — ${releaseDate} -->\n\`\`\`\n## ${version} — ${releaseDate}\n\`\`\`\n`;
    expect(() => validateVersionTexts({ ...versionFixture(), changelog: hidden })).toThrow(
      `exactly one visible ${version}`,
    );
  });

  it("rejects invalid dates and Maven output timestamp drift", () => {
    expect(() => validateVersionTexts({ ...versionFixture(), changelog: changelog(version, "2026-02-30") })).toThrow(
      "invalid 1.1.0 release date",
    );
    expect(() =>
      validateVersionTexts({
        ...versionFixture(),
        pom: versionFixture().pom.replace(`${releaseDate}T00:00:00Z`, "2026-07-20T00:00:00Z"),
      }),
    ).toThrow("outputTimestamp");
  });

  it("rejects version and tag drift", () => {
    expect(() =>
      validateVersionTexts({ ...versionFixture(), packageJson: JSON.stringify({ name: "integradraw-web", version: "1.1.1" }) }),
    ).toThrow("same version");
    expect(() => validateVersionTexts({ ...versionFixture(), tag: "v1.1.1" })).toThrow("exactly v1.1.0");
  });

  it("ignores valid POM comments and rejects malformed comment markers", () => {
    const fixture = versionFixture();
    const commentedPom = fixture.pom.replace(
      "<project>",
      "<project><!-- <groupId>com.planck</groupId><artifactId>integradraw</artifactId><version>9.9.9</version> -->",
    );
    expect(validateVersionTexts({ ...fixture, pom: commentedPom })).toMatchObject({ version });

    for (const marker of ["<!-- outer <!-- nested -->", "<!-- unclosed", "stray -->"]) {
      expect(() =>
        validateVersionTexts({ ...fixture, pom: fixture.pom.replace("<project>", `<project>${marker}`) }),
      ).toThrow(/XML comment|comment terminator/);
    }
  });
});

describe("release workflow contract", () => {
  it("keeps publication gated, attested, reproducible, and fail-closed without a license", async () => {
    const workflow = await readFile(join(repositoryRoot, ".github", "workflows", "release.yml"), "utf8");
    expect(workflow).not.toContain("ubuntu-latest");
    expect(workflow).toContain('RELEASE_PUBLICATION_ENABLED: "false"');
    expect(workflow).toContain("Build and verify release candidate");
    expect(workflow).toContain("Candidate vulnerability gate");
    expect(workflow).toContain("Independent reproducibility gate");
    expect(workflow).toMatch(/needs:\s*\n\s*- build\s*\n\s*- security\s*\n\s*- reproducibility/);
    expect(workflow).toContain("subject-checksums: release/SHA256SUMS");
    expect(workflow).toContain("subject-path: release/SHA256SUMS");
    for (const requiredFlag of [
      "--signer-workflow",
      "--source-digest",
      "--source-ref",
      "--predicate-type",
      "--cert-oidc-issuer",
      "--deny-self-hosted-runners",
    ]) {
      expect(workflow).toContain(requiredFlag);
    }
    expect(workflow).toContain("Scan exact Java candidate SBOM with Trivy");
    expect(workflow).toContain("Scan exact web candidate SBOM with Trivy");
    expect(workflow).toContain("severity: MEDIUM,HIGH,CRITICAL");
    expect(workflow).toContain("web/scripts/release-cli.mjs publish");
    expect(workflow).not.toContain("--generate-notes");
  });

  it("grants each Pages job only the permissions it needs", async () => {
    const workflow = await readFile(join(repositoryRoot, ".github", "workflows", "pages.yml"), "utf8");
    const buildStart = workflow.indexOf("  build:\n");
    const deployStart = workflow.indexOf("  deploy:\n");
    expect(buildStart).toBeGreaterThan(-1);
    expect(deployStart).toBeGreaterThan(buildStart);

    const build = workflow.slice(buildStart, deployStart);
    const deploy = workflow.slice(deployStart);
    expect(workflow).toMatch(/^permissions: \{\}$/mu);
    expect(build).toMatch(/^    permissions:\n      contents: read$/mu);
    expect(build).not.toMatch(/^      (?:pages|id-token):/mu);
    expect(deploy).toMatch(/^    permissions:\n      pages: write\n      id-token: write$/mu);
    expect(deploy).not.toMatch(/^      contents:/mu);
  });
});

describe("archive semantics and reproducibility", () => {
  it("creates byte-identical static archives despite filesystem timestamp changes", async () => {
    const root = await temporaryDirectory();
    const { input, output: first } = await createWebArchive(root);
    const second = join(root, "second.zip");
    await utimes(join(input, "index.html"), new Date("2030-01-01"), new Date("2030-01-01"));
    await createDeterministicZip({ inputDirectory: input, outputFile: second, releaseDate });
    expect(await readFile(second)).toEqual(await readFile(first));
    await expect(validateStaticWebArchive(second, releaseDate)).resolves.toBeInstanceOf(Map);
  });

  it("validates the executable manifest and Main class", async () => {
    const root = await temporaryDirectory();
    await expect(validateExecutableJar(await createJar(root), version)).resolves.toBeInstanceOf(Map);
    const wrong = await createJar(
      await temporaryDirectory(),
      `Manifest-Version: 1.0\r\nMain-Class: example.Wrong\r\nImplementation-Title: IntegraDraw\r\nImplementation-Version: ${version}\r\n\r\n`,
    );
    await expect(validateExecutableJar(wrong, version)).rejects.toThrow("wrong Main-Class");
  });

  it("rejects missing manifests, unsafe paths, and corrupted contents", async () => {
    const missingRoot = await temporaryDirectory();
    const missingInput = join(missingRoot, "input");
    await writeFixture(missingInput, "com/planck/Main.class", Buffer.from("class"));
    const missingJar = join(missingRoot, "missing.jar");
    await createDeterministicZip({ inputDirectory: missingInput, outputFile: missingJar, releaseDate });
    await expect(validateExecutableJar(missingJar, version)).rejects.toThrow("MANIFEST.MF");

    const unsafeRoot = await temporaryDirectory();
    const unsafeInput = join(unsafeRoot, "input");
    await writeFixture(unsafeInput, "safe", "payload");
    const unsafeZip = join(unsafeRoot, "unsafe.zip");
    await createDeterministicZip({ inputDirectory: unsafeInput, outputFile: unsafeZip, releaseDate });
    for (const unsafeName of ["../x", "C:/x", "C:xx"]) {
      const unsafeBytes = await readFile(unsafeZip);
      let occurrence = unsafeBytes.indexOf(Buffer.from("safe"));
      while (occurrence !== -1) {
        Buffer.from(unsafeName).copy(unsafeBytes, occurrence);
        occurrence = unsafeBytes.indexOf(Buffer.from("safe"), occurrence + 4);
      }
      expect(() => readZipEntriesFromBuffer(unsafeBytes, `unsafe ${unsafeName} fixture`)).toThrow(
        "unsafe entry path",
      );
    }

    const corruptRoot = await temporaryDirectory();
    const corruptInput = join(corruptRoot, "input");
    await writeFixture(corruptInput, "file.txt", "unique-payload");
    const corruptZip = join(corruptRoot, "corrupt.zip");
    await createDeterministicZip({ inputDirectory: corruptInput, outputFile: corruptZip, releaseDate });
    const corruptBytes = await readFile(corruptZip);
    corruptBytes[corruptBytes.indexOf(Buffer.from("unique-payload"))] ^= 0xff;
    expect(() => readZipEntriesFromBuffer(corruptBytes, "corrupt fixture")).toThrow("CRC mismatch");
  });
});

describe("CycloneDX and dependency evidence", () => {
  it("removes volatile SBOM fields and canonicalizes ordering", () => {
    const first = minimalBom("java", "java:z");
    first.serialNumber = "urn:uuid:first";
    first.metadata.timestamp = "2026-07-20T00:00:00Z";
    first.components.push({ "bom-ref": "java:a", type: "library", name: "a", version: "1" });
    first.dependencies.push({ ref: "java:a", dependsOn: [] });
    first.dependencies[0].dependsOn.push("java:a");
    const second = structuredClone(first);
    second.serialNumber = "urn:uuid:second";
    second.metadata.timestamp = "2030-01-01T00:00:00Z";
    second.components.reverse();
    second.dependencies.reverse();
    expect(normalizeCycloneDx(first, { platform: "java", version })).toBe(
      normalizeCycloneDx(second, { platform: "java", version }),
    );
  });

  it("rejects duplicate and dangling dependency graph references", () => {
    const duplicate = minimalBom("java");
    duplicate.components.push(structuredClone(duplicate.components[0]));
    expect(() => validateCycloneDx(duplicate, { platform: "java", version })).toThrow("repeats bom-ref");

    const dangling = minimalBom("web");
    dangling.dependencies[0].dependsOn.push("missing:component");
    expect(() => validateCycloneDx(dangling, { platform: "web", version })).toThrow("unknown ref");

    const orphan = minimalBom("web");
    orphan.components.push({ "bom-ref": "web:orphan", type: "library", name: "orphan", version: "1.0.0" });
    orphan.dependencies.push({ ref: "web:orphan", dependsOn: [] });
    expect(() => validateCycloneDx(orphan, { platform: "web", version })).toThrow("not reachable");
  });

  it("requires SBOMs and resolved dependency evidence to describe the same packages", () => {
    expect(() =>
      validateDependencyEvidenceAgainstSbom({
        platform: "java",
        bom: minimalBom("java"),
        evidence: `com.planck:integradraw:jar:${version}\n\\- example:other:jar:1.0.0:runtime\n`,
        version,
      }),
    ).toThrow("different resolved packages");

    expect(() =>
      validateDependencyEvidenceAgainstSbom({
        platform: "web",
        bom: minimalBom("web"),
        evidence: { name: "integradraw-web", version, dependencies: { other: { version: "1.0.0" } } },
        version,
      }),
    ).toThrow("different resolved packages");
  });

  it("rejects semantically incomplete dependency inventories", () => {
    expect(() => normalizeJavaDependencyEvidence(`com.planck:integradraw:jar:${version}\n`, version)).toThrow(
      "runtime dependency",
    );
    expect(() =>
      normalizeWebDependencyEvidence({ name: "wrong", version, dependencies: {} }, version),
    ).toThrow("wrong project name");
    expect(() =>
      normalizeWebDependencyEvidence(
        { name: "integradraw-web", version, dependencies: { broken: { resolved: "https://example.test" } } },
        version,
      ),
    ).toThrow("needs a version");
  });

  it("omits npm placeholders for optional packages that are not installed", () => {
    const normalized = normalizeWebDependencyEvidence(
      {
        name: "integradraw-web",
        version,
        dependencies: {
          installed: { version: "2.0.0" },
          "optional-on-another-platform": {},
        },
      },
      version,
    );
    expect(JSON.parse(normalized).dependencies).toEqual({ installed: { version: "2.0.0" } });
  });
});

describe("bundle inventory and publication", () => {
  it("validates a complete semantic bundle and detects byte drift", async () => {
    const { output } = await createBundle();
    await expect(validateReleaseBundle({ directory: output, metadata, sourceCommit })).resolves.toBeUndefined();
    const copy = await temporaryDirectory("integradraw-copy-");
    await cp(output, copy, { recursive: true });
    await expect(compareReleaseBundles(output, copy)).resolves.toHaveLength(9);
    await writeFile(join(copy, "SOURCE_COMMIT"), `${"f".repeat(40)}\n`);
    await expect(compareReleaseBundles(output, copy)).rejects.toThrow("bit-for-bit identical");
  });

  it("builds a sorted checksum inventory and rejects remote digest drift", async () => {
    const root = await temporaryDirectory();
    await writeFile(join(root, "b.txt"), "b");
    await writeFile(join(root, "a.txt"), "a");
    const inventory = await buildFileInventory(root);
    expect(inventory.map(({ name }) => name)).toEqual(["a.txt", "b.txt"]);
    expect(parseChecksumText(checksumText(inventory))).toEqual(
      inventory.map(({ name, digest }) => ({ name, digest })),
    );
    expect(() =>
      verifyRemoteAssetInventory(inventory, [
        ...inventory.slice(0, 1),
        { ...inventory[1], digest: `sha256:${"0".repeat(64)}` },
      ]),
    ).toThrow("do not match");
  });

  it("publishes only an exact candidate and verifies immutable latest state", async () => {
    const { output } = await createBundle();
    const api = new FakeGitHubReleaseApi(await buildFileInventory(output));
    const published = await publishWithFake(output, api);
    expect(published.draft).toBe(false);
    expect(published.immutable).toBe(true);
    expect(api.calls.some((call) => call[1] === "release" && call[2] === "upload")).toBe(true);
    expect(api.calls.some((call) => call.includes("PATCH"))).toBe(true);
    expect(api.calls.some((call) => call[2] === "repos/owner/repository/releases/latest")).toBe(true);
    expect(api.release.body).toContain("## Changes");
    expect(api.release.body).toContain("integradraw-release/v1");
    expect(api.release.body).not.toContain("Full Changelog");
  });

  it("recovers an authorized draft through the paginated release list", async () => {
    const { output } = await createBundle();
    const api = new FakeGitHubReleaseApi(await buildFileInventory(output), { failUpload: true });
    await expect(publishWithFake(output, api)).rejects.toThrow("upload interrupted");
    const createCalls = () => api.calls.filter((call) => call[2] === "repos/owner/repository/releases" && call.includes("POST"));
    expect(createCalls()).toHaveLength(1);

    api.failUpload = false;
    api.paginateDrafts = true;
    await publishWithFake(output, api);
    expect(createCalls()).toHaveLength(1);
    expect(api.calls.some((call) => call[2]?.endsWith("page=2"))).toBe(true);
    expect(api.calls.some((call) => call.includes("DELETE"))).toBe(true);
  });

  it("does not mutate a recoverable draft when its source leaves the default branch", async () => {
    const { output } = await createBundle();
    const api = new FakeGitHubReleaseApi(await buildFileInventory(output), { failUpload: true });
    await expect(publishWithFake(output, api)).rejects.toThrow("upload interrupted");
    expect(api.release.assets).toHaveLength(1);

    api.failUpload = false;
    api.defaultCommit = "f".repeat(40);
    api.contained = false;
    const mutationsBeforeRecovery = mutationCalls(api).length;
    await expect(publishWithFake(output, api)).rejects.toThrow("not contained");
    expect(mutationCalls(api)).toHaveLength(mutationsBeforeRecovery);
    expect(api.release.assets).toHaveLength(1);
    expect(api.release.draft).toBe(true);
  });

  it("is idempotent for the exact immutable published release", async () => {
    const { output } = await createBundle();
    const api = new FakeGitHubReleaseApi(await buildFileInventory(output));
    await publishWithFake(output, api);
    const mutationCount = api.calls.filter((call) => call.includes("POST") || call.includes("PATCH") || call[1] === "release").length;
    await publishWithFake(output, api);
    expect(api.calls.filter((call) => call.includes("POST") || call.includes("PATCH") || call[1] === "release")).toHaveLength(mutationCount);
  });

  it("leaves a recoverable draft unpublished when the remote inventory drifts", async () => {
    const { output } = await createBundle();
    const api = new FakeGitHubReleaseApi(await buildFileInventory(output), { mismatchUpload: true });
    await expect(publishWithFake(output, api)).rejects.toThrow("do not match");
    expect(api.release.draft).toBe(true);
    expect(api.calls.some((call) => call.includes("PATCH"))).toBe(false);
  });

  it("refuses foreign drafts, duplicate tag releases, and uncontained source commits", async () => {
    const { output } = await createBundle();
    const inventory = await buildFileInventory(output);

    const foreign = new FakeGitHubReleaseApi(inventory, { failUpload: true });
    await expect(publishWithFake(output, foreign)).rejects.toThrow("upload interrupted");
    foreign.failUpload = false;
    foreign.release.body += "\nforeign edit";
    await expect(publishWithFake(output, foreign)).rejects.toThrow("foreign or stale release contract");

    const duplicate = new FakeGitHubReleaseApi(inventory, { failUpload: true });
    await expect(publishWithFake(output, duplicate)).rejects.toThrow("upload interrupted");
    duplicate.failUpload = false;
    duplicate.duplicateRelease = true;
    await expect(publishWithFake(output, duplicate)).rejects.toThrow("multiple releases");

    const uncontained = new FakeGitHubReleaseApi(inventory, {
      defaultCommit: "f".repeat(40),
      contained: false,
    });
    await expect(publishWithFake(output, uncontained)).rejects.toThrow("not contained");
    expect(uncontained.release).toBeNull();
  });

  it("reconciles an ambiguous transition but fails closed when immutability is absent", async () => {
    const { output } = await createBundle();
    const inventory = await buildFileInventory(output);
    const ambiguous = new FakeGitHubReleaseApi(inventory, { ambiguousPublish: true });
    await expect(publishWithFake(output, ambiguous)).resolves.toMatchObject({ draft: false, immutable: true });

    const mutable = new FakeGitHubReleaseApi(inventory, { publishedImmutable: false });
    await expect(publishWithFake(output, mutable)).rejects.toThrow("not immutable");
    expect(mutable.release.draft).toBe(false);
  });

  it("requires the explicit license and trusted tag-event gates", async () => {
    const { output } = await createBundle();
    const api = new FakeGitHubReleaseApi(await buildFileInventory(output));
    await expect(publishWithFake(output, api, { publicationAuthorized: false })).rejects.toThrow("approved license");
    await expect(publishWithFake(output, api, { eventName: "workflow_dispatch" })).rejects.toThrow("tag-push event");
    expect(api.calls).toHaveLength(0);
  });
});
