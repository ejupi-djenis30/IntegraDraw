import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { readRequiredFile, validateMobileHeaderLinkTarget } from "./validate-site.mjs";

const temporaryDirectories = [];

async function createTemporaryRoot() {
  const directory = await mkdtemp(join(tmpdir(), "integradraw-validator-"));
  temporaryDirectories.push(directory);
  return pathToFileURL(`${directory}${sep}`);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("site validator file reads", () => {
  it("reads a required file directly", async () => {
    const root = await createTemporaryRoot();
    const assetUrl = new URL("asset.bin", root);
    await writeFile(assetUrl, Buffer.from("fixture"));

    await expect(readRequiredFile(assetUrl, "asset.bin")).resolves.toEqual(Buffer.from("fixture"));
  });

  it("reports a missing required file as ENOENT with its site-relative name", async () => {
    const root = await createTemporaryRoot();

    await expect(readRequiredFile(new URL("missing.png", root), "public/missing.png")).rejects.toMatchObject({
      code: "ENOENT",
      message: "Required site file is missing: public/missing.png",
      cause: { code: "ENOENT" },
    });
  });

  it("preserves non-ENOENT filesystem errors", async () => {
    const root = await createTemporaryRoot();
    const directoryUrl = new URL("not-a-file/", root);
    await mkdir(directoryUrl);

    await expect(readRequiredFile(directoryUrl, "not-a-file")).rejects.toMatchObject({ code: "EISDIR" });
  });
});

describe("mobile header accessibility", () => {
  it("accepts a visually compact 44px Source target", () => {
    const styles = `
      @media (max-width: 560px) {
        .header-link {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          font-size: 0.68rem;
        }
      }
    `;

    expect(() => validateMobileHeaderLinkTarget(styles)).not.toThrow();
  });

  it("rejects an undersized Source target", () => {
    const styles = `
      @media (max-width: 560px) {
        .header-link {
          display: inline-flex;
          min-height: 24px;
          align-items: center;
        }
      }
    `;

    expect(() => validateMobileHeaderLinkTarget(styles)).toThrow(/at least 44px tall/);
  });
});
