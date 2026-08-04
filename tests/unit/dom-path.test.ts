import { describe, it, expect, beforeEach } from "vitest";
import {
  buildDomPath,
  domIndex,
  textPreview,
  ancestorPath,
} from "@injected/dom-path.js";

const CARDS = `
  <main>
    <section class="cards">
      <div class="card"><div class="icon">A</div><p>First card</p></div>
      <div class="card"><div class="icon">B</div><p>Second card</p></div>
      <div class="card"><div class="icon">C</div><p>Third card</p></div>
    </section>
  </main>`;

describe("buildDomPath — instance identity", () => {
  beforeEach(() => {
    document.body.innerHTML = CARDS;
  });

  it("gives look-alike siblings distinct paths", () => {
    const icons = Array.from(document.querySelectorAll(".icon"));
    const paths = icons.map(buildDomPath);
    expect(new Set(paths).size).toBe(3);
  });

  it("produces a selector that matches exactly one element", () => {
    const third = document.querySelectorAll(".card")[2] as Element;
    const path = buildDomPath(third);
    const matches = document.querySelectorAll(path);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toBe(third);
  });

  it("anchors on an id and stops climbing", () => {
    const el = document.querySelector(".icon") as Element;
    el.id = "first-icon";
    expect(buildDomPath(el)).toBe("#first-icon");
  });

  it("omits nth-of-type when the tag is unique among its siblings", () => {
    const section = document.querySelector("section") as Element;
    expect(buildDomPath(section)).not.toContain("nth-of-type");
  });
});

describe("supporting identity signals", () => {
  beforeEach(() => {
    document.body.innerHTML = CARDS;
  });

  it("reports the 1-based position among siblings", () => {
    const cards = Array.from(document.querySelectorAll(".card"));
    expect(cards.map(domIndex)).toEqual([1, 2, 3]);
  });

  it("previews the element's own text", () => {
    const p = document.querySelectorAll(".card p")[1] as Element;
    expect(textPreview(p)).toBe("Second card");
  });

  it("truncates a long text preview", () => {
    const p = document.querySelector("p") as Element;
    p.textContent = "x".repeat(200);
    expect(textPreview(p).length).toBeLessThanOrEqual(61);
    expect(textPreview(p).endsWith("…")).toBe(true);
  });

  it("lists the nearest ancestors outermost first", () => {
    const icon = document.querySelector(".icon") as Element;
    expect(ancestorPath(icon)).toEqual(["main", "section.cards", "div.card"]);
  });
});
