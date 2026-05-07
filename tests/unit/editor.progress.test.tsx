import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressMarker } from "@/components/editor/progress-marker.js";
import type { ProgressItem } from "@/components/editor/progress-marker.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const ITEMS: ProgressItem[] = [
  { label: "header", done: true },
  { label: "button", done: false },
  { label: "footer", done: true },
];

describe("ProgressMarker", () => {
  it("renders the Edited label", () => {
    render(<ProgressMarker items={ITEMS} />);
    expect(screen.getByText("Edited:")).toBeTruthy();
  });

  it("renders a dot for each item", () => {
    const { container } = render(<ProgressMarker items={ITEMS} />);
    const dots = container.querySelectorAll(".progress-marker__dot");
    expect(dots.length).toBe(3);
  });

  it("count matches provided data length", () => {
    const items: ProgressItem[] = [
      { label: "a", done: false },
      { label: "b", done: true },
    ];
    const { container } = render(<ProgressMarker items={items} />);
    const dots = container.querySelectorAll(".progress-marker__dot");
    expect(dots.length).toBe(items.length);
  });

  it("applies done class for completed items", () => {
    const { container } = render(<ProgressMarker items={ITEMS} />);
    const doneDots = container.querySelectorAll(".progress-marker__dot--done");
    expect(doneDots.length).toBe(2);
  });

  it("applies pending class for incomplete items", () => {
    const { container } = render(<ProgressMarker items={ITEMS} />);
    const pending = container.querySelectorAll(".progress-marker__dot--pending");
    expect(pending.length).toBe(1);
  });

  it("renders item labels as text content", () => {
    render(<ProgressMarker items={ITEMS} />);
    expect(screen.getByText("header")).toBeTruthy();
    expect(screen.getByText("button")).toBeTruthy();
    expect(screen.getByText("footer")).toBeTruthy();
  });

  it("renders empty list without errors", () => {
    const { container } = render(<ProgressMarker items={[]} />);
    expect(container.querySelector(".progress-marker")).toBeTruthy();
    const dots = container.querySelectorAll(".progress-marker__dot");
    expect(dots.length).toBe(0);
  });

  it("all-done list has zero pending dots", () => {
    const allDone: ProgressItem[] = [
      { label: "x", done: true },
      { label: "y", done: true },
    ];
    const { container } = render(<ProgressMarker items={allDone} />);
    const pending = container.querySelectorAll(".progress-marker__dot--pending");
    expect(pending.length).toBe(0);
  });
});
