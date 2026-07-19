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

async function readRequiredText(fileUrl, label) {
  return (await readRequiredFile(fileUrl, label)).toString("utf8");
}

export async function validateSite(siteRoot = root) {
  const html = await readRequiredText(new URL("index.html", siteRoot), "index.html");
  const config = await readRequiredText(new URL("vite.config.ts", siteRoot), "vite.config.ts");

  for (const file of ["public/brand-mark.svg", "public/favicon.svg", "public/poster.svg"]) {
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
    "<video",
    'poster="./poster.svg"',
    'src="./integradraw-demo.mp4"',
    "aria-label",
  ]) {
    assert.ok(html.includes(token), `index.html is missing ${token}`);
  }

  assert.ok(config.includes('base: "/IntegraDraw/"'), "Vite must retain the project Pages base path.");

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

  const video = await readRequiredFile(
    new URL("public/integradraw-demo.mp4", siteRoot),
    "public/integradraw-demo.mp4",
  );
  assert.ok(video.byteLength >= 250_000, "The demo video is unexpectedly small.");
  assert.ok(video.byteLength <= 8_000_000, "Keep the demo video below 8 MB for a fast Page load.");
  assert.equal(video.subarray(4, 8).toString("ascii"), "ftyp", "The demo asset is not an MP4 file.");
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  await validateSite();
  console.log("IntegraDraw site validation passed.");
}
