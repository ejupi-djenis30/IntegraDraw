import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));

describe("public attribution", () => {
  it("credits contributors collectively on every public project surface", async () => {
    const surfaces = ["LICENSE", "README.md", "web/index.html"];
    const forbiddenPersonalBylines = ["Djenis Ejupi", "Djenis leads"];

    for (const relative of surfaces) {
      const content = await readFile(resolve(repositoryRoot, relative), "utf8");
      expect(content, relative).toContain("contributors");
      for (const byline of forbiddenPersonalBylines) {
        expect(content, relative).not.toContain(byline);
      }
    }
  });
});
