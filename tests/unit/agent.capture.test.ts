import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  captureComputedStyle,
  captureCSSVariables,
} from "@injected/style-capture.js";

describe("captureComputedStyle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns computed style properties for an element", () => {
    const el = document.createElement("div");
    const fakeDecl = {
      length: 3,
      item: (i: number): string | null =>
        ["color", "font-size", "display"][i] ?? null,
      getPropertyValue: (prop: string): string => {
        const map: Record<string, string> = {
          color: " rgb(0, 0, 0) ",
          "font-size": "16px",
          display: "block",
        };
        return map[prop] ?? "";
      },
    } as unknown as CSSStyleDeclaration;

    vi.spyOn(window, "getComputedStyle").mockReturnValue(fakeDecl);

    const result = captureComputedStyle(el);
    expect(result).toEqual({
      color: "rgb(0, 0, 0)",
      "font-size": "16px",
      display: "block",
    });
  });

  it("trims whitespace from property values", () => {
    const el = document.createElement("span");
    const fakeDecl = {
      length: 1,
      item: (): string => "margin",
      getPropertyValue: (): string => "  10px  ",
    } as unknown as CSSStyleDeclaration;

    vi.spyOn(window, "getComputedStyle").mockReturnValue(fakeDecl);

    const result = captureComputedStyle(el);
    expect(result["margin"]).toBe("10px");
  });

  it("returns empty object when no properties exist", () => {
    const el = document.createElement("div");
    const fakeDecl = {
      length: 0,
      item: (): null => null,
      getPropertyValue: (): string => "",
    } as unknown as CSSStyleDeclaration;

    vi.spyOn(window, "getComputedStyle").mockReturnValue(fakeDecl);

    const result = captureComputedStyle(el);
    expect(result).toEqual({});
  });

  it("skips null items gracefully", () => {
    const el = document.createElement("div");
    const fakeDecl = {
      length: 2,
      item: (i: number): string | null =>
        i === 0 ? null : "padding",
      getPropertyValue: (): string => "8px",
    } as unknown as CSSStyleDeclaration;

    vi.spyOn(window, "getComputedStyle").mockReturnValue(fakeDecl);

    const result = captureComputedStyle(el);
    expect(result).toEqual({ padding: "8px" });
  });
});

describe("captureCSSVariables", () => {
  it("returns only CSS custom properties (--*)", () => {
    const el = document.createElement("div");
    const fakeDecl = {
      length: 3,
      item: (i: number): string | null =>
        ["--primary", "color", "--spacing"][i] ?? null,
      getPropertyValue: (prop: string): string => {
        const map: Record<string, string> = {
          "--primary": " #7c3aed ",
          color: "red",
          "--spacing": "8px",
        };
        return map[prop] ?? "";
      },
    } as unknown as CSSStyleDeclaration;

    vi.spyOn(window, "getComputedStyle").mockReturnValue(fakeDecl);

    const result = captureCSSVariables(el);
    expect(result).toEqual({
      "--primary": { value: "#7c3aed", declared_in: "<computed>" },
      "--spacing": { value: "8px", declared_in: "<computed>" },
    });
    expect(result["color"]).toBeUndefined();
  });
});
