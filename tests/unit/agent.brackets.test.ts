import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FloatingBracketsOverlay } from "@injected/overlay.js";

describe("FloatingBracketsOverlay — bracket positioning", () => {
  let overlay: FloatingBracketsOverlay;

  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    overlay = new FloatingBracketsOverlay();
    overlay.attach(document.body);
  });

  afterEach(() => {
    overlay.detach();
  });

  it("creates overlay root without background coverage", () => {
    const root = document.getElementById("editup-overlay-root");
    expect(root).not.toBeNull();
    expect(root!.style.pointerEvents).toBe("none");
    expect(root!.style.width).toMatch(/^0(px)?$/);
    expect(root!.style.height).toMatch(/^0(px)?$/);
  });

  it("renders 4 corner brackets for a hovered element", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 100, y: 50, width: 200, height: 100,
      top: 50, left: 100, right: 300, bottom: 150,
      toJSON: () => ({}),
    });

    overlay.setHovered(el);

    const root = document.getElementById("editup-overlay-root");
    const svgs = root!.querySelectorAll("svg");
    // First SVG = hover, second = selected
    const hoverSvg = svgs[0]!;
    const paths = hoverSvg.querySelectorAll("path");
    expect(paths).toHaveLength(4);
  });

  it("renders 4 corner brackets for a selected element", () => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 10, y: 20, width: 120, height: 40,
      top: 20, left: 10, right: 130, bottom: 60,
      toJSON: () => ({}),
    });

    overlay.setSelected(el, "button.primary");

    const root = document.getElementById("editup-overlay-root");
    const svgs = root!.querySelectorAll("svg");
    const selectedSvg = svgs[1]!;
    const paths = selectedSvg.querySelectorAll("path");
    expect(paths).toHaveLength(4);
  });

  it("hover brackets use dashed stroke", () => {
    const el = document.createElement("span");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 80, height: 30,
      top: 0, left: 0, right: 80, bottom: 30,
      toJSON: () => ({}),
    });

    overlay.setHovered(el);

    const root = document.getElementById("editup-overlay-root");
    const hoverSvg = root!.querySelectorAll("svg")[0]!;
    const path = hoverSvg.querySelector("path");
    expect(path?.getAttribute("stroke-dasharray")).toBe("3,2");
  });

  it("selected brackets use solid stroke (no dash)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 60, height: 60,
      top: 0, left: 0, right: 60, bottom: 60,
      toJSON: () => ({}),
    });

    overlay.setSelected(el, "div.card");

    const root = document.getElementById("editup-overlay-root");
    const selectedSvg = root!.querySelectorAll("svg")[1]!;
    const path = selectedSvg.querySelector("path");
    expect(path?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("selected brackets have stroke-width of 2", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 50, height: 50,
      top: 0, left: 0, right: 50, bottom: 50,
      toJSON: () => ({}),
    });

    overlay.setSelected(el, "div");

    const root = document.getElementById("editup-overlay-root");
    const selectedSvg = root!.querySelectorAll("svg")[1]!;
    const path = selectedSvg.querySelector("path");
    expect(path?.getAttribute("stroke-width")).toBe("2");
  });

  it("hover brackets have stroke-width of 1", () => {
    const el = document.createElement("a");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 50, height: 20,
      top: 0, left: 0, right: 50, bottom: 20,
      toJSON: () => ({}),
    });

    overlay.setHovered(el);

    const root = document.getElementById("editup-overlay-root");
    const hoverSvg = root!.querySelectorAll("svg")[0]!;
    const path = hoverSvg.querySelector("path");
    expect(path?.getAttribute("stroke-width")).toBe("1");
  });

  it("does not render filled rectangles (no surface coverage)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 100, height: 100,
      top: 0, left: 0, right: 100, bottom: 100,
      toJSON: () => ({}),
    });

    overlay.setSelected(el, "div");
    overlay.setHovered(el);

    const root = document.getElementById("editup-overlay-root");
    const rects = root!.querySelectorAll("rect");
    expect(rects).toHaveLength(0);

    const allPaths = root!.querySelectorAll("path");
    for (const p of Array.from(allPaths)) {
      expect(p.getAttribute("fill")).toBe("none");
    }
  });

  it("clears brackets when hovered element is set to null", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, width: 50, height: 50,
      top: 0, left: 0, right: 50, bottom: 50,
      toJSON: () => ({}),
    });

    overlay.setHovered(el);
    overlay.setHovered(null);

    const root = document.getElementById("editup-overlay-root");
    const hoverSvg = root!.querySelectorAll("svg")[0]!;
    expect(hoverSvg.querySelectorAll("path")).toHaveLength(0);
  });
});
