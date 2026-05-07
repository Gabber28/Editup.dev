import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CodeBox } from "@/components/editor/code-box.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("CodeBox", () => {
  it("returns null when source is undefined", () => {
    const { container } = render(<CodeBox />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when source is empty string", () => {
    const { container } = render(<CodeBox source="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders source snippet in a pre element", () => {
    render(<CodeBox source={'const x = 1;'} />);
    expect(screen.getByText("const x = 1;")).toBeTruthy();
    expect(screen.getByText("const x = 1;").tagName).toBe("PRE");
  });

  it("shows file and line when provided", () => {
    render(<CodeBox source="code" file="src/App.tsx" line={42} />);
    expect(screen.getByText("src/App.tsx:42")).toBeTruthy();
  });

  it("shows file with question mark when line is missing", () => {
    render(<CodeBox source="code" file="main.ts" />);
    expect(screen.getByText("main.ts:?")).toBeTruthy();
  });

  it("does not render file header when file is not provided", () => {
    const { container } = render(<CodeBox source="hello" />);
    const codeBox = container.querySelector(".code-box");
    expect(codeBox).toBeTruthy();
    expect(codeBox?.children.length).toBe(1);
  });

  it("renders with the code-box class", () => {
    const { container } = render(<CodeBox source="x" />);
    expect(container.querySelector(".code-box")).toBeTruthy();
  });

  it("preserves multiline source content", () => {
    const multiline = "line1\nline2\nline3";
    render(<CodeBox source={multiline} />);
    const pre = screen.getByText(/line1/);
    expect(pre.textContent).toContain("line2");
    expect(pre.textContent).toContain("line3");
  });
});
