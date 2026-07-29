import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  readRequiredFile,
  validateDiscoveryDocuments,
  validateFailOpenRevealStyles,
  validateMobileHeaderLinkTarget,
} from "./validate-site.mjs";

const temporaryDirectories = [];

async function createTemporaryRoot() {
  const directory = await mkdtemp(join(tmpdir(), "integradraw-validator-"));
  temporaryDirectories.push(directory);
  return pathToFileURL(`${directory}${sep}`);
}

async function writeDiscoveryDocuments(root, overrides = {}) {
  const documents = {
    ".nojekyll": "",
    "robots.txt": [
      "User-agent: *",
      "Allow: /IntegraDraw/",
      "Sitemap: https://ejupi-djenis30.github.io/IntegraDraw/sitemap.xml",
      "",
    ].join("\n"),
    "sitemap.xml": [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url>",
      "    <loc>https://ejupi-djenis30.github.io/IntegraDraw/</loc>",
      "  </url>",
      "</urlset>",
      "",
    ].join("\n"),
    ".well-known/security.txt": [
      "Contact: https://github.com/ejupi-djenis30/IntegraDraw/security/advisories/new",
      "Expires: 2030-07-31T23:59:59Z",
      "Preferred-Languages: en",
      "Canonical: https://ejupi-djenis30.github.io/IntegraDraw/.well-known/security.txt",
      "Policy: https://github.com/ejupi-djenis30/IntegraDraw/security/policy",
      "",
    ].join("\n"),
    ...overrides,
  };

  await mkdir(new URL(".well-known/", root), { recursive: true });
  await Promise.all(
    Object.entries(documents).map(([file, contents]) => writeFile(new URL(file, root), contents)),
  );
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

describe("project Pages discovery contract", () => {
  it("accepts canonical project-scoped discovery documents", async () => {
    const root = await createTemporaryRoot();
    await writeDiscoveryDocuments(root);

    await expect(
      validateDiscoveryDocuments(root, new Date("2026-07-29T00:00:00Z")),
    ).resolves.toBeUndefined();
  });

  it("rejects a wrong base path and an email security contact", async () => {
    const wrongPathRoot = await createTemporaryRoot();
    await writeDiscoveryDocuments(wrongPathRoot, {
      "robots.txt": [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://ejupi-djenis30.github.io/sitemap.xml",
        "",
      ].join("\n"),
    });
    await expect(validateDiscoveryDocuments(wrongPathRoot)).rejects.toThrow(/project Pages scope/);

    const emailRoot = await createTemporaryRoot();
    await writeDiscoveryDocuments(emailRoot, {
      ".well-known/security.txt": [
        "Contact: mailto:person@example.test",
        "Expires: 2030-07-31T23:59:59Z",
        "Preferred-Languages: en",
        "Canonical: https://ejupi-djenis30.github.io/IntegraDraw/.well-known/security.txt",
        "Policy: https://github.com/ejupi-djenis30/IntegraDraw/security/policy",
        "",
      ].join("\n"),
    });
    await expect(validateDiscoveryDocuments(emailRoot)).rejects.toThrow(
      /private vulnerability reporting/,
    );
  });

  it("rejects a missing Pages marker, missing security metadata and expired security metadata", async () => {
    const missingMarkerRoot = await createTemporaryRoot();
    await writeDiscoveryDocuments(missingMarkerRoot);
    await rm(new URL(".nojekyll", missingMarkerRoot));
    await expect(validateDiscoveryDocuments(missingMarkerRoot)).rejects.toMatchObject({
      code: "ENOENT",
      message: "Required site file is missing: .nojekyll",
    });

    const missingRoot = await createTemporaryRoot();
    await writeDiscoveryDocuments(missingRoot);
    await rm(new URL(".well-known/security.txt", missingRoot));
    await expect(validateDiscoveryDocuments(missingRoot)).rejects.toMatchObject({
      code: "ENOENT",
      message: "Required site file is missing: .well-known/security.txt",
    });

    const expiredRoot = await createTemporaryRoot();
    await writeDiscoveryDocuments(expiredRoot, {
      ".well-known/security.txt": [
        "Contact: https://github.com/ejupi-djenis30/IntegraDraw/security/advisories/new",
        "Expires: 2025-07-31T23:59:59Z",
        "Preferred-Languages: en",
        "Canonical: https://ejupi-djenis30.github.io/IntegraDraw/.well-known/security.txt",
        "Policy: https://github.com/ejupi-djenis30/IntegraDraw/security/policy",
        "",
      ].join("\n"),
    });
    await expect(
      validateDiscoveryDocuments(expiredRoot, new Date("2026-07-29T00:00:00Z")),
    ).rejects.toThrow(/future expiration/);
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

describe("fail-open reveal styles", () => {
  const enhancedStyles = `
    .reveal {
      opacity: 1;
      transform: none;
    }

    :where(.reveal-enabled) .reveal {
      opacity: 0;
      transform: translateY(24px);
    }

    :where(.reveal-enabled) .reveal.is-visible {
      opacity: 1;
      transform: none;
    }
  `;

  it("accepts a progressively enhanced reveal contract", () => {
    expect(() => validateFailOpenRevealStyles(enhancedStyles)).not.toThrow();
  });

  it("rejects content hidden before JavaScript initializes", () => {
    const hiddenByDefault = enhancedStyles.replace("opacity: 1;", "opacity: 0;");

    expect(() => validateFailOpenRevealStyles(hiddenByDefault)).toThrow(/visible before JavaScript/);
  });

  it("rejects an unscoped animated state", () => {
    const unscoped = enhancedStyles.replace(":where(.reveal-enabled) .reveal {", ".reveal {");

    expect(() => validateFailOpenRevealStyles(unscoped)).toThrow(/progressive enhancement/);
  });
});
