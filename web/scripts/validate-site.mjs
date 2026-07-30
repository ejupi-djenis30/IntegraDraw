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

function readClassPath(svg, className) {
  return svg.match(new RegExp(`<path\\s+class="${className}"\\s+d="([^"]+)"`))?.[1];
}

export function validateIntegralBrand(html, brandMark, favicon) {
  assert.equal(
    (html.match(/src="\.\/brand-mark\.svg"/gu) ?? []).length,
    2,
    "Header and footer must use the same IntegraDraw mark.",
  );
  assert.match(
    html,
    /<link rel="icon" href="\.\/favicon\.svg" type="image\/svg\+xml" \/>/,
    "The document must use the matching vector favicon.",
  );

  for (const [label, svg] of [
    ["brand mark", brandMark],
    ["favicon", favicon],
  ]) {
    assert.match(svg, /An integral curve framed by its upper and lower bounds\./, `${label} must describe the integral identity.`);
    assert.doesNotMatch(svg, /letters?\s+I\s+and\s+D/iu, `${label} must not restore the retired letter monogram.`);
    assert.ok(readClassPath(svg, "integral-stroke"), `${label} must contain the integral stroke.`);
    assert.ok(readClassPath(svg, "bound-marks"), `${label} must contain the two bound marks.`);
  }

  assert.equal(
    readClassPath(brandMark, "integral-stroke"),
    readClassPath(favicon, "integral-stroke"),
    "Brand mark and favicon must share the same integral geometry.",
  );
  assert.equal(
    readClassPath(brandMark, "bound-marks"),
    readClassPath(favicon, "bound-marks"),
    "Brand mark and favicon must share the same bound geometry.",
  );
}

export function validateSocialArtwork(socialArtwork, brandMark) {
  assert.match(
    socialArtwork,
    /<svg[^>]*\bwidth="1200"[^>]*\bheight="675"[^>]*\bviewBox="0 0 1200 675"/u,
    "Social artwork must retain the 1200×675 sharing canvas.",
  );
  assert.match(socialArtwork, />INTEGRADRAW</u, "Social artwork must carry the product name.");
  assert.doesNotMatch(
    socialArtwork,
    />\s*(?:JD|ID)\s*</u,
    "Social artwork must not restore a letter monogram.",
  );
  assert.equal(
    readClassPath(socialArtwork, "integral-stroke"),
    readClassPath(brandMark, "integral-stroke"),
    "Social artwork must reuse the public integral geometry.",
  );
  assert.equal(
    readClassPath(socialArtwork, "bound-marks"),
    readClassPath(brandMark, "bound-marks"),
    "Social artwork must reuse the public bound geometry.",
  );
}

function readRule(styles, selector, label) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `CSS must define ${label}.`);
  return match[1];
}

export function validateTouchTargetStyles(styles) {
  for (const [selector, label] of [
    [".skip-link", "the skip-link target"],
    [".brand", "the shared brand-link target"],
    ["footer > a:last-child", "the footer repository target"],
  ]) {
    const declarations = readRule(styles, selector, label);
    assert.match(declarations, /display:\s*inline-flex\s*;/, `${label} must expose a box target.`);
    assert.match(declarations, /align-items:\s*center\s*;/, `${label} must remain vertically centred.`);
    assert.match(declarations, /min-height:\s*44px\s*;/, `${label} must be at least 44px tall.`);
  }

  const headerLinks = styles.match(
    /\.site-header nav a,\s*\.header-link\s*\{([^}]*)\}/,
  );
  assert.ok(headerLinks, "CSS must define the shared header-link target.");
  assert.match(headerLinks[1], /display:\s*inline-flex\s*;/, "Header links must expose box targets.");
  assert.match(headerLinks[1], /align-items:\s*center\s*;/, "Header links must remain vertically centred.");
  assert.match(headerLinks[1], /min-height:\s*44px\s*;/, "Header links must be at least 44px tall.");

  const mobilePreset = styles.match(
    /@media\s*\(max-width:\s*820px\)\s*\{[\s\S]*?\.preset\s*\{([^}]*)\}/,
  );
  assert.ok(mobilePreset, "CSS must define mobile preset targets at 820px.");
  assert.match(mobilePreset[1], /min-height:\s*44px\s*;/, "Mobile preset targets must be at least 44px tall.");

  const mobileZoom = styles.match(
    /@media\s*\(max-width:\s*820px\)\s*\{[\s\S]*?\.zoom-controls button\s*\{([^}]*)\}/,
  );
  assert.ok(mobileZoom, "CSS must define mobile graph controls at 820px.");
  assert.match(mobileZoom[1], /min-width:\s*44px\s*;/, "Mobile graph controls must be at least 44px wide.");
  assert.match(mobileZoom[1], /height:\s*44px\s*;/, "Mobile graph controls must be at least 44px tall.");
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
    /<a\s+class="text-link release-link"\s+href="([^"]+)"\s*>[\s\S]*?<\/a>/,
  );
  assert.ok(releaseLink, "The hero must expose a dedicated latest desktop release link.");
  assert.equal(
    releaseLink[1],
    latestReleaseUrl,
    "The desktop CTA must point to GitHub's stable latest-release route.",
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
  const brandMark = await readRequiredText(new URL("public/brand-mark.svg", siteRoot), "public/brand-mark.svg");
  const favicon = await readRequiredText(new URL("public/favicon.svg", siteRoot), "public/favicon.svg");
  const socialArtwork = await readRequiredText(new URL("artwork/social-preview.svg", siteRoot), "artwork/social-preview.svg");

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
  validateIntegralBrand(html, brandMark, favicon);
  validateSocialArtwork(socialArtwork, brandMark);
  validateMobileHeaderLinkTarget(styles);
  validateTouchTargetStyles(styles);
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
  assert.equal(socialPreview.readUInt32BE(16), 1200, "The social preview must remain 1200px wide.");
  assert.equal(socialPreview.readUInt32BE(20), 675, "The social preview must remain 675px tall.");

}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  await validateSite();
  console.log("IntegraDraw site validation passed.");
}
