import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const allowedOrganizations = [
  "Ejupi Labs",
  "GitHub Actions",
  "Google Cloud",
  "Open Source Initiative",
];
const nameToken = String.raw`(?:\p{Lu}\.|[\p{Lu}][\p{L}'’-]*)`;
const nameParticle = String.raw`(?:van|von|de|del|da|di|la|le|du)`;
const honorific = String.raw`(?:(?:Dr|Prof|Mr|Mrs|Ms)\.?\s+)?`;
const personalName = String.raw`${honorific}${nameToken}(?:\s+(?:${nameParticle}\s+)*${nameToken})+`;
const attributionPatterns = [
  new RegExp(
    String.raw`\b(?:[Bb][Yy]|[Ll]ed\s+[Bb][Yy]|[Mm]aintained\s+[Bb][Yy]|[Cc]reated\s+[Bb][Yy]|[Dd]eveloped\s+[Bb][Yy]|[Aa]uthored\s+[Bb][Yy])\s+${personalName}\b`,
    "u",
  ),
  new RegExp(
    String.raw`\b${personalName}(?:\s+(?:built|created|developed|authored|maintains?|leads?)|\s*(?:—|-|,)\s*(?:maintainer|author|lead|creator|developer))\b`,
    "u",
  ),
  new RegExp(
    String.raw`\b(?:[Aa][Uu][Tt][Hh][Oo][Rr][Ss]?|[Mm][Aa][Ii][Nn][Tt][Aa][Ii][Nn][Ee][Rr][Ss]?|[Cc][Oo][Nn][Tt][Rr][Ii][Bb][Uu][Tt][Oo][Rr][Ss]?)\s*:\s*${personalName}\b`,
    "u",
  ),
  new RegExp(
    String.raw`(?:\b[Cc][Oo][Pp][Yy][Rr][Ii][Gg][Hh][Tt]\b\s*(?:(?:\(c\)|©)\s*)?|©\s*)\d{4}(?:\s*[-–]\s*\d{4})?\s+${personalName}\b`,
    "u",
  ),
];
const forbiddenIdentityMetadata = [
  /<meta\b[^>]*\bname\s*=\s*(?:["']author["']|author)(?=[\s/>])[^>]*>/iu,
  /<meta\b[^>]*\bproperty\s*=\s*(?:["'](?:article:author|profile:[^"']+)["']|(?:article:author|profile:[^\s>]+))(?=[\s/>])[^>]*>/iu,
  /\bitemtype\s*=\s*(?:["']https?:\/\/schema\.org\/Person\/?["']|https?:\/\/schema\.org\/Person\/?)(?=[\s>])/iu,
  /\brel\s*=\s*(?:["'][^"']*\bauthor\b[^"']*["']|author)(?=[\s>])/iu,
  /"@type"\s*:\s*(?:"Person"|\[[^\]]*"Person"[^\]]*\])/iu,
];
const githubUrlPattern =
  /https?:\/\/(?:www\.)?github\.com\/[^\s<>"')\]]+/giu;
const publicHandlePattern =
  /(?<![\p{L}\d_-])@(?!media\b|font-face\b|supports\b|keyframes\b|import\b|layer\b|container\b|page\b|charset\b|namespace\b|property\b|type\b)[\p{L}\d](?:[\p{L}\d-]{0,37}[\p{L}\d])?(?![\p{L}\d/-])/giu;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTagNameBoundary(character) {
  return (
    character === undefined ||
    character === ">" ||
    character === "/" ||
    /\s/u.test(character)
  );
}

function findTagEnd(content, start) {
  let quote = null;
  for (let index = start; index < content.length; index += 1) {
    const character = content[index];
    if (quote !== null) {
      if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index;
  }
  return -1;
}

function findRawTextOpening(lowerContent, start) {
  let nearest = null;
  for (const tagName of ["script", "style"]) {
    const needle = `<${tagName}`;
    let index = lowerContent.indexOf(needle, start);
    while (
      index !== -1 &&
      !isTagNameBoundary(lowerContent[index + needle.length])
    ) {
      index = lowerContent.indexOf(needle, index + needle.length);
    }
    if (index !== -1 && (nearest === null || index < nearest.index)) {
      nearest = { index, tagName };
    }
  }
  return nearest;
}

function findRawTextClosing(lowerContent, tagName, start) {
  const needle = `</${tagName}`;
  let index = lowerContent.indexOf(needle, start);
  while (
    index !== -1 &&
    !isTagNameBoundary(lowerContent[index + needle.length])
  ) {
    index = lowerContent.indexOf(needle, index + needle.length);
  }
  return index;
}

function asciiLowercase(content) {
  return content.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function stripRawTextElements(content) {
  const lowerContent = asciiLowercase(content);
  let cursor = 0;
  let visible = "";

  while (cursor < content.length) {
    const opening = findRawTextOpening(lowerContent, cursor);
    if (opening === null) {
      visible += content.slice(cursor);
      break;
    }

    visible += `${content.slice(cursor, opening.index)} `;
    const openingEnd = findTagEnd(
      content,
      opening.index + opening.tagName.length + 1,
    );
    if (openingEnd === -1) break;

    const closing = findRawTextClosing(
      lowerContent,
      opening.tagName,
      openingEnd + 1,
    );
    if (closing === -1) break;

    const closingEnd = findTagEnd(
      content,
      closing + opening.tagName.length + 2,
    );
    if (closingEnd === -1) break;
    cursor = closingEnd + 1;
  }

  return visible;
}

function normalizePublicCopy(content) {
  return stripRawTextElements(content)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\r\n]*`/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[*_~`>#]/g, " ")
    .replace(/&copy;/giu, " © ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPersonalAttribution(content) {
  let normalized = normalizePublicCopy(content);
  for (const organization of allowedOrganizations) {
    normalized = normalized.replace(
      new RegExp(String.raw`\b${escapeRegExp(organization)}\b`, "giu"),
      "the organization",
    );
  }
  return attributionPatterns.some((pattern) => pattern.test(normalized));
}

function containsForbiddenIdentityMetadata(content) {
  return forbiddenIdentityMetadata.some((pattern) => pattern.test(content));
}

function githubUrls(content) {
  return [...content.matchAll(githubUrlPattern)].map(([url]) => {
    const withoutTerminalPunctuation = url.replace(/[.,;:!?]+$/u, "");
    return new URL(withoutTerminalPunctuation);
  });
}

describe("public attribution", () => {
  it("credits contributors collectively on every public project surface", async () => {
    const surfaces = [
      "LICENSE",
      "README.md",
      "shared/README.md",
      "CHANGELOG.md",
      "CODE_OF_CONDUCT.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "SUPPORT.md",
      "web/index.html",
    ];
    const collectiveCreditSurfaces = new Set([
      "LICENSE",
      "README.md",
      "web/index.html",
    ]);

    for (const relative of surfaces) {
      const content = await readFile(resolve(repositoryRoot, relative), "utf8");
      if (collectiveCreditSurfaces.has(relative)) {
        expect(content, relative).toContain("contributors");
      }
      expect(containsPersonalAttribution(content), relative).toBe(false);
      expect(content, relative).not.toMatch(/(?:co-authored-by|signed-off-by):/iu);
      expect(containsForbiddenIdentityMetadata(content), relative).toBe(false);
      expect(normalizePublicCopy(content), relative).not.toMatch(
        publicHandlePattern,
      );

      for (const url of githubUrls(content)) {
        const segments = url.pathname.split("/").filter(Boolean);
        expect(segments.length, `${relative}: ${url}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it.each([
    "by Example Person",
    "By Example Person",
    "created by Example Person",
    "by **Example Person**",
    "by <strong>Example Person</strong>",
    "by E. Person",
    "by Dr. Example Person",
    "by Example van Placeholder",
    "Example Person built the prototype",
    "Example Person — maintainer",
    "Example Person, author",
    "Author: Example Person",
    "author: Example Person",
    "AUTHOR: Example Person",
    "Authors: Example Person",
    "Maintainer: Example Person",
    "Maintainers: Example Person",
    "Contributors: Example Person",
    "Copyright (c) 2026 Example Person",
    "copyright (c) 2026 Example Person",
    "COPYRIGHT © 2026 Example Person",
    "© 2026 Example Person",
    "&copy; 2026 Example Person",
  ])("detects a personal attribution after normalization: %s", (content) => {
    expect(containsPersonalAttribution(content)).toBe(true);
  });

  it.each([
    "Project leads the migration.",
    "Research leads to better results.",
    "Original contributors built the prototype together.",
    "Google Cloud built the managed service.",
    "GitHub Actions created the artifact.",
    "Open Source Initiative created the standard.",
    "OPEN SOURCE INITIATIVE created the standard.",
    "Ejupi Labs and the project maintainers develop it in the open.",
  ])("allows collective or organizational copy: %s", (content) => {
    expect(containsPersonalAttribution(content)).toBe(false);
  });

  it.each([
    '<meta name="author" content="Example Person">',
    '<meta name=author content="Example Person">',
    '<meta property="article:author" content="Example Person">',
    '<div itemtype="https://schema.org/Person"></div>',
    '<div itemtype=https://schema.org/Person></div>',
    '<a rel="author" href="/profile">Profile</a>',
    '<a rel=author href="/profile">Profile</a>',
    '{"@type":"Person","name":"Example Person"}',
    '{"@type":["Person","Thing"],"name":"Example Person"}',
  ])("rejects machine-readable personal attribution: %s", (content) => {
    expect(containsForbiddenIdentityMetadata(content)).toBe(true);
  });

  it.each([
    "https://github.com/example-person?tab=repositories",
    "https://github.com/example-person#readme",
    "<https://github.com/example-person>",
  ])("extracts profile URLs across punctuation and query boundaries: %s", (content) => {
    const [url] = githubUrls(content);
    expect(url.pathname.split("/").filter(Boolean)).toEqual(["example-person"]);
  });

  it.each([
    "https://github.com/rust-lang/rust",
    "https://github.com/ejupi-djenis30/IntegraDraw.",
    "https://github.com/ejupi-djenis30/IntegraDraw.git",
  ])("allows repository URLs and trims prose punctuation: %s", (content) => {
    const [url] = githubUrls(content);
    expect(url.pathname.split("/").filter(Boolean).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it.each([
    "(@example-person)",
    "[@example-person](https://example.test)",
    "contact @example-person.",
  ])("detects public handles across punctuation boundaries: %s", (content) => {
    expect(content).toMatch(publicHandlePattern);
  });

  it.each([
    "<style>@media (width > 40rem) {}</style>",
    "<style>@media (width > 40rem) {}</style >",
    "<style>@media (width > 40rem) {}</style\t\n data-tail>",
    '<script type="application/ld+json">{"@type":"SoftwareApplication"}</script>',
    '<script type="application/ld+json">{"@type":"SoftwareApplication"}</script >',
    '<script type="application/ld+json">{"@type":"SoftwareApplication"}</script\t\n data-tail>',
    "Install `@vitejs/plugin-react` for the Vite adapter.",
    "The package is @vitejs/plugin-react.",
  ])("does not treat code, CSS or scoped packages as handles: %s", (content) => {
    expect(normalizePublicCopy(content)).not.toMatch(publicHandlePattern);
  });
});
