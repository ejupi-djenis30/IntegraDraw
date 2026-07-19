import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const config = await readFile(new URL("vite.config.ts", root), "utf8");

for (const file of [
  "public/brand-mark.svg",
  "public/favicon.svg",
  "public/poster.svg",
  "public/integradraw-demo.mp4",
]) {
  await access(new URL(file, root));
}

for (const token of [
  '<html lang="en">',
  "<main",
  "<video",
  'poster="./poster.svg"',
  'src="./integradraw-demo.mp4"',
  "aria-label",
]) {
  assert.ok(html.includes(token), `index.html is missing ${token}`);
}

assert.ok(config.includes('base: "/IntegraDraw/"'), "Vite must retain the project Pages base path.");

const videoUrl = new URL("public/integradraw-demo.mp4", root);
const videoStats = await stat(videoUrl);
assert.ok(videoStats.size >= 250_000, "The demo video is unexpectedly small.");
assert.ok(videoStats.size <= 8_000_000, "Keep the demo video below 8 MB for a fast Page load.");
const videoHeader = await readFile(videoUrl);
assert.equal(videoHeader.subarray(4, 8).toString("ascii"), "ftyp", "The demo asset is not an MP4 file.");

console.log("IntegraDraw site validation passed.");
