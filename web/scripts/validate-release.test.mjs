import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateReleaseBundle, validateVersionTexts } from "./validate-release.mjs";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function metadata(version = "1.1.0") {
  return {
    pom: `<project><groupId>com.planck</groupId><artifactId>integradraw</artifactId><version>${version}</version></project>`,
    packageJson: JSON.stringify({ name: "integradraw-web", version }),
    packageLockJson: JSON.stringify({ version, packages: { "": { version } } }),
    changelog: `# Changelog\n\n## ${version} — 2026-07-19\n`,
  };
}

async function digest(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

describe("release metadata validation", () => {
  it("accepts synchronized versions and the exact release tag", () => {
    expect(validateVersionTexts({ ...metadata(), tag: "v1.1.0" })).toBe("1.1.0");
  });

  it("rejects Java and web version drift", () => {
    expect(() =>
      validateVersionTexts({ ...metadata(), packageJson: JSON.stringify({ version: "1.1.1" }) }),
    ).toThrow("pom.xml and web/package.json must declare the same version");
  });

  it("rejects a stale npm lockfile version", () => {
    expect(() =>
      validateVersionTexts({
        ...metadata(),
        packageLockJson: JSON.stringify({ version: "1.0.0", packages: { "": { version: "1.0.0" } } }),
      }),
    ).toThrow("web/package-lock.json must declare the project version");
  });

  it("rejects a tag that does not identify the synchronized version", () => {
    expect(() => validateVersionTexts({ ...metadata(), tag: "v1.1.1" })).toThrow(
      "Release tag must be exactly v1.1.0",
    );
  });
});

describe("release bundle validation", () => {
  it("detects a modified artifact after checksums are written", async () => {
    const directory = await mkdtemp(join(tmpdir(), "integradraw-release-"));
    temporaryDirectories.push(directory);
    const version = "1.1.0";
    const sourceCommit = "0123456789abcdef0123456789abcdef01234567";
    const files = new Map([
      ["SOURCE_COMMIT", `${sourceCommit}\n`],
      [`integradraw-${version}.jar`, "PK\u0003\u0004desktop"],
      [
        `integradraw-java-${version}.cdx.json`,
        JSON.stringify({ bomFormat: "CycloneDX", metadata: { component: { version } } }),
      ],
      [`integradraw-java-dependencies-${version}.txt`, `com.planck:integradraw:jar:${version}`],
      [
        `integradraw-web-${version}.cdx.json`,
        JSON.stringify({ bomFormat: "CycloneDX", metadata: { component: { version } } }),
      ],
      [`integradraw-web-${version}.zip`, "PK\u0003\u0004web"],
      [`integradraw-web-dependencies-${version}.json`, JSON.stringify({ version })],
      [
        "release-metadata.json",
        JSON.stringify({
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
        }),
      ],
    ]);

    for (const [name, contents] of files) await writeFile(join(directory, name), contents);
    const checksumLines = [];
    for (const name of [...files.keys()].sort()) {
      checksumLines.push(`${await digest(join(directory, name))}  ${name}`);
    }
    await writeFile(join(directory, "SHA256SUMS"), `${checksumLines.join("\n")}\n`);

    await expect(validateReleaseBundle({ directory, version, sourceCommit })).resolves.toBeUndefined();
    await writeFile(join(directory, `integradraw-web-${version}.zip`), "PK\u0003\u0004tampered");
    await expect(validateReleaseBundle({ directory, version, sourceCommit })).rejects.toThrow(
      "Checksum mismatch",
    );
  });
});
