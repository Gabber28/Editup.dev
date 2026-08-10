import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionControls } from "@/components/editor/panels/position-controls.js";
import type { ElementInfo, MatchingRule } from "@/types/snapshot.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const el: ElementInfo = { tag: "div", classes: [] };

const rule = (ruleText: string): MatchingRule => ({
  selector: ".card",
  source_file: "styles.css",
  rule_text: ruleText,
  line_number: 1,
  match_count: 1,
});

const advanced = (): HTMLElement =>
  screen.getByRole("button", { name: /Advanced/ });

beforeEach(() => {
  localStorage.clear();
});

describe("Position — Advanced section", () => {
  it("collapses the box model by default, keeping the rest visible", () => {
    render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("top offset")).toBeNull();

    expect(screen.getByLabelText("Position mode")).toBeTruthy();
    expect(screen.getByLabelText("Align left")).toBeTruthy();
    expect(screen.getByLabelText("translate X")).toBeTruthy();
    expect(screen.getByLabelText("rotation")).toBeTruthy();
    expect(screen.getByLabelText("z-index")).toBeTruthy();
  });

  it("exposes the trigger as a button with aria-expanded and aria-controls", () => {
    render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        onChange={vi.fn()}
      />
    );

    const trigger = advanced();
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const controls = trigger.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls ?? "")).toBeTruthy();
  });

  it("mounts and unmounts the body rather than hiding it", () => {
    render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("top offset")).toBeNull();
    fireEvent.click(advanced());
    expect(screen.getByLabelText("top offset")).toBeTruthy();
    fireEvent.click(advanced());
    expect(screen.queryByLabelText("top offset")).toBeNull();
  });

  it("shows no summary when nothing is authored", () => {
    render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        onChange={vi.fn()}
      />
    );
    expect(advanced().textContent).toContain("Advanced");
    expect(advanced().textContent).not.toMatch(/[TRBL]\s\d/);
  });

  it("summarises the authored offsets while collapsed", () => {
    render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        overrides={{ right: "24px", bottom: "24px" }}
        onChange={vi.fn()}
      />
    );
    // Auto-opened because values exist; collapse it to read the summary.
    fireEvent.click(advanced());
    expect(advanced().textContent).toContain("R 24 · B 24");
  });

  it("opens automatically for an element that arrives with authored offsets", () => {
    render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        rules={[rule(".card { top: 12px }")]}
        onChange={vi.fn()}
      />
    );
    expect(advanced().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("top offset")).toHaveProperty("value", "12px");
  });

  it("keeps the developer's choice across a change of selection", () => {
    const { rerender } = render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        onChange={vi.fn()}
      />
    );
    fireEvent.click(advanced());
    expect(advanced().getAttribute("aria-expanded")).toBe("true");

    // A new selection remounts the panel; the stored preference must survive.
    rerender(
      <PositionControls
        key="other"
        element={{ tag: "span", classes: ["other"] }}
        values={{ position: "absolute" }}
        onChange={vi.fn()}
      />
    );
    expect(advanced().getAttribute("aria-expanded")).toBe("true");
  });

  it("drops the whole Advanced row under static", () => {
    render(
      <PositionControls
        element={el}
        values={{ position: "static" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /Advanced/ })).toBeNull();
    expect(screen.queryByLabelText("top offset")).toBeNull();
    expect(screen.queryByLabelText("z-index")).toBeNull();
  });

  it("still edits offsets once expanded", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={el}
        values={{ position: "fixed" }}
        onChange={onChange}
      />
    );
    fireEvent.click(advanced());
    fireEvent.blur(screen.getByLabelText("right offset"), {
      target: { value: "24" },
    });
    expect(onChange).toHaveBeenCalledWith("right", "24px");
  });
});
