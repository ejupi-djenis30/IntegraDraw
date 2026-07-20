import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildReleaseCandidate,
  compareReleaseBundles,
  publishRelease,
  validateDesktopArtifact,
  validateReleaseBundle,
  validateReleaseMetadata,
} from "./release-core.mjs";

const commands = new Set(["metadata", "desktop", "build", "verify", "compare", "publish"]);
const optionsWithOptionalEmptyValues = new Set(["--tag", "--expected-tag", "--default-branch"]);

function parseArguments(args) {
  const command = args[0];
  assert.ok(commands.has(command), `Unknown release command: ${command ?? "<missing>"}`);
  const options = new Map();
  for (let index = 1; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    assert.ok(name?.startsWith("--"), `Expected an option, received: ${name ?? "<missing>"}`);
    assert.ok(value !== undefined, `${name} requires a value.`);
    assert.ok(value !== "" || optionsWithOptionalEmptyValues.has(name), `${name} cannot be empty.`);
    assert.equal(options.has(name), false, `Option supplied more than once: ${name}`);
    options.set(name, value);
  }
  return { command, options };
}

function requireOption(options, name) {
  const value = options.get(name);
  assert.ok(value, `${name} is required.`);
  return value;
}

function optionalOption(options, name) {
  return options.get(name) || undefined;
}

function assertOnlyOptions(options, allowed) {
  for (const name of options.keys()) assert.ok(allowed.includes(name), `Unknown option: ${name}`);
}

async function run(argv) {
  const { command, options } = parseArguments(argv);
  const tag = optionalOption(options, "--tag");

  if (command === "metadata") {
    assertOnlyOptions(options, ["--tag"]);
    const metadata = await validateReleaseMetadata({ tag });
    console.log(metadata.version);
    return;
  }

  if (command === "desktop") {
    assertOnlyOptions(options, []);
    const metadata = await validateDesktopArtifact();
    console.log(`IntegraDraw ${metadata.version} desktop artifact verified.`);
    return;
  }

  if (command === "build") {
    assertOnlyOptions(options, [
      "--output",
      "--commit",
      "--tag",
      "--expected-tag",
      "--default-branch",
      "--github-output",
    ]);
    const metadata = await buildReleaseCandidate({
      outputDirectory: requireOption(options, "--output"),
      sourceCommit: requireOption(options, "--commit"),
      tag,
      expectedTag: optionalOption(options, "--expected-tag"),
      defaultBranch: optionalOption(options, "--default-branch"),
      githubOutput: optionalOption(options, "--github-output"),
    });
    console.log(`IntegraDraw ${metadata.version} release candidate validated.`);
    return;
  }

  const directory = requireOption(options, "--directory");
  const sourceCommit = requireOption(options, "--commit");
  const metadata = await validateReleaseMetadata({ tag });

  if (command === "verify") {
    assertOnlyOptions(options, ["--directory", "--commit", "--tag"]);
    await validateReleaseBundle({ directory, metadata, sourceCommit });
    console.log(`IntegraDraw ${metadata.version} release candidate verified.`);
    return;
  }

  if (command === "compare") {
    assertOnlyOptions(options, ["--directory", "--other-directory", "--commit", "--tag"]);
    const otherDirectory = requireOption(options, "--other-directory");
    await Promise.all([
      validateReleaseBundle({ directory, metadata, sourceCommit }),
      validateReleaseBundle({ directory: otherDirectory, metadata, sourceCommit }),
    ]);
    await compareReleaseBundles(directory, otherDirectory);
    console.log(`IntegraDraw ${metadata.version} independent builds are bit-for-bit identical.`);
    return;
  }

  assert.equal(command, "publish");
  assertOnlyOptions(options, ["--directory", "--commit", "--tag", "--repository"]);
  assert.ok(tag, "--tag is required for publication.");
  await validateReleaseBundle({ directory, metadata, sourceCommit });
  await publishRelease({
    directory,
    tag,
    repository: requireOption(options, "--repository"),
    metadata,
  });
  console.log(`IntegraDraw ${metadata.version} GitHub Release published.`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) await run(process.argv.slice(2));

export { parseArguments, run };
