import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LayersPanel } from "@/components/editor/layers-panel.js";
import type { DomNode } from "@/components/editor/layers-panel.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const NODES: DomNode[] = [
  { id: "1", tag: "div", className: "wrapper", depth: 0 },
  { id: "2", tag: "section", depth: 1 },
  { id: "3", tag: "button", className: "btn", depth: 2, edited: true },
];

describe("LayersPanel", () => {
  it("renders the heading", () => {
    render(<LayersPanel nodes={NODES} onSelect={vi.fn()} />);
    expect(screen.getByText("Layers")).toBeTruthy();
  });

  it("renders all nodes in hierarchy", () => {
    render(<LayersPanel nodes={NODES} onSelect={vi.fn()} />);
    expect(screen.getByText("div.wrapper")).toBeTruthy();
    expect(screen.getByText("section")).toBeTruthy();
  });

  it("shows edited marker for edited nodes", () => {
    render(<LayersPanel nodes={NODES} onSelect={vi.fn()} />);
    const btn = screen.getByText(/button\.btn/);
    expect(btn.textContent).toContain("●");
  });

  it("fires onSelect with correct id on click", () => {
    const onSelect = vi.fn();
    render(<LayersPanel nodes={NODES} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("div.wrapper"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("fires onSelect with different id on another node", () => {
    const onSelect = vi.fn();
    render(<LayersPanel nodes={NODES} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("section"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("highlights active node with accent background", () => {
    render(<LayersPanel nodes={NODES} activeId="1" onSelect={vi.fn()} />);
    const activeBtn = screen.getByText("div.wrapper");
    const style = activeBtn.getAttribute("style") ?? "";
    expect(style).toContain("rgba(124, 58, 237, 0.15)");
  });

  it("does not highlight inactive nodes", () => {
    render(<LayersPanel nodes={NODES} activeId="1" onSelect={vi.fn()} />);
    const inactiveBtn = screen.getByText("section");
    const style = inactiveBtn.getAttribute("style") ?? "";
    expect(style).toContain("transparent");
  });

  it("renders empty list without errors", () => {
    const { container } = render(<LayersPanel nodes={[]} onSelect={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });
});
