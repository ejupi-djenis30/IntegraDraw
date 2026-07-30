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

export function validateFailOpenRevealStyles(styles) {
  const defaultReveal = styles.match(/^\s*\.reveal\s*\{([^}]*)\}/m);
  assert.ok(defaultReveal, "CSS must define a default .reveal rule.");
  assert.match(defaultReveal[1], /opacity:\s*1\s*;/, "Reveal content must be visible before JavaScript runs.");
  assert.match(defaultReveal[1], /transform:\s*none\s*;/, "Reveal content must keep its layout before JavaScript runs.");

  const enhancedReveal = styles.match(/:where\(\.reveal-enabled\)\s+\.reveal\s*\{([^}]*)\}/);
  assert.ok(enhancedReveal, "CSS must scope the hidden reveal state to progressive enhancement.");
  assert.match(enhancedReveal[1], /opacity:\s*0\s*;/, "Enhanced reveal content must retain the entrance animation.");

  const visibleReveal = styles.match(/:where\(\.reveal-enabled\)\s+\.reveal\.is-visible\s*\{([^}]*)\}/);
  assert.ok(visibleReveal, "CSS must expose observed reveal content.");
  assert.match(visibleReveal[1], /opacity:\s*1\s*;/, "Observed reveal content must become visible.");
}

export function validateReleaseCta(html, styles) {
  const latestReleaseUrl = "https://github.com/ejupi-djenis30/IntegraDraw/releases/latest";
  const releaseLink = html.match(
    /<a\s+class="text-link release-link"\s+href="([^"]+)"\s+aria-label="([^"]+)"\s*>[\s\S]*?<\/a>/,
  );
  assert.ok(releaseLink, "The hero must expose a dedicated latest desktop release link.");
  assert.equal(
    releaseLink[1],
    latestReleaseUrl,
    "The desktop CTA must point to GitHub's stable latest-release route.",
  );
  assert.equal(
    releaseLink[2],
    "Open the latest IntegraDraw desktop release on GitHub",
    "The release CTA must describe its external destination.",
  );
  assert.match(
    releaseLink[0],
    /Get the desktop release/,
    "The release CTA must use a direct, honest visible label.",
  );

  const releaseStyles = styles.match(/\.release-link\s*\{([^}]*)\}/);
  assert.ok(releaseStyles, "CSS must define the release CTA target.");
  assert.match(releaseStyles[1], /display:\s*inline-flex\s*;/, "The release CTA must expose a box target.");
  assert.match(releaseStyles[1], /min-height:\s*44px\s*;/, "The release CTA target must be at least 44px tall.");

  const mobileHeroLinks = styles.match(
    /@media\s*\(max-width:\s*560px\)\s*\{[\s\S]*?\.button,\s*\.text-link\s*\{([^}]*)\}/,
  );
  assert.ok(mobileHeroLinks, "Mobile CSS must define full-width hero actions at 560px.");
  assert.match(
    mobileHeroLinks[1],
    /width:\s*100%\s*;/,
    "The release CTA must remain full-width on narrow screens.",
  );
}

async function readRequiredText(fileUrl, label) {
  return (await readRequiredFile(fileUrl, label)).toString("utf8");
}

export async function validateDiscoveryDocuments(documentRoot, now = new Date()) {
  const [noJekyll, robots, sitemap, security] = await Promise.all([
    readRequiredFile(new URL(".nojekyll", documentRoot), ".nojekyll"),
    readRequiredText(new URL("robots.txt", documentRoot), "robots.txt"),
    readRequiredText(new URL("sitemap.xml", documentRoot), "sitemap.xml"),
    readRequiredText(
      new URL(".well-known/security.txt", documentRoot),
      ".well-known/security.txt",
    ),
  ]);
  const siteUrl = "https://ejupi-djenis30.github.io/IntegraDraw/";

  assert.ok(
    noJekyll.byteLength <= 128,
    ".nojekyll must remain a marker file so GitHub Pages serves .well-known.",
  );
  assert.equal(
    robots,
    [
      "User-agent: *",
      "Allow: /IntegraDraw/",
      `Sitemap: ${siteUrl}sitemap.xml`,
      "",
    ].join("\n"),
    "robots.txt must retain IntegraDraw's project Pages scope and canonical sitemap URL.",
  );
  assert.equal(
    sitemap,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      "  <url>",
      `    <loc>${siteUrl}</loc>`,
      "  </url>",
      "</urlset>",
      "",
    ].join("\n"),
    "sitemap.xml must expose exactly IntegraDraw's canonical project Pages URL.",
  );

  const securityLines = security.split(/\r?\n/u);
  assert.doesNotMatch(
    security,
    /^Contact:\s*mailto:/imu,
    "security.txt must direct reports to GitHub private vulnerability reporting, not email.",
  );
  assert.doesNotMatch(
    security,
    /@[A-Za-z0-9.-]+/u,
    "security.txt must direct reports to GitHub private vulnerability reporting, not email.",
  );
  for (const line of [
    "Contact: https://github.com/ejupi-djenis30/IntegraDraw/security/advisories/new",
    "Preferred-Languages: en",
    `Canonical: ${siteUrl}.well-known/security.txt`,
    "Policy: https://github.com/ejupi-djenis30/IntegraDraw/security/policy",
  ]) {
    assert.ok(securityLines.includes(line), `security.txt is missing ${line}`);
  }
  const expiration = security.match(/^Expires:\s*(\S+)$/imu)?.[1];
  assert.ok(expiration, "security.txt must declare an expiration.");
  assert.ok(!Number.isNaN(Date.parse(expiration)), "security.txt expiration must be a valid timestamp.");
  assert.ok(
    Date.parse(expiration) > now.valueOf(),
    "security.txt must carry a future expiration.",
  );
}

export async function validateSite(siteRoot = root) {
  const html = await readRequiredText(new URL("index.html", siteRoot), "index.html");
  const config = await readRequiredText(new URL("vite.config.ts", siteRoot), "vite.config.ts");
  const styles = await readRequiredText(new URL("src/styles.css", siteRoot), "src/styles.css");

  for (const file of ["public/brand-mark.svg", "public/favicon.svg"]) {
    await readRequiredFile(new URL(file, siteRoot), file);
  }
  await validateDiscoveryDocuments(new URL("public/", siteRoot));

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
  validateFailOpenRevealStyles(styles);
  validateReleaseCta(html, styles);

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
