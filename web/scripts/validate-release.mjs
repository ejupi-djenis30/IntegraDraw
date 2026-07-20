import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const sourceCommitPattern = /^[0-9a-f]{40}$/;

function projectVersionFromPom(pom) {
  const projectCoordinates = pom.match(
    /<groupId>[^<]+<\/groupId>\s*<artifactId>integradraw<\/artifactId>\s*<version>([^<]+)<\/version>/,
  );
  assert.ok(projectCoordinates, "pom.xml must declare the IntegraDraw project version after its coordinates.");
  return projectCoordinates[1].trim();
}

export function validateVersionTexts({ pom, packageJson, packageLockJson, changelog, tag }) {
  const javaVersion = projectVersionFromPom(pom);
  const webMetadata = JSON.parse(packageJson);
  const lockMetadata = JSON.parse(packageLockJson);
  const webVersion = webMetadata.version;

  assert.match(javaVersion, semanticVersionPattern, `Invalid Maven project version: ${javaVersion}`);
  assert.equal(webVersion, javaVersion, "pom.xml and web/package.json must declare the same version.");
  assert.equal(lockMetadata.version, javaVersion, "web/package-lock.json must declare the project version.");
  assert.equal(
    lockMetadata.packages?.[""]?.version,
    javaVersion,
    "The root package in web/package-lock.json must declare the project version.",
  );
  assert.ok(
    changelog.includes(`## ${javaVersion} —`),
    `CHANGELOG.md must contain a dated ${javaVersion} release heading.`,
  );

  if (tag !== undefined) {
    assert.equal(tag, `v${javaVersion}`, `Release tag must be exactly v${javaVersion}.`);
  }

  return javaVersion;
}

export async function validateReleaseMetadata({ root = repositoryRoot, tag } = {}) {
  const [pom, packageJson, packageLockJson, changelog] = await Promise.all([
    readFile(resolve(root, "pom.xml"), "utf8"),
    readFile(resolve(root, "web/package.json"), "utf8"),
    readFile(resolve(root, "web/package-lock.json"), "utf8"),
    readFile(resolve(root, "CHANGELOG.md"), "utf8"),
  ]);

  return validateVersionTexts({ pom, packageJson, packageLockJson, changelog, tag });
}

function releaseFileNames(version) {
  return [
    "SOURCE_COMMIT",
    `integradraw-${version}.jar`,
    `integradraw-java-${version}.cdx.json`,
    `integradraw-java-dependencies-${version}.txt`,
    `integradraw-web-${version}.cdx.json`,
    `integradraw-web-${version}.zip`,
    `integradraw-web-dependencies-${version}.json`,
    "release-metadata.json",
  ].sort();
}

function confinedPath(root, child) {
  const candidate = resolve(root, child);
  const pathFromRoot = relative(root, candidate);
  assert.ok(
    pathFromRoot !== "" && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`),
    `Release path escapes its root: ${child}`,
  );
  return candidate;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function assertZip(file, label) {
  const bytes = await readFile(file);
  assert.ok(bytes.byteLength >= 4, `${label} is unexpectedly small.`);
  assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK", `${label} is not a ZIP-compatible archive.`);
}

export async function validateReleaseBundle({ directory, version, sourceCommit }) {
  assert.match(version, semanticVersionPattern, "Release bundle version must be semantic.");
  assert.match(sourceCommit, sourceCommitPattern, "Source commit must be a lowercase 40-character SHA.");

  const expectedFiles = releaseFileNames(version);
  const actualFiles = (await readdir(directory))
    .filter((entry) => entry !== "SHA256SUMS")
    .sort();
  assert.deepEqual(actualFiles, expectedFiles, "Release bundle contains missing, stale, or unexpected files.");

  const checksumLines = (await readFile(resolve(directory, "SHA256SUMS"), "utf8"))
    .trim()
    .split("\n");
  const checksumEntries = checksumLines.map((line) => {
    const match = line.match(/^([0-9a-f]{64})  ([^/\\]+)$/);
    assert.ok(match, `Malformed SHA256SUMS entry: ${line}`);
    return { digest: match[1], name: match[2] };
  });
  assert.deepEqual(
    checksumEntries.map(({ name }) => name),
    expectedFiles,
    "SHA256SUMS must list every release file exactly once in lexical order.",
  );

  for (const { digest, name } of checksumEntries) {
    assert.equal(await sha256(confinedPath(directory, name)), digest, `Checksum mismatch for ${name}.`);
  }

  assert.equal(await readFile(resolve(directory, "SOURCE_COMMIT"), "utf8"), `${sourceCommit}\n`);

  const metadata = JSON.parse(await readFile(resolve(directory, "release-metadata.json"), "utf8"));
  assert.deepEqual(metadata, {
    schemaVersion: 1,
    project: "IntegraDraw",
    version,
    tag: `v${version}`,
    sourceCommit,
    artifacts: {
      desktop: `integradraw-${version}.jar`,
      staticWeb: `integradraw-web-${version}.zip`,
      sboms: [`integradraw-java-${version}.cdx.json`, `integradraw-web-${version}.cdx.json`],
      dependencyEvidence: [
        `integradraw-java-dependencies-${version}.txt`,
        `integradraw-web-dependencies-${version}.json`,
      ],
    },
  });

  for (const platform of ["java", "web"]) {
    const sbomName = `integradraw-${platform}-${version}.cdx.json`;
    const sbom = JSON.parse(await readFile(resolve(directory, sbomName), "utf8"));
    assert.equal(sbom.bomFormat, "CycloneDX", `${sbomName} is not a CycloneDX document.`);
    assert.equal(sbom.metadata?.component?.version, version, `${sbomName} has the wrong project version.`);
  }

  const javaEvidence = await readFile(
    resolve(directory, `integradraw-java-dependencies-${version}.txt`),
    "utf8",
  );
  assert.ok(
    javaEvidence.includes(`com.planck:integradraw:jar:${version}`),
    "Java dependency evidence does not identify this build.",
  );

  const webEvidence = JSON.parse(
    await readFile(resolve(directory, `integradraw-web-dependencies-${version}.json`), "utf8"),
  );
  assert.equal(webEvidence.version, version, "Web dependency evidence has the wrong project version.");

  await assertZip(resolve(directory, `integradraw-${version}.jar`), "Desktop JAR");
  await assertZip(resolve(directory, `integradraw-web-${version}.zip`), "Static web archive");
}

export async function assembleReleaseBundle({
  root = repositoryRoot,
  outputDirectory,
  sourceCommit,
  webArchive,
}) {
  assert.match(sourceCommit, sourceCommitPattern, "Source commit must be a lowercase 40-character SHA.");
  const version = await validateReleaseMetadata({ root });
  const output = resolve(outputDirectory);
  await mkdir(output, { recursive: true });
  const existingEntries = await readdir(output);
  assert.equal(existingEntries.length, 0, `Release output directory is not empty: ${output}`);

  const inputs = new Map([
    [`integradraw-${version}.jar`, resolve(root, `target/integradraw-${version}.jar`)],
    [`integradraw-java-${version}.cdx.json`, resolve(root, "target/bom.json")],
    [`integradraw-java-dependencies-${version}.txt`, resolve(root, "target/java-dependencies.txt")],
    [`integradraw-web-${version}.cdx.json`, resolve(root, "web/target/sbom.cdx.json")],
    [`integradraw-web-${version}.zip`, resolve(webArchive)],
    [`integradraw-web-dependencies-${version}.json`, resolve(root, "web/target/npm-dependencies.json")],
  ]);

  for (const [name, source] of inputs) {
    assert.ok((await stat(source)).isFile(), `Release input is not a file: ${relative(root, source)}`);
    await copyFile(source, confinedPath(output, name));
  }

  await writeFile(resolve(output, "SOURCE_COMMIT"), `${sourceCommit}\n`, "utf8");
  const metadata = {
    schemaVersion: 1,
    project: "IntegraDraw",
    version,
    tag: `v${version}`,
    sourceCommit,
    artifacts: {
      desktop: `integradraw-${version}.jar`,
      staticWeb: `integradraw-web-${version}.zip`,
      sboms: [`integradraw-java-${version}.cdx.json`, `integradraw-web-${version}.cdx.json`],
      dependencyEvidence: [
        `integradraw-java-dependencies-${version}.txt`,
        `integradraw-web-dependencies-${version}.json`,
      ],
    },
  };
  await writeFile(resolve(output, "release-metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  const checksums = [];
  for (const name of releaseFileNames(version)) {
    checksums.push(`${await sha256(confinedPath(output, name))}  ${name}`);
  }
  await writeFile(resolve(output, "SHA256SUMS"), `${checksums.join("\n")}\n`, "utf8");
  await validateReleaseBundle({ directory: output, version, sourceCommit });
  return version;
}

function parseArguments(args) {
  const allowedArguments = new Set(["--tag", "--assemble", "--commit", "--web-archive"]);
  const parsedArguments = new Map();

  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    assert.ok(allowedArguments.has(name), `Unknown argument: ${name}`);
    assert.ok(value && !value.startsWith("--"), `${name} requires a value.`);
    assert.ok(!parsedArguments.has(name), `Argument supplied more than once: ${name}`);
    parsedArguments.set(name, value);
  }

  return parsedArguments;
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const args = process.argv.slice(2);
  const parsedArguments = parseArguments(args);
  const tag = parsedArguments.get("--tag");
  const outputDirectory = parsedArguments.get("--assemble");
  const sourceCommit = parsedArguments.get("--commit");
  const webArchive = parsedArguments.get("--web-archive");

  if (outputDirectory !== undefined) {
    assert.ok(sourceCommit, "--assemble requires --commit.");
    assert.ok(webArchive, "--assemble requires --web-archive.");
    const version = await assembleReleaseBundle({ outputDirectory, sourceCommit, webArchive });
    console.log(`IntegraDraw ${version} release bundle validated.`);
  } else {
    const version = await validateReleaseMetadata({ tag });
    console.log(version);
  }
}
