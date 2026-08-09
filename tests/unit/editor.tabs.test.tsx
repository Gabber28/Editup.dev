import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  Inspector,
  type InspectorProps,
} from "@/components/editor/inspector.js";
import { makeElement } from "../helpers/fixtures.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const NO_CODE = { source: "", file: "", line: 0 };

function makeProps(overrides: Partial<InspectorProps> = {}): InspectorProps {
  return {
    element: makeElement({ has_text: true }),
    values: {},
    onChange: vi.fn(),
    pseudo: {
      availableStates: ["default"],
      activeState: "default",
      setActiveState: vi.fn(),
    },
    code: NO_CODE,
    ...overrides,
  };
}

const tabNames = (): string[] =>
  screen.getAllByRole("tab").map((el) => el.textContent ?? "");

describe("Inspector button bar", () => {
  it("always shows the universal panels", () => {
    render(<Inspector {...makeProps()} />);
    for (const label of ["Layout", "Spacing", "Effects", "Colors", "Borders"]) {
      expect(tabNames()).toContain(label);
    }
  });

  it("shows Typography for an element with text, not Image", () => {
    render(
      <Inspector {...makeProps({ element: makeElement({ has_text: true }) })} />
    );
    expect(tabNames()).toContain("Typography");
    expect(tabNames()).not.toContain("Image");
  });

  it("shows Image for a media element, not Typography or Colors", () => {
    const img = makeElement({
      tag: "img",
      has_text: false,
      media: { kind: "img" },
    });
    render(<Inspector {...makeProps({ element: img })} />);
    expect(tabNames()).toContain("Image");
    expect(tabNames()).not.toContain("Typography");
    // Replaced media can't take a background/text color.
    expect(tabNames()).not.toContain("Colors");
  });

  it("marks the first tab active by default", () => {
    render(<Inspector {...makeProps()} />);
    const first = screen.getAllByRole("tab")[0];
    expect(first?.getAttribute("aria-selected")).toBe("true");
  });

  it("switches the active tab on click", () => {
    render(<Inspector {...makeProps()} />);
    const spacing = screen.getByRole("tab", { name: "Spacing" });
    expect(spacing.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(spacing);
    expect(spacing.getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByRole("tab")[0]?.getAttribute("aria-selected")).toBe(
      "false"
    );
  });

  it("falls back to the first tab when the active one stops applying", () => {
    const img = makeElement({
      tag: "img",
      has_text: false,
      media: { kind: "img" },
    });
    const { rerender } = render(<Inspector {...makeProps({ element: img })} />);

    fireEvent.click(screen.getByRole("tab", { name: "Image" }));
    expect(
      screen.getByRole("tab", { name: "Image" }).getAttribute("aria-selected")
    ).toBe("true");

    // Selecting a text element removes the Image tab underneath the selection.
    rerender(
      <Inspector {...makeProps({ element: makeElement({ has_text: true }) })} />
    );

    expect(tabNames()).not.toContain("Image");
    const first = screen.getAllByRole("tab")[0];
    expect(first?.getAttribute("aria-selected")).toBe("true");
  });

  it("hides the Source tab when there is no snippet", () => {
    render(<Inspector {...makeProps({ code: NO_CODE })} />);
    expect(tabNames()).not.toContain("Source");
  });

  it("shows the source snippet behind the Source tab", () => {
    const code = {
      source: '<button class="btn" />',
      file: "index.html",
      line: 42,
    };
    render(<Inspector {...makeProps({ code })} />);

    expect(screen.queryByText(/index\.html/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Source" }));
    expect(screen.getByText(/index\.html/)).toBeTruthy();
    expect(screen.getByText(code.source)).toBeTruthy();
  });
});
