import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  appendFile,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { delimiter, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

export const repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const sourceCommitPattern = /^[0-9a-f]{40}$/;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const checksumLinePattern = /^([0-9a-f]{64})  ([^/\\]+)$/;
const maxProcessBuffer = 16 * 1024 * 1024;

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertPlainObject(value, label) {
  assert.ok(isPlainObject(value), `${label} must be an object.`);
}

function stripXmlComments(xml) {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

function projectMetadataFromPom(pom) {
  const visiblePom = stripXmlComments(pom);
  const coordinates = visiblePom.match(
    /<groupId>\s*com\.planck\s*<\/groupId>\s*<artifactId>\s*integradraw\s*<\/artifactId>\s*<version>\s*([^<\s]+)\s*<\/version>/,
  );
  assert.ok(coordinates, "pom.xml must declare the com.planck:integradraw project version.");

  const outputTimestamp = visiblePom.match(
    /<project\.build\.outputTimestamp>\s*([^<]+?)\s*<\/project\.build\.outputTimestamp>/,
  );
  assert.ok(outputTimestamp, "pom.xml must pin project.build.outputTimestamp.");

  return { version: coordinates[1], outputTimestamp: outputTimestamp[1] };
}

function stripHtmlComments(line, state) {
  let cursor = 0;
  let visible = "";

  while (cursor < line.length) {
    if (state.inComment) {
      const commentEnd = line.indexOf("-->", cursor);
      if (commentEnd === -1) return visible;
      state.inComment = false;
      cursor = commentEnd + 3;
      continue;
    }

    const commentStart = line.indexOf("<!--", cursor);
    if (commentStart === -1) return visible + line.slice(cursor);
    visible += line.slice(cursor, commentStart);
    state.inComment = true;
    cursor = commentStart + 4;
  }

  return visible;
}

function validCalendarDate(dateText) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return false;
  const parsed = new Date(`${dateText}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === dateText;
}

export function parseChangelogSections(markdown) {
  const sections = [];
  const commentState = { inComment: false };
  let fence = null;

  for (const rawLine of markdown.split(/\r?\n/)) {
    if (fence !== null) {
      const closingFence = rawLine.match(/^\s{0,3}(`+|~+)\s*$/);
      if (
        closingFence &&
        closingFence[1][0] === fence.character &&
        closingFence[1].length >= fence.length
      ) {
        fence = null;
      }
      continue;
    }

    const visibleLine = stripHtmlComments(rawLine, commentState);
    if (commentState.inComment && visibleLine.trim() === "") continue;

    const openingFence = visibleLine.match(/^\s{0,3}(`{3,}|~{3,})(?:\s*.*)?$/);
    if (openingFence) {
      fence = { character: openingFence[1][0], length: openingFence[1].length };
      continue;
    }

    const heading = visibleLine.match(/^\s{0,3}##\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const release = heading[1].match(/^(\d+\.\d+\.\d+)\s+—\s+(\d{4}-\d{2}-\d{2})$/);
      sections.push({
        title: heading[1],
        version: release?.[1],
        date: release?.[2],
        body: [],
      });
      continue;
    }

    if (sections.length > 0) sections.at(-1).body.push(visibleLine);
  }

  assert.equal(fence, null, "CHANGELOG.md contains an unclosed fenced code block.");
  assert.equal(commentState.inComment, false, "CHANGELOG.md contains an unclosed HTML comment.");
  return sections;
}

export function validateVersionTexts({ pom, packageJson, packageLockJson, changelog, tag }) {
  const javaMetadata = projectMetadataFromPom(pom);
  const webMetadata = JSON.parse(packageJson);
  const lockMetadata = JSON.parse(packageLockJson);
  const version = javaMetadata.version;

  assert.match(version, stableVersionPattern, "Release versions must be stable MAJOR.MINOR.PATCH values.");
  assert.equal(webMetadata.name, "integradraw-web", "web/package.json must retain the project name.");
  assert.equal(webMetadata.version, version, "pom.xml and web/package.json must declare the same version.");
  assert.equal(lockMetadata.version, version, "web/package-lock.json must declare the project version.");
  assert.equal(
    lockMetadata.packages?.[""]?.version,
    version,
    "The root package in web/package-lock.json must declare the project version.",
  );

  const sections = parseChangelogSections(changelog);
  assert.equal(
    sections.filter(({ title }) => title === "Unreleased").length,
    1,
    "CHANGELOG.md must contain exactly one visible Unreleased section.",
  );
  const releases = sections.filter((section) => section.version === version);
  assert.equal(releases.length, 1, `CHANGELOG.md must contain exactly one visible ${version} release heading.`);
  const release = releases[0];
  assert.ok(validCalendarDate(release.date), `CHANGELOG.md has an invalid ${version} release date.`);
  assert.ok(
    release.body.some((line) => /^\s*[-*+]\s+\S/.test(line)),
    `CHANGELOG.md ${version} must contain at least one release-note item.`,
  );

  const expectedTimestamp = `${release.date}T00:00:00Z`;
  assert.equal(
    javaMetadata.outputTimestamp,
    expectedTimestamp,
    "project.build.outputTimestamp must equal the current changelog release date at UTC midnight.",
  );

  if (tag !== undefined && tag !== "") {
    assert.equal(tag, `v${version}`, `Release tag must be exactly v${version}.`);
  }

  return {
    version,
    releaseDate: release.date,
    outputTimestamp: expectedTimestamp,
    sourceDateEpoch: Math.floor(Date.parse(expectedTimestamp) / 1000),
  };
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

function confinedPath(root, child) {
  const candidate = resolve(root, child);
  const pathFromRoot = relative(root, candidate);
  assert.ok(
    pathFromRoot !== "" && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`),
    `Path escapes its root: ${child}`,
  );
  return candidate;
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function sha256File(file) {
  return sha256Bytes(await readFile(file));
}

export function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function archivePathIsSafe(name) {
  if (name === "" || name.includes("\\") || name.includes("\0") || name.startsWith("/")) return false;
  const segments = name.split("/");
  if (segments.at(-1) === "") segments.pop();
  return segments.length > 0 && segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function dosTimestamp(dateText) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  assert.ok(validCalendarDate(dateText), `Invalid archive date: ${dateText}`);
  const year = date.getUTCFullYear();
  assert.ok(year >= 1980 && year <= 2107, "ZIP timestamps require a year between 1980 and 2107.");
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: 0,
  };
}

async function listRegularFiles(directory, prefix = "") {
  const entries = await readdir(resolve(directory, prefix), { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => compareText(left.name, right.name))) {
    const archiveName = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    const filesystemPath = resolve(directory, ...archiveName.split("/"));
    const details = await lstat(filesystemPath);
    assert.equal(details.isSymbolicLink(), false, `Archive input cannot be a symbolic link: ${archiveName}`);
    if (details.isDirectory()) files.push(...(await listRegularFiles(directory, archiveName)));
    else {
      assert.ok(details.isFile(), `Archive input must be a regular file: ${archiveName}`);
      assert.ok(archivePathIsSafe(archiveName), `Unsafe archive input path: ${archiveName}`);
      files.push({ name: archiveName, path: filesystemPath });
    }
  }

  return files;
}

export async function createDeterministicZip({ inputDirectory, outputFile, releaseDate }) {
  const files = await listRegularFiles(resolve(inputDirectory));
  assert.ok(files.length > 0, "Cannot create an empty static web archive.");
  const timestamp = dosTimestamp(releaseDate);
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const contents = await readFile(file.path);
    const digest = crc32(contents);
    assert.ok(contents.byteLength <= 0xffffffff, `${file.name} is too large for a non-ZIP64 archive.`);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(digest, 14);
    localHeader.writeUInt32LE(contents.byteLength, 18);
    localHeader.writeUInt32LE(contents.byteLength, 22);
    localHeader.writeUInt16LE(name.byteLength, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, contents);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(0x0314, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(digest, 16);
    centralHeader.writeUInt32LE(contents.byteLength, 20);
    centralHeader.writeUInt32LE(contents.byteLength, 24);
    centralHeader.writeUInt16LE(name.byteLength, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.byteLength + name.byteLength + contents.byteLength;
  }

  assert.ok(files.length <= 0xffff, "Static web archive has too many entries for non-ZIP64 output.");
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  await writeFile(resolve(outputFile), Buffer.concat([...localParts, centralDirectory, end]));
}

function findEndOfCentralDirectory(bytes) {
  const minimumOffset = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record is missing.");
}

export function readZipEntriesFromBuffer(bytes, label = "archive") {
  assert.ok(Buffer.isBuffer(bytes), `${label} must be supplied as a Buffer.`);
  assert.ok(bytes.byteLength >= 22, `${label} is too small to be a ZIP archive.`);
  const endOffset = findEndOfCentralDirectory(bytes);
  const disk = bytes.readUInt16LE(endOffset + 4);
  const centralDisk = bytes.readUInt16LE(endOffset + 6);
  const entriesOnDisk = bytes.readUInt16LE(endOffset + 8);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  const commentLength = bytes.readUInt16LE(endOffset + 20);
  assert.equal(disk, 0, `${label} cannot span multiple disks.`);
  assert.equal(centralDisk, 0, `${label} cannot span multiple disks.`);
  assert.equal(entriesOnDisk, entryCount, `${label} has inconsistent entry counts.`);
  assert.notEqual(entryCount, 0xffff, `${label} uses unsupported ZIP64 entry counts.`);
  assert.equal(endOffset + 22 + commentLength, bytes.byteLength, `${label} has trailing or truncated data.`);
  assert.equal(centralOffset + centralSize, endOffset, `${label} has an inconsistent central directory.`);

  const entries = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert.ok(offset + 46 <= endOffset, `${label} has a truncated central-directory entry.`);
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, `${label} has an invalid central-directory signature.`);
    const flags = bytes.readUInt16LE(offset + 8);
    const method = bytes.readUInt16LE(offset + 10);
    const modifiedTime = bytes.readUInt16LE(offset + 12);
    const modifiedDate = bytes.readUInt16LE(offset + 14);
    const expectedCrc = bytes.readUInt32LE(offset + 16);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const entryCommentLength = bytes.readUInt16LE(offset + 32);
    const entryDisk = bytes.readUInt16LE(offset + 34);
    const externalAttributes = bytes.readUInt32LE(offset + 38);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    assert.ok(nameEnd + extraLength + entryCommentLength <= endOffset, `${label} has a truncated entry name.`);
    const nameBytes = bytes.subarray(nameStart, nameEnd);
    const name = nameBytes.toString("utf8");
    assert.ok(Buffer.from(name, "utf8").equals(nameBytes), `${label} contains a non-UTF-8 entry name.`);
    assert.ok(archivePathIsSafe(name), `${label} contains an unsafe entry path: ${name}`);
    assert.equal(entries.has(name), false, `${label} contains a duplicate entry: ${name}`);
    assert.equal(entryDisk, 0, `${label} contains an entry on another disk.`);
    assert.equal(flags & 0x0001, 0, `${label} contains an encrypted entry: ${name}`);
    assert.ok(method === 0 || method === 8, `${label} contains an unsupported compression method: ${name}`);
    assert.notEqual(compressedSize, 0xffffffff, `${label} contains an unsupported ZIP64 entry: ${name}`);
    assert.notEqual(uncompressedSize, 0xffffffff, `${label} contains an unsupported ZIP64 entry: ${name}`);

    assert.ok(localHeaderOffset + 30 <= centralOffset, `${label} has an invalid local-header offset for ${name}.`);
    assert.equal(bytes.readUInt32LE(localHeaderOffset), 0x04034b50, `${label} has an invalid local header for ${name}.`);
    const localNameLength = bytes.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localHeaderOffset + 28);
    const localNameStart = localHeaderOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    assert.equal(bytes.subarray(localNameStart, localNameEnd).toString("utf8"), name, `${label} entry names disagree.`);
    const dataStart = localNameEnd + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    assert.ok(dataEnd <= centralOffset, `${label} has truncated entry data for ${name}.`);
    const compressed = bytes.subarray(dataStart, dataEnd);
    const contents = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    assert.equal(contents.byteLength, uncompressedSize, `${label} has the wrong expanded size for ${name}.`);
    assert.equal(crc32(contents), expectedCrc, `${label} has a CRC mismatch for ${name}.`);

    entries.set(name, {
      name,
      contents,
      method,
      flags,
      modifiedTime,
      modifiedDate,
      externalAttributes,
    });
    offset = nameEnd + extraLength + entryCommentLength;
  }
  assert.equal(offset, endOffset, `${label} central-directory size does not match its entries.`);
  return entries;
}

export async function readZipEntries(file, label) {
  return readZipEntriesFromBuffer(await readFile(file), label ?? file);
}

function parseManifest(contents) {
  const physicalLines = contents.toString("utf8").replace(/\r\n/g, "\n").split("\n");
  const logicalLines = [];
  for (const line of physicalLines) {
    if (line.startsWith(" ")) {
      assert.ok(logicalLines.length > 0, "JAR manifest begins with an invalid continuation line.");
      logicalLines[logicalLines.length - 1] += line.slice(1);
    } else logicalLines.push(line);
  }

  const attributes = new Map();
  for (const line of logicalLines) {
    if (line === "") break;
    const separator = line.indexOf(": ");
    assert.ok(separator > 0, `JAR manifest contains a malformed attribute: ${line}`);
    const name = line.slice(0, separator).toLowerCase();
    assert.equal(attributes.has(name), false, `JAR manifest repeats ${name}.`);
    attributes.set(name, line.slice(separator + 2));
  }
  return attributes;
}

export async function validateExecutableJar(file, version) {
  assert.match(version, stableVersionPattern, "JAR validation requires a stable project version.");
  const entries = await readZipEntries(file, "Desktop JAR");
  const manifestEntry = entries.get("META-INF/MANIFEST.MF");
  assert.ok(manifestEntry, "Desktop JAR is missing META-INF/MANIFEST.MF.");
  assert.ok(entries.has("com/planck/Main.class"), "Desktop JAR is missing com/planck/Main.class.");
  const manifest = parseManifest(manifestEntry.contents);
  assert.equal(manifest.get("manifest-version"), "1.0", "Desktop JAR has an invalid manifest version.");
  assert.equal(manifest.get("main-class"), "com.planck.Main", "Desktop JAR has the wrong Main-Class.");
  assert.equal(manifest.get("implementation-title"), "IntegraDraw", "Desktop JAR has the wrong title.");
  assert.equal(manifest.get("implementation-version"), version, "Desktop JAR has the wrong version.");
  return entries;
}

export async function validateStaticWebArchive(file, releaseDate) {
  const entries = await readZipEntries(file, "Static web archive");
  for (const required of [
    "index.html",
    "brand-mark.svg",
    "favicon.svg",
    "poster.svg",
    "social-preview.png",
    "integradraw-demo.mp4",
  ]) {
    assert.ok(entries.has(required), `Static web archive is missing ${required}.`);
  }
  assert.ok([...entries.keys()].some((name) => /^assets\/[^/]+\.js$/.test(name)), "Static web archive has no JS bundle.");
  assert.ok([...entries.keys()].some((name) => /^assets\/[^/]+\.css$/.test(name)), "Static web archive has no CSS bundle.");
  const expectedTimestamp = dosTimestamp(releaseDate);
  for (const entry of entries.values()) {
    assert.equal(entry.method, 0, `Static web archive entry is not deterministically stored: ${entry.name}`);
    assert.equal(entry.modifiedDate, expectedTimestamp.date, `Static web archive entry has the wrong date: ${entry.name}`);
    assert.equal(entry.modifiedTime, expectedTimestamp.time, `Static web archive entry has the wrong time: ${entry.name}`);
  }
  const html = entries.get("index.html").contents.toString("utf8");
  const bundleReferences = [
    ...html.matchAll(/(?:src|href)="(?:\.\/|\/IntegraDraw\/)(assets\/[^"?#]+\.(?:js|css))"/g),
  ];
  assert.ok(bundleReferences.length >= 2, "index.html does not reference its JS and CSS bundles.");
  for (const match of bundleReferences) {
    assert.ok(entries.has(match[1]), `index.html references a missing bundle: ${match[1]}`);
  }
  return entries;
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    const normalized = value.map(canonicalize);
    return normalized.sort((left, right) => compareText(JSON.stringify(left), JSON.stringify(right)));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareText)
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function expectedRootComponent(platform, version) {
  if (platform === "java") {
    return { name: "integradraw", group: "com.planck", type: "application", version };
  }
  assert.equal(platform, "web", `Unknown SBOM platform: ${platform}`);
  return { name: "integradraw-web", type: "application", version };
}

export function validateCycloneDx(bom, { platform, version }) {
  assertPlainObject(bom, `${platform} SBOM`);
  assert.equal(bom.bomFormat, "CycloneDX", `${platform} SBOM has the wrong format.`);
  assert.match(String(bom.specVersion), /^1\.[4-9]$/, `${platform} SBOM has an unsupported spec version.`);
  assert.ok(Number.isInteger(bom.version) && bom.version >= 1, `${platform} SBOM has an invalid document version.`);
  assert.equal("serialNumber" in bom, false, `${platform} SBOM retains a nondeterministic serial number.`);
  assertPlainObject(bom.metadata, `${platform} SBOM metadata`);
  assert.equal("timestamp" in bom.metadata, false, `${platform} SBOM retains a nondeterministic timestamp.`);
  assertPlainObject(bom.metadata.component, `${platform} SBOM root component`);

  const expectedRoot = expectedRootComponent(platform, version);
  for (const [field, expected] of Object.entries(expectedRoot)) {
    assert.equal(bom.metadata.component[field], expected, `${platform} SBOM root ${field} is incorrect.`);
  }
  const rootRef = bom.metadata.component["bom-ref"];
  assert.ok(typeof rootRef === "string" && rootRef !== "", `${platform} SBOM root component needs a bom-ref.`);

  assert.ok(Array.isArray(bom.components) && bom.components.length > 0, `${platform} SBOM has no components.`);
  const knownRefs = new Set([rootRef]);
  for (const component of bom.components) {
    assertPlainObject(component, `${platform} SBOM component`);
    const reference = component["bom-ref"];
    assert.ok(typeof reference === "string" && reference !== "", `${platform} SBOM component needs a bom-ref.`);
    assert.equal(knownRefs.has(reference), false, `${platform} SBOM repeats bom-ref ${reference}.`);
    assert.ok(typeof component.name === "string" && component.name !== "", `${platform} SBOM component needs a name.`);
    assert.ok(typeof component.version === "string" && component.version !== "", `${platform} SBOM component needs a version.`);
    knownRefs.add(reference);
  }

  assert.ok(Array.isArray(bom.dependencies) && bom.dependencies.length > 0, `${platform} SBOM has no dependency graph.`);
  const dependencyRefs = new Set();
  for (const dependency of bom.dependencies) {
    assertPlainObject(dependency, `${platform} SBOM dependency`);
    assert.ok(knownRefs.has(dependency.ref), `${platform} SBOM dependency has unknown ref ${dependency.ref}.`);
    assert.equal(dependencyRefs.has(dependency.ref), false, `${platform} SBOM repeats dependency ref ${dependency.ref}.`);
    assert.ok(Array.isArray(dependency.dependsOn), `${platform} SBOM dependency ${dependency.ref} lacks dependsOn.`);
    const targets = new Set();
    for (const target of dependency.dependsOn) {
      assert.ok(knownRefs.has(target), `${platform} SBOM dependency points to unknown ref ${target}.`);
      assert.equal(targets.has(target), false, `${platform} SBOM dependency ${dependency.ref} repeats ${target}.`);
      targets.add(target);
    }
    dependencyRefs.add(dependency.ref);
  }
  assert.ok(dependencyRefs.has(rootRef), `${platform} SBOM graph does not contain the root component.`);
}

export function normalizeCycloneDx(rawBom, { platform, version }) {
  assertPlainObject(rawBom, `${platform} SBOM`);
  const bom = structuredClone(rawBom);
  delete bom.serialNumber;
  assertPlainObject(bom.metadata, `${platform} SBOM metadata`);
  delete bom.metadata.timestamp;
  if (platform === "web") {
    bom.metadata.component.name = "integradraw-web";
    bom.metadata.component.type = "application";
  }
  const normalized = canonicalize(bom);
  validateCycloneDx(normalized, { platform, version });
  return `${JSON.stringify(normalized, null, 2)}\n`;
}

export function normalizeJavaDependencyEvidence(text, version) {
  const normalized = `${text.replace(/\r\n?/g, "\n").trim()}\n`;
  assert.ok(
    normalized.split("\n").some((line) => line.trim() === `com.planck:integradraw:jar:${version}`),
    "Java dependency evidence does not identify this build.",
  );
  assert.ok(normalized.includes(":runtime"), "Java dependency evidence has no runtime dependency entries.");
  return normalized;
}

function normalizeNpmDependencyNode(node, label) {
  assertPlainObject(node, label);
  assert.ok(typeof node.version === "string" && node.version !== "", `${label} needs a version.`);
  const normalized = Object.fromEntries(
    Object.entries(node)
      .filter(([key]) => key !== "dependencies")
      .map(([key, value]) => [key, structuredClone(value)]),
  );
  if (node.dependencies === undefined) return normalized;
  assertPlainObject(node.dependencies, `${label} dependencies`);
  const dependencies = {};
  for (const [name, dependency] of Object.entries(node.dependencies)) {
    assertPlainObject(dependency, `npm dependency ${name}`);
    // npm represents optional packages unavailable on the current platform as
    // empty objects. They are not installed and therefore are not evidence.
    if (Object.keys(dependency).length === 0) continue;
    const identity = `${name}@${dependency.version}`;
    dependencies[name] = normalizeNpmDependencyNode(dependency, `npm dependency ${identity}`);
  }
  if (Object.keys(dependencies).length > 0) normalized.dependencies = dependencies;
  return normalized;
}

export function normalizeWebDependencyEvidence(rawEvidence, version) {
  assertPlainObject(rawEvidence, "Web dependency evidence");
  assert.equal(rawEvidence.name, "integradraw-web", "Web dependency evidence has the wrong project name.");
  assert.equal(rawEvidence.version, version, "Web dependency evidence has the wrong project version.");
  assert.equal(rawEvidence.problems, undefined, "Web dependency evidence reports package-tree problems.");
  const normalized = normalizeNpmDependencyNode(rawEvidence, "Web dependency evidence root");
  return `${JSON.stringify(canonicalize(normalized), null, 2)}\n`;
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

function expectedReleaseMetadata(metadata, sourceCommit) {
  const { version, releaseDate, sourceDateEpoch } = metadata;
  return {
    schemaVersion: 2,
    project: "IntegraDraw",
    version,
    tag: `v${version}`,
    releaseDate,
    sourceDateEpoch,
    sourceCommit,
    reproducible: true,
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
}

export async function buildFileInventory(directory, { exclude = [] } = {}) {
  const excluded = new Set(exclude);
  const inventory = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
    compareText(left.name, right.name),
  )) {
    assert.equal(entry.isSymbolicLink(), false, `Release inventory cannot contain a symbolic link: ${entry.name}`);
    assert.ok(entry.isFile(), `Release inventory can contain only files: ${entry.name}`);
    assert.ok(archivePathIsSafe(entry.name) && !entry.name.includes("/"), `Unsafe release asset name: ${entry.name}`);
    if (excluded.has(entry.name)) continue;
    const file = resolve(directory, entry.name);
    const details = await stat(file);
    inventory.push({ name: entry.name, size: details.size, digest: `sha256:${await sha256File(file)}` });
  }
  return inventory;
}

export function checksumText(inventory) {
  return `${inventory.map(({ digest, name }) => `${digest.slice("sha256:".length)}  ${name}`).join("\n")}\n`;
}

export function parseChecksumText(text) {
  const trimmed = text.trim();
  assert.notEqual(trimmed, "", "SHA256SUMS is empty.");
  return trimmed.split(/\r?\n/).map((line) => {
    const match = line.match(checksumLinePattern);
    assert.ok(match, `Malformed SHA256SUMS entry: ${line}`);
    return { digest: `sha256:${match[1]}`, name: match[2] };
  });
}

export async function assembleReleaseBundle({
  root = repositoryRoot,
  outputDirectory,
  sourceCommit,
  metadata,
  webArchive,
  javaSbom,
  webSbom,
  javaDependencies,
  webDependencies,
}) {
  assert.match(sourceCommit, sourceCommitPattern, "Source commit must be a lowercase 40-character SHA.");
  const output = resolve(outputDirectory);
  await mkdir(output, { recursive: true });
  assert.equal((await readdir(output)).length, 0, `Release output directory is not empty: ${output}`);
  const { version } = metadata;

  const inputs = new Map([
    [`integradraw-${version}.jar`, resolve(root, `target/integradraw-${version}.jar`)],
    [`integradraw-java-${version}.cdx.json`, resolve(javaSbom)],
    [`integradraw-java-dependencies-${version}.txt`, resolve(javaDependencies)],
    [`integradraw-web-${version}.cdx.json`, resolve(webSbom)],
    [`integradraw-web-${version}.zip`, resolve(webArchive)],
    [`integradraw-web-dependencies-${version}.json`, resolve(webDependencies)],
  ]);
  for (const [name, source] of inputs) {
    assert.ok((await stat(source)).isFile(), `Release input is not a file: ${relative(root, source)}`);
    await copyFile(source, confinedPath(output, name));
  }

  await writeFile(resolve(output, "SOURCE_COMMIT"), `${sourceCommit}\n`, "utf8");
  await writeFile(
    resolve(output, "release-metadata.json"),
    `${JSON.stringify(expectedReleaseMetadata(metadata, sourceCommit), null, 2)}\n`,
    "utf8",
  );
  const inventory = await buildFileInventory(output);
  await writeFile(resolve(output, "SHA256SUMS"), checksumText(inventory), "utf8");
  await validateReleaseBundle({ directory: output, metadata, sourceCommit });
}

export async function validateReleaseBundle({ directory, metadata, sourceCommit }) {
  assert.match(sourceCommit, sourceCommitPattern, "Source commit must be a lowercase 40-character SHA.");
  const { version, releaseDate } = metadata;
  assert.match(version, stableVersionPattern, "Release bundle version must be stable.");
  const expectedNames = releaseFileNames(version);
  const inventory = await buildFileInventory(directory, { exclude: ["SHA256SUMS"] });
  assert.deepEqual(
    inventory.map(({ name }) => name),
    expectedNames,
    "Release bundle contains missing, stale, or unexpected files.",
  );
  const checksums = parseChecksumText(await readFile(resolve(directory, "SHA256SUMS"), "utf8"));
  assert.deepEqual(checksums, inventory.map(({ name, digest }) => ({ name, digest })), "SHA256SUMS does not match the bundle inventory.");
  assert.equal(await readFile(resolve(directory, "SOURCE_COMMIT"), "utf8"), `${sourceCommit}\n`);

  const releaseMetadata = JSON.parse(await readFile(resolve(directory, "release-metadata.json"), "utf8"));
  assert.deepEqual(releaseMetadata, expectedReleaseMetadata(metadata, sourceCommit));
  await validateExecutableJar(resolve(directory, `integradraw-${version}.jar`), version);
  await validateStaticWebArchive(resolve(directory, `integradraw-web-${version}.zip`), releaseDate);

  for (const platform of ["java", "web"]) {
    const sbom = JSON.parse(
      await readFile(resolve(directory, `integradraw-${platform}-${version}.cdx.json`), "utf8"),
    );
    validateCycloneDx(sbom, { platform, version });
  }
  normalizeJavaDependencyEvidence(
    await readFile(resolve(directory, `integradraw-java-dependencies-${version}.txt`), "utf8"),
    version,
  );
  normalizeWebDependencyEvidence(
    JSON.parse(await readFile(resolve(directory, `integradraw-web-dependencies-${version}.json`), "utf8")),
    version,
  );
}

export async function compareReleaseBundles(leftDirectory, rightDirectory) {
  const [left, right] = await Promise.all([
    buildFileInventory(leftDirectory),
    buildFileInventory(rightDirectory),
  ]);
  assert.deepEqual(right, left, "Independent release builds are not bit-for-bit identical.");
  return left;
}

export function verifyRemoteAssetInventory(localInventory, remoteAssets) {
  assert.ok(Array.isArray(remoteAssets), "GitHub Release assets must be an array.");
  const normalizedRemote = remoteAssets
    .map((asset) => {
      assertPlainObject(asset, "GitHub Release asset");
      assert.ok(typeof asset.name === "string", "GitHub Release asset is missing its name.");
      assert.match(String(asset.digest), /^sha256:[0-9a-f]{64}$/, `GitHub Release asset ${asset.name} lacks a SHA-256 digest.`);
      assert.ok(Number.isInteger(asset.size) && asset.size >= 0, `GitHub Release asset ${asset.name} has an invalid size.`);
      return { name: asset.name, size: asset.size, digest: asset.digest };
    })
    .sort((left, right) => compareText(left.name, right.name));
  assert.deepEqual(normalizedRemote, localInventory, "GitHub Release assets do not match the verified local inventory.");
}

function defaultRunProcess(command, args, options = {}) {
  const capture = options.capture ?? false;
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: maxProcessBuffer,
    shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command),
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.\n${result.stderr ?? ""}`);
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function executable(root, name) {
  if (name === "maven") return resolve(root, process.platform === "win32" ? "mvnw.cmd" : "mvnw");
  return name;
}

function npmInvocation(environment = process.env) {
  const candidates = [
    environment.npm_execpath,
    ...(environment.PATH ?? environment.Path ?? "")
      .split(delimiter)
      .filter(Boolean)
      .flatMap((directory) => [
        resolve(directory, "npm-cli.js"),
        resolve(directory, "node_modules/npm/bin/npm-cli.js"),
        resolve(directory, "../lib/node_modules/npm/bin/npm-cli.js"),
      ]),
  ].filter(Boolean);
  const cli = candidates.find((candidate) => existsSync(candidate));
  if (cli) return { command: process.execPath, prefix: [cli] };
  return { command: process.platform === "win32" ? "npm.cmd" : "npm", prefix: [] };
}

export async function assertRepositoryRef({
  root = repositoryRoot,
  sourceCommit,
  tag,
  defaultBranch,
  runProcess = defaultRunProcess,
}) {
  const head = runProcess("git", ["rev-parse", "HEAD"], { cwd: root, capture: true }).stdout.trim();
  assert.equal(head, sourceCommit, "Recorded source commit does not match the checked-out commit.");
  if (tag === undefined || tag === "") return;
  assert.ok(defaultBranch, "A tag build requires the default-branch ref.");
  const tagCommit = runProcess("git", ["rev-parse", `${tag}^{commit}`], { cwd: root, capture: true }).stdout.trim();
  assert.equal(tagCommit, sourceCommit, "Release tag does not identify the checked-out commit.");
  const ancestry = runProcess("git", ["merge-base", "--is-ancestor", sourceCommit, defaultBranch], {
    cwd: root,
    capture: true,
    allowFailure: true,
  });
  assert.equal(ancestry.status, 0, "Release commit is not contained in the default branch.");
}

export async function validateDesktopArtifact({
  root = repositoryRoot,
  metadata,
  environment = process.env,
  runProcess = defaultRunProcess,
} = {}) {
  const resolvedMetadata = metadata ?? await validateReleaseMetadata({ root });
  const jarPath = resolve(root, `target/integradraw-${resolvedMetadata.version}.jar`);
  await validateExecutableJar(jarPath, resolvedMetadata.version);
  const smoke = runProcess("java", ["-Djava.awt.headless=true", "-jar", jarPath, "--version"], {
    cwd: root,
    env: environment,
    capture: true,
  });
  assert.equal(
    smoke.stdout.trim(),
    `IntegraDraw ${resolvedMetadata.version}`,
    "Executable JAR smoke output is incorrect.",
  );
  return resolvedMetadata;
}

export async function buildReleaseCandidate({
  root = repositoryRoot,
  outputDirectory,
  sourceCommit,
  tag,
  expectedTag,
  defaultBranch,
  githubOutput,
  runProcess = defaultRunProcess,
}) {
  assert.ok(!(tag && expectedTag && tag !== expectedTag), "Actual and expected release tags disagree.");
  const metadata = await validateReleaseMetadata({ root, tag: tag || expectedTag || undefined });
  await assertRepositoryRef({ root, sourceCommit, tag, defaultBranch, runProcess });
  if (githubOutput) await appendFile(githubOutput, `version=${metadata.version}\n`, "utf8");

  const buildEnvironment = {
    ...process.env,
    SOURCE_DATE_EPOCH: String(metadata.sourceDateEpoch),
    TZ: "UTC",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    JAVA_TOOL_OPTIONS: "-Duser.language=en -Duser.country=US -Dfile.encoding=UTF-8",
  };
  const maven = executable(root, "maven");
  const npm = npmInvocation(buildEnvironment);
  runProcess(maven, ["--batch-mode", "--no-transfer-progress", "clean", "verify"], {
    cwd: root,
    env: buildEnvironment,
  });
  await validateDesktopArtifact({ root, metadata, environment: buildEnvironment, runProcess });

  const javaDependencyPath = resolve(root, "target/java-dependencies.txt");
  runProcess(
    maven,
    [
      "--batch-mode",
      "--no-transfer-progress",
      "org.apache.maven.plugins:maven-dependency-plugin:3.9.0:tree",
      "-Dscope=runtime",
      "-DoutputType=text",
      `-DoutputFile=${javaDependencyPath}`,
    ],
    { cwd: root, env: buildEnvironment },
  );
  const normalizedJavaDependencies = normalizeJavaDependencyEvidence(
    await readFile(javaDependencyPath, "utf8"),
    metadata.version,
  );
  await writeFile(javaDependencyPath, normalizedJavaDependencies, "utf8");

  const webRoot = resolve(root, "web");
  runProcess(npm.command, [...npm.prefix, "ci"], { cwd: webRoot, env: buildEnvironment });
  runProcess(npm.command, [...npm.prefix, "run", "check"], { cwd: webRoot, env: buildEnvironment });
  runProcess(npm.command, [...npm.prefix, "run", "build"], { cwd: webRoot, env: buildEnvironment });
  const npmSbom = runProcess(npm.command, [...npm.prefix, "sbom", "--sbom-format", "cyclonedx"], {
    cwd: webRoot,
    env: buildEnvironment,
    capture: true,
  });
  const npmDependencies = runProcess(npm.command, [...npm.prefix, "ls", "--all", "--json"], {
    cwd: webRoot,
    env: buildEnvironment,
    capture: true,
  });

  const webTarget = resolve(webRoot, "target");
  await mkdir(webTarget, { recursive: true });
  const javaSbomPath = resolve(root, "target/normalized-java.cdx.json");
  const webSbomPath = resolve(webTarget, "normalized-web.cdx.json");
  const webDependencyPath = resolve(webTarget, "npm-dependencies.json");
  await writeFile(
    javaSbomPath,
    normalizeCycloneDx(JSON.parse(await readFile(resolve(root, "target/bom.json"), "utf8")), {
      platform: "java",
      version: metadata.version,
    }),
    "utf8",
  );
  await writeFile(
    webSbomPath,
    normalizeCycloneDx(JSON.parse(npmSbom.stdout), { platform: "web", version: metadata.version }),
    "utf8",
  );
  await writeFile(
    webDependencyPath,
    normalizeWebDependencyEvidence(JSON.parse(npmDependencies.stdout), metadata.version),
    "utf8",
  );

  const webArchive = resolve(root, `target/integradraw-web-${metadata.version}.zip`);
  await createDeterministicZip({
    inputDirectory: resolve(webRoot, "dist"),
    outputFile: webArchive,
    releaseDate: metadata.releaseDate,
  });
  await validateStaticWebArchive(webArchive, metadata.releaseDate);
  await assembleReleaseBundle({
    root,
    outputDirectory,
    sourceCommit,
    metadata,
    webArchive,
    javaSbom: javaSbomPath,
    webSbom: webSbomPath,
    javaDependencies: javaDependencyPath,
    webDependencies: webDependencyPath,
  });
  return metadata;
}

export async function publishRelease({
  directory,
  tag,
  repository,
  metadata,
  runProcess = defaultRunProcess,
}) {
  assert.match(repository, repositoryPattern, "GitHub repository must use owner/name form.");
  assert.equal(tag, `v${metadata.version}`, "Publication tag does not match the release version.");
  const sourceCommit = (await readFile(resolve(directory, "SOURCE_COMMIT"), "utf8")).trim();
  await validateReleaseBundle({ directory, metadata, sourceCommit });
  const inventory = await buildFileInventory(directory);
  const assetPaths = inventory.map(({ name }) => resolve(directory, name));

  runProcess(
    "gh",
    [
      "release",
      "create",
      tag,
      ...assetPaths,
      "--repo",
      repository,
      "--draft",
      "--verify-tag",
      "--title",
      `IntegraDraw ${metadata.version}`,
      "--generate-notes",
    ],
    { capture: true },
  );
  const response = runProcess(
    "gh",
    ["api", `repos/${repository}/releases/tags/${tag}`],
    { capture: true },
  );
  const remoteRelease = JSON.parse(response.stdout);
  assert.equal(remoteRelease.draft, true, "GitHub Release must remain a draft during verification.");
  assert.equal(remoteRelease.tag_name, tag, "GitHub Release returned the wrong tag.");
  verifyRemoteAssetInventory(inventory, remoteRelease.assets);
  runProcess("gh", ["release", "edit", tag, "--repo", repository, "--draft=false"], { capture: true });
}

export { defaultRunProcess };
