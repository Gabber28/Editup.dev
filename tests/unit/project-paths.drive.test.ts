import { describe, it, expect } from "vitest";
import { toProjectRelative } from "@/lib/ai-adapters/project-paths.js";

/**
 * Regression: a project root entered without its drive letter is a valid
 * Windows directory, so it was accepted — but every path the AI reported back
 * carried "C:", the two never matched, and the file audit failed a run whose
 * edits had actually landed.
 */
describe("toProjectRelative — drive-letter mismatch", () => {
  const FILE = "C:\\Users\\gabri\\proj\\demo\\index.html";

  it("relativizes when the root carries the drive letter", () => {
    expect(toProjectRelative(FILE, "C:\\Users\\gabri\\proj\\demo")).toBe("index.html");
  });

  it("still relativizes when the root lost its drive letter", () => {
    expect(toProjectRelative(FILE, "\\Users\\gabri\\proj\\demo")).toBe("index.html");
  });

  it("handles the reverse case: rooted with a drive, file without", () => {
    expect(
      toProjectRelative("\\Users\\gabri\\proj\\demo\\a.css", "C:\\Users\\gabri\\proj\\demo"),
    ).toBe("a.css");
  });

  it("keeps nested paths intact", () => {
    expect(
      toProjectRelative("C:\\Users\\gabri\\proj\\demo\\src\\app.css", "\\Users\\gabri\\proj\\demo"),
    ).toBe("src/app.css");
  });

  it("does not relativize a file outside the root", () => {
    expect(toProjectRelative("C:\\Other\\x.css", "\\Users\\gabri\\proj\\demo")).toBe(
      "C:/Other/x.css",
    );
  });
});
