import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  captureComputedStyle,
  detectFramework,
} from "@injected/style-capture.js";
import { lookupElementSource } from "@injected/source-map.js";

describe("element info extraction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("produces correct tag, classes, and id", () => {
    const el = document.createElement("button");
    el.id = "submit-btn";
    el.classList.add("btn", "btn-primary");

    const info = {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: Array.from(el.classList),
    };

    expect(info.tag).toBe("button");
    expect(info.id).toBe("submit-btn");
    expect(info.classes).toEqual(["btn", "btn-primary"]);
  });

  it("returns undefined id when element has no id", () => {
    const el = document.createElement("div");
    const id = el.id || undefined;
    expect(id).toBeUndefined();
  });

  it("returns empty classes array for classless element", () => {
    const el = document.createElement("span");
    expect(Array.from(el.classList)).toEqual([]);
  });
});

describe("ancestor/selector chain", () => {
  it("builds correct DOM hierarchy from element to body", () => {
    const body = document.body;
    const main = document.createElement("main");
    const section = document.createElement("section");
    const div = document.createElement("div");
    const button = document.createElement("button");

    body.appendChild(main);
    main.appendChild(section);
    section.appendChild(div);
    div.appendChild(button);

    const chain: string[] = [];
    let current: Element | null = button;
    while (current && current !== document.documentElement) {
      chain.unshift(current.tagName.toLowerCase());
      current = current.parentElement;
    }

    expect(chain).toEqual(["body", "main", "section", "div", "button"]);

    body.removeChild(main);
  });

  it("includes class info in selector chain", () => {
    const parent = document.createElement("div");
    parent.classList.add("container");
    const child = document.createElement("p");
    child.classList.add("text-lg");
    parent.appendChild(child);

    const selectorOf = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const cls = Array.from(el.classList);
      return cls.length > 0 ? `${tag}.${cls[0]}` : tag;
    };

    expect(selectorOf(parent)).toBe("div.container");
    expect(selectorOf(child)).toBe("p.text-lg");
  });
});

describe("component name extraction", () => {
  it("extracts component name from React fiber", () => {
    const el = document.createElement("div");
    const fiberKey = "__reactFiber$abc123";
    Object.defineProperty(el, fiberKey, {
      value: {
        type: { name: "MyButton", displayName: undefined },
        _debugSource: { fileName: "/src/MyButton.tsx", lineNumber: 42 },
        _debugOwner: null,
        return: null,
      },
      configurable: true,
    });

    const result = lookupElementSource(el);
    expect(result.componentName).toBe("MyButton");
    expect(result.source?.file).toBe("/src/MyButton.tsx");
    expect(result.source?.line).toBe(42);
  });

  it("returns empty lookup when no fiber is present", () => {
    const el = document.createElement("span");
    const result = lookupElementSource(el);
    expect(result.componentName).toBeUndefined();
    expect(result.source).toBeUndefined();
  });

  it("prefers displayName over name", () => {
    const el = document.createElement("div");
    const fiberKey = "__reactFiber$xyz789";
    Object.defineProperty(el, fiberKey, {
      value: {
        type: { name: "Btn", displayName: "PrimaryButton" },
        _debugSource: null,
        _debugOwner: null,
        return: null,
      },
      configurable: true,
    });

    const result = lookupElementSource(el);
    expect(result.componentName).toBe("PrimaryButton");
  });
});
