import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { EditorShell } from "@/components/editor/editor-shell.js";
import type { ResponsiveMode } from "@/hooks/useResponsiveMode.js";

let mockMode: ResponsiveMode = "wide";

vi.mock("@/hooks/useResponsiveMode.js", () => ({
  useResponsiveMode: (): ResponsiveMode => mockMode,
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const SLOTS = {
  layers: <div data-testid="layers">Layers</div>,
  identity: <div data-testid="identity">Identity</div>,
  tabs: <div data-testid="tabs">Tabs</div>,
  panel: <div data-testid="panel">Panel</div>,
  codeBox: <div data-testid="code-box">CodeBox</div>,
  progress: <div data-testid="progress">Progress</div>,
  aiInput: <div data-testid="ai-input">AI Input</div>,
  applyBar: <div data-testid="apply-bar">Apply</div>,
  toast: <div data-testid="toast">Toast</div>,
};

describe("EditorShell responsive modes", () => {
  beforeEach(() => {
    mockMode = "wide";
  });

  it("renders all slots in wide mode", () => {
    render(<EditorShell {...SLOTS} />);
    expect(screen.getByTestId("layers")).toBeTruthy();
    expect(screen.getByTestId("identity")).toBeTruthy();
    expect(screen.getByTestId("code-box")).toBeTruthy();
    expect(screen.getByTestId("toast")).toBeTruthy();
  });

  it("sets data-mode attribute to wide", () => {
    const { container } = render(<EditorShell {...SLOTS} />);
    const shell = container.querySelector("[data-mode]");
    expect(shell?.getAttribute("data-mode")).toBe("wide");
  });

  it("shows layers panel only in wide mode", () => {
    mockMode = "wide";
    const { unmount } = render(<EditorShell {...SLOTS} />);
    expect(screen.getByTestId("layers")).toBeTruthy();
    unmount();

    mockMode = "medium";
    render(<EditorShell {...SLOTS} />);
    expect(screen.queryByTestId("layers")).toBeNull();
  });

  it("sets data-mode to medium for medium width", () => {
    mockMode = "medium";
    const { container } = render(<EditorShell {...SLOTS} />);
    const shell = container.querySelector("[data-mode]");
    expect(shell?.getAttribute("data-mode")).toBe("medium");
  });

  it("hides code box in narrow mode", () => {
    mockMode = "narrow";
    render(<EditorShell {...SLOTS} />);
    expect(screen.queryByTestId("code-box")).toBeNull();
  });

  it("shows code box in medium mode", () => {
    mockMode = "medium";
    render(<EditorShell {...SLOTS} />);
    expect(screen.getByTestId("code-box")).toBeTruthy();
  });

  it("sets data-mode to narrow for narrow width", () => {
    mockMode = "narrow";
    const { container } = render(<EditorShell {...SLOTS} />);
    const shell = container.querySelector("[data-mode]");
    expect(shell?.getAttribute("data-mode")).toBe("narrow");
  });

  it("always renders ai-input across all modes", () => {
    for (const m of ["wide", "medium", "narrow"] as const) {
      mockMode = m;
      const { unmount } = render(<EditorShell {...SLOTS} />);
      expect(screen.getByTestId("ai-input")).toBeTruthy();
      unmount();
    }
  });

  it("applies editor-shell--<mode> class", () => {
    mockMode = "medium";
    const { container } = render(<EditorShell {...SLOTS} />);
    const shell = container.firstElementChild;
    expect(shell?.className).toContain("editor-shell--medium");
  });
});
