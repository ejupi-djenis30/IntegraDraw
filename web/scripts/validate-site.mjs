import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

function isNodeError(error) {
  return error instanceof Error && "code" in error;
}

export async function readRequiredFile(fileUrl, label) {
  try {
    return await readFile(fileUrl);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      const missingFileError = new Error(`Required site file is missing: ${label}`, { cause: error });
      missingFileError.code = "ENOENT";
      throw missingFileError;
    }

    throw error;
  }
}

export function validateMobileHeaderLinkTarget(styles) {
  const mobileHeaderLink = styles.match(
    /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.header-link\s*\{([^}]*)\}/,
  );
  assert.ok(mobileHeaderLink, "Mobile CSS must define a .header-link rule at 560px.");

  const declarations = mobileHeaderLink[1];
  assert.match(declarations, /display:\s*inline-flex\s*;/, "Mobile Source link must expose a box target.");
  assert.match(declarations, /min-height:\s*44px\s*;/, "Mobile Source link target must be at least 44px tall.");
  assert.match(declarations, /align-items:\s*center\s*;/, "Mobile Source link text must remain vertically centred.");
}

async function readRequiredText(fileUrl, label) {
  return (await readRequiredFile(fileUrl, label)).toString("utf8");
}

export async function validateSite(siteRoot = root) {
  const html = await readRequiredText(new URL("index.html", siteRoot), "index.html");
  const config = await readRequiredText(new URL("vite.config.ts", siteRoot), "vite.config.ts");
  const styles = await readRequiredText(new URL("src/styles.css", siteRoot), "src/styles.css");

  for (const file of ["public/brand-mark.svg", "public/favicon.svg"]) {
    await readRequiredFile(new URL(file, siteRoot), file);
  }

  for (const token of [
    '<html lang="en">',
    'name="referrer" content="no-referrer"',
    'http-equiv="Content-Security-Policy"',
    '<link rel="canonical" href="https://ejupi-djenis30.github.io/IntegraDraw/" />',
    'property="og:url" content="https://ejupi-djenis30.github.io/IntegraDraw/"',
    'content="https://ejupi-djenis30.github.io/IntegraDraw/social-preview.png"',
    'property="og:image:type" content="image/png"',
    'name="twitter:card" content="summary_large_image"',
    'name="twitter:title" content="IntegraDraw — See an integral take shape"',
    'name="twitter:description" content="A visual calculus workbench rebuilt from a collaborative Java prototype."',
    'name="twitter:image:alt" content="IntegraDraw visual calculus workbench"',
    "<main",
    "aria-label",
  ]) {
    assert.ok(html.includes(token), `index.html is missing ${token}`);
  }

  assert.ok(config.includes('base: "/IntegraDraw/"'), "Vite must retain the project Pages base path.");
  validateMobileHeaderLinkTarget(styles);

  const socialPreview = await readRequiredFile(
    new URL("public/social-preview.png", siteRoot),
    "public/social-preview.png",
  );
  assert.ok(socialPreview.byteLength <= 1_000_000, "Keep the social preview below 1 MB.");
  assert.equal(
    socialPreview.subarray(1, 4).toString("ascii"),
    "PNG",
    "The social preview is not a PNG file.",
  );

}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  await validateSite();
  console.log("IntegraDraw site validation passed.");
}
