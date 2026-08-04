import { describe, it, expect, beforeEach, vi } from "vitest";
import { SnapMove } from "@injected/drag-snap.js";

vi.mock("@injected/source-map.js", () => ({
  lookupReactFiber: () => ({
    componentName: "Hero",
    source: { file: "src/hero.tsx", line: 14 },
  }),
}));

/** happy-dom reports empty rects, so lay the children out explicitly. */
function layoutRow(children: Element[]): void {
  children.forEach((child, i) => {
    child.getBoundingClientRect = (): DOMRect =>
      ({ left: i * 120, top: 100, width: 100, height: 40, right: i * 120 + 100, bottom: 140, x: i * 120, y: 100, toJSON: () => ({}) }) as DOMRect;
  });
}

function buildRow(): { parent: HTMLElement; items: HTMLElement[] } {
  document.body.innerHTML = `
    <div id="row">
      <button id="a">A</button>
      <button id="b">B</button>
      <button id="c">C</button>
    </div>`;
  const parent = document.getElementById("row") as HTMLElement;
  const items = Array.from(parent.children) as HTMLElement[];
  layoutRow(items);
  return { parent, items };
}

const idsOf = (parent: Element): string[] =>
  Array.from(parent.children).map((c) => c.id);

describe("SnapMove", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("moves the element before the sibling the pointer is over", () => {
    const { parent, items } = buildRow();
    const dragged = items[2] as HTMLElement; // C
    const snap = new SnapMove();
    snap.start(dragged);
    // Siblings are now [A, B] at x 0..100 and 120..220; land left of A's center.
    snap.move({ x: 10, y: 120 });
    const changes = snap.commit();

    expect(idsOf(parent)).toEqual(["c", "a", "b"]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.property).toBe("__move__");
  });

  it("describes the reference sibling with tag, classes and source", () => {
    const { items } = buildRow();
    const dragged = items[2] as HTMLElement;
    (items[0] as HTMLElement).className = "btn btn-primary";
    const snap = new SnapMove();
    snap.start(dragged);
    snap.move({ x: 10, y: 120 });

    const value = JSON.parse(snap.commit()[0]?.value ?? "{}") as {
      position: string;
      reference: { tag: string; classes: string[]; source: string; component: string };
    };
    expect(value.position).toBe("before");
    expect(value.reference.tag).toBe("button");
    expect(value.reference.classes).toEqual(["btn", "btn-primary"]);
    expect(value.reference.source).toBe("src/hero.tsx:14");
    expect(value.reference.component).toBe("Hero");
  });

  it("appends after the last sibling when dropped past the end", () => {
    const { parent, items } = buildRow();
    const dragged = items[0] as HTMLElement; // A
    const snap = new SnapMove();
    snap.start(dragged);
    snap.move({ x: 999, y: 120 });

    const value = JSON.parse(snap.commit()[0]?.value ?? "{}") as { position: string };
    expect(idsOf(parent)).toEqual(["b", "c", "a"]);
    expect(value.position).toBe("after");
  });

  it("reports nothing when dropped back into its own slot", () => {
    const { parent, items } = buildRow();
    const dragged = items[1] as HTMLElement; // B, between A and C
    const snap = new SnapMove();
    snap.start(dragged);
    // Siblings are [A, C]; landing right of A's center means "before C" — where B already is.
    snap.move({ x: 110, y: 120 });

    expect(snap.commit()).toEqual([]);
    expect(idsOf(parent)).toEqual(["a", "b", "c"]);
  });

  it("restores every moved element to its original slot", () => {
    const { parent, items } = buildRow();
    const dragged = items[2] as HTMLElement;
    const snap = new SnapMove();
    snap.start(dragged);
    snap.move({ x: 10, y: 120 });
    snap.commit();
    expect(idsOf(parent)).toEqual(["c", "a", "b"]);

    snap.restoreAll();
    expect(idsOf(parent)).toEqual(["a", "b", "c"]);
  });

  it("does nothing for an element without a parent", () => {
    const orphan = document.createElement("div");
    const snap = new SnapMove();
    snap.start(orphan);
    expect(snap.commit()).toEqual([]);
  });
});
