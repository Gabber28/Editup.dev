import { describe, it, expect, beforeEach } from "vitest";
import { captureBaseComputedStyle } from "@injected/style-capture.js";

/**
 * The off-screen harness used to measure an element must not end up in the
 * measurement. An earlier version set `position:fixed; top:-99999px;
 * left:-99999px` on the clone itself, so every element on every page reported
 * `position: fixed` and `top: -99999px` — values the panel then displayed as if
 * the developer had written them.
 */
describe("captureBaseComputedStyle — the harness must not measure itself", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("does not report the harness position on an unpositioned element", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const base = captureBaseComputedStyle(el);

    // Asserted as absences: happy-dom enumerates only explicitly set
    // properties, so an untouched element reports nothing for these — which is
    // exactly the point. The old harness reported its own values instead.
    expect(base["position"]).not.toBe("fixed");
    expect(base["top"]).not.toBe("-99999px");
    expect(base["left"]).not.toBe("-99999px");
  });

  it("does not leak the harness's inherited properties", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const base = captureBaseComputedStyle(el);

    // Both inherit, so putting them on the wrapper would still reach the clone.
    expect(base["visibility"]).not.toBe("hidden");
    expect(base["pointer-events"]).not.toBe("none");
  });

  it("keeps the position the stylesheet actually declares", () => {
    const style = document.createElement("style");
    style.textContent = ".pinned { position: fixed; top: 24px }";
    document.head.appendChild(style);

    const el = document.createElement("div");
    el.className = "pinned";
    document.body.appendChild(el);

    const base = captureBaseComputedStyle(el);

    expect(base["position"]).toBe("fixed");
    expect(base["top"]).toBe("24px");
  });

  it("ignores inline styles, including EditUp's own previews", () => {
    const style = document.createElement("style");
    style.textContent = ".card { color: rgb(0, 0, 255) }";
    document.head.appendChild(style);

    const el = document.createElement("div");
    el.className = "card";
    el.style.setProperty("color", "rgb(255, 0, 0)");
    document.body.appendChild(el);

    const base = captureBaseComputedStyle(el);

    expect(base["color"]).toBe("rgb(0, 0, 255)");
  });

  it("leaves the document clean", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const before = document.body.childElementCount;

    captureBaseComputedStyle(el);

    expect(document.body.childElementCount).toBe(before);
  });
});
