import { describe, it, expect } from "vitest";
import {
  resolveAlign,
  verticalAlignSupported,
  coordOf,
} from "@/components/editor/panels/position-align.js";
import type { ElementInfo } from "@/types/snapshot.js";

function el(display: string, flexDirection = "row"): ElementInfo {
  return {
    tag: "div",
    classes: [],
    layout: {
      offset: { left: 418, top: 150 },
      size: { width: 100, height: 40 },
      parent: { tag: "div", display, flex_direction: flexDirection },
    },
  };
}

describe("resolveAlign — grid parent", () => {
  it("maps the horizontal axis to justify-self", () => {
    expect(resolveAlign("h", "start", el("grid"), {})).toEqual([["justify-self", "start"]]);
    expect(resolveAlign("h", "end", el("inline-grid"), {})).toEqual([["justify-self", "end"]]);
  });

  it("maps the vertical axis to align-self", () => {
    expect(resolveAlign("v", "center", el("grid"), {})).toEqual([["align-self", "center"]]);
  });
});

describe("resolveAlign — flex parent", () => {
  it("uses auto margins on the main axis of a row", () => {
    expect(resolveAlign("h", "center", el("flex", "row"), {})).toEqual([
      ["margin-left", "auto"],
      ["margin-right", "auto"],
    ]);
    expect(resolveAlign("h", "end", el("flex", "row"), {})).toEqual([
      ["margin-left", "auto"],
      ["margin-right", "0px"],
    ]);
  });

  it("uses align-self on the cross axis of a row", () => {
    expect(resolveAlign("v", "end", el("flex", "row"), {})).toEqual([
      ["align-self", "flex-end"],
    ]);
  });

  it("swaps the axes for a column (including column-reverse)", () => {
    expect(resolveAlign("h", "start", el("flex", "column"), {})).toEqual([
      ["align-self", "flex-start"],
    ]);
    expect(resolveAlign("v", "start", el("flex", "column-reverse"), {})).toEqual([
      ["margin-top", "0px"],
      ["margin-bottom", "auto"],
    ]);
  });
});

describe("resolveAlign — absolutely positioned element", () => {
  it("writes insets regardless of the parent's display", () => {
    expect(resolveAlign("h", "start", el("flex"), { position: "absolute" })).toEqual([
      ["left", "0px"],
      ["right", "auto"],
    ]);
    expect(resolveAlign("v", "end", el("grid"), { position: "fixed" })).toEqual([
      ["top", "auto"],
      ["bottom", "0px"],
    ]);
  });

  it("centers with opposite insets plus auto margins, never a translate", () => {
    const pairs = resolveAlign("h", "center", el("block"), { position: "absolute" });
    expect(pairs).toEqual([
      ["left", "0px"],
      ["right", "0px"],
      ["margin-left", "auto"],
      ["margin-right", "auto"],
    ]);
    expect(pairs.some(([prop]) => prop === "transform")).toBe(false);
  });
});

describe("resolveAlign — normal block flow", () => {
  it("falls back to auto margins", () => {
    expect(resolveAlign("h", "center", el("block"), {})).toEqual([
      ["margin-left", "auto"],
      ["margin-right", "auto"],
    ]);
  });

  it("still resolves when the agent captured no layout at all", () => {
    expect(resolveAlign("h", "start", null, {})).toEqual([
      ["margin-left", "0px"],
      ["margin-right", "auto"],
    ]);
  });
});

describe("verticalAlignSupported", () => {
  it("is true for flex, grid, and positioned elements", () => {
    expect(verticalAlignSupported(el("flex"), {})).toBe(true);
    expect(verticalAlignSupported(el("grid"), {})).toBe(true);
    expect(verticalAlignSupported(el("block"), { position: "absolute" })).toBe(true);
  });

  it("is false in normal block flow and without captured layout", () => {
    expect(verticalAlignSupported(el("block"), {})).toBe(false);
    expect(verticalAlignSupported(null, {})).toBe(false);
  });
});

describe("coordOf", () => {
  it("uses the measured offset when the inset is auto or missing", () => {
    expect(coordOf({}, "left", 418)).toBe("418");
    expect(coordOf({ left: "auto" }, "left", 418)).toBe("418");
  });

  it("prefers the authored inset, rounded to whole pixels", () => {
    expect(coordOf({ left: "24px" }, "left", 418)).toBe("24");
    expect(coordOf({ top: "12.6px" }, "top", 150)).toBe("13");
  });

  it("passes through non-numeric values such as calc()", () => {
    expect(coordOf({ left: "calc(100% - 2rem)" }, "left", 0)).toBe("calc(100% - 2rem)");
  });
});
