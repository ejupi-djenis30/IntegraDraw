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
  validateCycloneDx,
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
  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: { component: root },
    components: [
      {
        "bom-ref": dependencyRef,
        type: "library",
        name: "dependency",
        version: "1.0.0",
      },
    ],
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
      `com.planck:integradraw:jar:${version}\n\\- example:runtime:jar:1.0.0:runtime\n`,
      version,
    ),
  );
  const webDependencies = await writeFixture(
    root,
    "inputs/web-dependencies.json",
    normalizeWebDependencyEvidence(
      { name: "integradraw-web", version, dependencies: { vite: { version: "8.1.5" } } },
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
    const unsafeBytes = await readFile(unsafeZip);
    let occurrence = unsafeBytes.indexOf(Buffer.from("safe"));
    while (occurrence !== -1) {
      Buffer.from("../x").copy(unsafeBytes, occurrence);
      occurrence = unsafeBytes.indexOf(Buffer.from("safe"), occurrence + 4);
    }
    expect(() => readZipEntriesFromBuffer(unsafeBytes, "unsafe fixture")).toThrow("unsafe entry path");

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

  it("publishes only after the draft asset inventory matches", async () => {
    const { output } = await createBundle();
    const inventory = await buildFileInventory(output);
    const calls = [];
    const runProcess = (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === "api") {
        return {
          status: 0,
          stdout: JSON.stringify({ draft: true, tag_name: `v${version}`, assets: inventory }),
          stderr: "",
        };
      }
      return { status: 0, stdout: "", stderr: "" };
    };
    await publishRelease({
      directory: output,
      tag: `v${version}`,
      repository: "owner/repository",
      metadata,
      runProcess,
    });
    expect(calls.map((call) => call.slice(0, 3))).toEqual([
      ["gh", "release", "create"],
      ["gh", "api", `repos/owner/repository/releases/tags/v${version}`],
      ["gh", "release", "edit"],
    ]);
  });

  it("leaves a draft unpublished when GitHub reports a mismatched asset", async () => {
    const { output } = await createBundle();
    const inventory = await buildFileInventory(output);
    const calls = [];
    const runProcess = (command, args) => {
      calls.push([command, ...args]);
      if (args[0] === "api") {
        const assets = inventory.map((asset, index) =>
          index === 0 ? { ...asset, digest: `sha256:${"0".repeat(64)}` } : asset,
        );
        return {
          status: 0,
          stdout: JSON.stringify({ draft: true, tag_name: `v${version}`, assets }),
          stderr: "",
        };
      }
      return { status: 0, stdout: "", stderr: "" };
    };
    await expect(
      publishRelease({
        directory: output,
        tag: `v${version}`,
        repository: "owner/repository",
        metadata,
        runProcess,
      }),
    ).rejects.toThrow("do not match");
    expect(calls.some((call) => call[1] === "release" && call[2] === "edit")).toBe(false);
  });
});
