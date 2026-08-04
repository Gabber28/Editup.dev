import { describe, it, expect } from "vitest";
import {
  axisFromBoxes,
  resolveDropIndex,
  insertionLineOf,
  centerOf,
  parseOffsetPx,
  offsetAfterDrag,
  type Box,
} from "@injected/drag-target.js";

/** Three boxes side by side, like buttons in a flex row. */
const ROW: Box[] = [
  { left: 0, top: 100, width: 100, height: 40 },
  { left: 120, top: 100, width: 100, height: 40 },
  { left: 240, top: 100, width: 100, height: 40 },
];

/** Three stacked boxes, like sections in normal block flow. */
const COLUMN: Box[] = [
  { left: 0, top: 0, width: 300, height: 100 },
  { left: 0, top: 120, width: 300, height: 100 },
  { left: 0, top: 240, width: 300, height: 100 },
];

describe("axisFromBoxes", () => {
  it("detects a horizontal row and a vertical stack", () => {
    expect(axisFromBoxes(ROW)).toBe("x");
    expect(axisFromBoxes(COLUMN)).toBe("y");
  });

  it("falls back to vertical with fewer than two siblings", () => {
    expect(axisFromBoxes([])).toBe("y");
    expect(axisFromBoxes([ROW[0] as Box])).toBe("y");
  });
});

describe("resolveDropIndex", () => {
  it("counts the siblings the pointer already passed on the x axis", () => {
    expect(resolveDropIndex(ROW, { x: 10, y: 120 }, "x")).toBe(0);
    expect(resolveDropIndex(ROW, { x: 130, y: 120 }, "x")).toBe(1);
    expect(resolveDropIndex(ROW, { x: 250, y: 120 }, "x")).toBe(2);
    expect(resolveDropIndex(ROW, { x: 999, y: 120 }, "x")).toBe(3);
  });

  it("does the same on the y axis", () => {
    // Centers sit at y = 50, 170 and 290.
    expect(resolveDropIndex(COLUMN, { x: 50, y: 10 }, "y")).toBe(0);
    expect(resolveDropIndex(COLUMN, { x: 50, y: 100 }, "y")).toBe(1);
    expect(resolveDropIndex(COLUMN, { x: 50, y: 200 }, "y")).toBe(2);
    expect(resolveDropIndex(COLUMN, { x: 50, y: 999 }, "y")).toBe(3);
  });

  it("switches slot exactly at the sibling's midpoint", () => {
    // First row box spans 0..100, so its center is 50.
    expect(resolveDropIndex(ROW, { x: 49, y: 120 }, "x")).toBe(0);
    expect(resolveDropIndex(ROW, { x: 51, y: 120 }, "x")).toBe(1);
  });

  it("returns 0 when there are no siblings to compare against", () => {
    expect(resolveDropIndex([], { x: 10, y: 10 }, "x")).toBe(0);
  });
});

describe("insertionLineOf", () => {
  it("anchors to the leading edge of the sibling at the index", () => {
    expect(insertionLineOf(ROW, 1, "x")).toEqual({
      left: 120,
      top: 100,
      length: 40,
      axis: "x",
    });
    expect(insertionLineOf(COLUMN, 1, "y")).toEqual({
      left: 0,
      top: 120,
      length: 300,
      axis: "y",
    });
  });

  it("anchors to the trailing edge when dropping past the last sibling", () => {
    expect(insertionLineOf(ROW, 3, "x")).toEqual({
      left: 340,
      top: 100,
      length: 40,
      axis: "x",
    });
    expect(insertionLineOf(COLUMN, 3, "y")?.top).toBe(340);
  });

  it("has nothing to anchor to without siblings", () => {
    expect(insertionLineOf([], 0, "x")).toBeNull();
  });
});

describe("centerOf", () => {
  it("measures along the requested axis", () => {
    const box: Box = { left: 10, top: 20, width: 100, height: 40 };
    expect(centerOf(box, "x")).toBe(60);
    expect(centerOf(box, "y")).toBe(40);
  });
});

describe("free-move offsets", () => {
  it("treats auto and empty insets as zero", () => {
    expect(parseOffsetPx("auto")).toBe(0);
    expect(parseOffsetPx("")).toBe(0);
    expect(parseOffsetPx(undefined)).toBe(0);
    expect(parseOffsetPx("42px")).toBe(42);
    expect(parseOffsetPx("-8px")).toBe(-8);
  });

  it("adds the drag delta to the starting inset", () => {
    expect(offsetAfterDrag("auto", 40)).toBe("40px");
    expect(offsetAfterDrag("10px", 32.4)).toBe("42px");
    expect(offsetAfterDrag("10px", -25)).toBe("-15px");
  });
});
