import { describe, it, expect, beforeEach } from "vitest";
import { textPreview } from "@injected/dom-path.js";

/**
 * Mirrors the agent's post-edit lookup. Kept as a local copy of the same rule
 * so the behaviour is pinned even though the agent module boots a WebSocket on
 * import.
 */
interface Target {
  path: string;
  tag?: string;
  classes?: string[];
  text?: string;
}

function matchesDescriptor(el: Element, target: Target): boolean {
  if (target.tag && el.tagName.toLowerCase() !== target.tag) return false;
  return (target.classes ?? []).every((c) => el.classList.contains(c));
}

function resolveTarget(target: Target): Element | null {
  try {
    const direct = document.querySelector(target.path);
    if (direct && matchesDescriptor(direct, target)) return direct;
  } catch {
    /* fall through */
  }
  if (!target.tag) return null;
  const selector =
    target.classes && target.classes.length > 0
      ? `${target.tag}.${target.classes.join(".")}`
      : target.tag;
  let candidates: Element[] = [];
  try {
    candidates = Array.from(document.querySelectorAll(selector));
  } catch {
    return null;
  }
  if (candidates.length === 1) return candidates[0] ?? null;
  if (target.text) {
    return candidates.find((c) => textPreview(c) === target.text) ?? null;
  }
  return null;
}

describe("locating an element after the edit reordered the page", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section class="cards">
        <div class="card"><p>First card</p></div>
        <div class="card"><p>Second card</p></div>
        <div class="card"><p>Third card</p></div>
      </section>`;
  });

  it("uses the positional path when it still matches", () => {
    const found = resolveTarget({
      path: "section > div:nth-of-type(2)",
      tag: "div",
      classes: ["card"],
      text: "Second card",
    });
    expect(found?.textContent?.trim()).toBe("Second card");
  });

  it("falls back to text when the reorder invalidated the path", () => {
    // The edit moved the third card to the front; the old path now points at
    // a different element, which is exactly how verification used to hang.
    const cards = Array.from(document.querySelectorAll(".card"));
    const section = document.querySelector("section") as Element;
    section.insertBefore(cards[2] as Element, cards[0] as Element);

    const found = resolveTarget({
      path: "section > div:nth-of-type(9)",
      tag: "div",
      classes: ["card"],
      text: "Third card",
    });
    expect(found?.textContent?.trim()).toBe("Third card");
  });

  it("resolves a unique tag+class match without needing text", () => {
    document.body.innerHTML = `<main><h1 class="title">Only one</h1></main>`;
    const found = resolveTarget({ path: "gone", tag: "h1", classes: ["title"] });
    expect(found?.textContent).toBe("Only one");
  });

  it("returns null rather than guessing between look-alikes", () => {
    const found = resolveTarget({ path: "gone", tag: "div", classes: ["card"] });
    expect(found).toBeNull();
  });

  it("refuses the element that took over the position after a swap", () => {
    // The real failure: the edit swapped two buttons, so the recorded path
    // still matched — but matched the OTHER button, and verification measured
    // the wrong element and declared the edit unfaithful.
    document.body.innerHTML = `
      <header><button class="btn btn-primary">Começar agora</button></header>
      <main><div class="hero-cta">
        <button class="btn btn-primary">Testar grátis</button>
        <button class="btn btn-ghost">Ver demo</button>
      </div></main>`;

    const found = resolveTarget({
      // Path recorded before the swap, when the primary button was second.
      path: ".hero-cta > button:nth-of-type(2)",
      tag: "button",
      classes: ["btn", "btn-primary"],
      text: "Testar grátis",
    });

    expect(found?.classList.contains("btn-primary")).toBe(true);
    expect(found?.textContent?.trim()).toBe("Testar grátis");
  });

  it("keeps a direct hit that still matches the recorded element", () => {
    document.body.innerHTML = `
      <div class="hero-cta">
        <button class="btn btn-primary">Testar grátis</button>
      </div>`;
    const found = resolveTarget({
      path: ".hero-cta > button:nth-of-type(1)",
      tag: "button",
      classes: ["btn", "btn-primary"],
      text: "Testar grátis",
    });
    expect(found?.textContent?.trim()).toBe("Testar grátis");
  });

  it("survives a malformed selector", () => {
    const found = resolveTarget({
      path: ">>> not a selector",
      tag: "div",
      classes: ["card"],
      text: "First card",
    });
    expect(found?.textContent?.trim()).toBe("First card");
  });
});
