import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AIInput } from "@/components/editor/ai-input.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("AIInput", () => {
  it("renders input with default placeholder", () => {
    render(<AIInput />);
    const input = screen.getByPlaceholderText(
      "Optional: describe extra changes (e.g. 'add hover glow')",
    );
    expect(input).toBeTruthy();
  });

  it("renders input with custom placeholder", () => {
    render(<AIInput placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeTruthy();
  });

  it("captures typed text", () => {
    render(<AIInput />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "add hover glow" } });
    expect((input as HTMLInputElement).value).toBe("add hover glow");
  });

  it("fires onChange callback on each keystroke", () => {
    const onChange = vi.fn();
    render(<AIInput onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a" } });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("fires onSubmit with value on form submit", () => {
    const onSubmit = vi.fn();
    render(<AIInput onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "make it glow" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("make it glow");
  });

  it("clears input after submit", () => {
    const onSubmit = vi.fn();
    render(<AIInput onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.submit(input.closest("form")!);
    expect(input.value).toBe("");
  });

  it("does not fire onSubmit for empty/whitespace input", () => {
    const onSubmit = vi.fn();
    render(<AIInput onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders without crashing with no props", () => {
    const { container } = render(<AIInput />);
    expect(container.querySelector("form")).toBeTruthy();
  });
});
