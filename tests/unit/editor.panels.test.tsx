import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorsPanel } from "@/components/editor/panels/colors-panel.js";
import { SpacingPanel } from "@/components/editor/panels/spacing-panel.js";
import { TypographyPanel } from "@/components/editor/panels/typography-panel.js";
import { BorderPanel } from "@/components/editor/panels/border-panel.js";
import { LayoutPanel } from "@/components/editor/panels/layout-panel.js";
import { EffectsPanel } from "@/components/editor/panels/effects-panel.js";
import { PropRow, SelectRow, SectionLabel } from "@/components/editor/panels/prop-row.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("PropRow", () => {
  it("renders label and input with value", () => {
    render(<PropRow label="Width" value="100px" onChange={vi.fn()} />);
    expect(screen.getByText("Width")).toBeTruthy();
    expect(screen.getByDisplayValue("100px")).toBeTruthy();
  });

  it("calls onChange on input change", () => {
    const onChange = vi.fn();
    render(<PropRow label="W" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "50px" } });
    expect(onChange).toHaveBeenCalledWith("50px");
  });
});

describe("SelectRow", () => {
  it("renders options and fires onChange", () => {
    const onChange = vi.fn();
    render(<SelectRow label="Align" value="left" options={["left", "center"]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "center" } });
    expect(onChange).toHaveBeenCalledWith("center");
  });
});

describe("SectionLabel", () => {
  it("renders children text", () => {
    render(<SectionLabel>Margin</SectionLabel>);
    expect(screen.getByText("Margin")).toBeTruthy();
  });
});

describe("ColorsPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ColorsPanel values={{ "background-color": "#fff", color: "#000" }} onChange={vi.fn()} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(<ColorsPanel values={{ "background-color": "", color: "" }} onChange={onChange} />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "red" } });
    expect(onChange).toHaveBeenCalledWith("background-color", "red");
  });
});

describe("SpacingPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<SpacingPanel values={{}} onChange={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(<SpacingPanel values={{ "margin-top": "0px" }} onChange={onChange} />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "16px" } });
    expect(onChange).toHaveBeenCalledWith("margin-top", "16px");
  });
});

describe("TypographyPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<TypographyPanel values={{}} onChange={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange on select change", () => {
    const onChange = vi.fn();
    render(<TypographyPanel values={{}} onChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "700" } });
    expect(onChange).toHaveBeenCalledWith("font-weight", "700");
  });
});

describe("BorderPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<BorderPanel values={{}} onChange={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(<BorderPanel values={{}} onChange={onChange} />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "2px" } });
    expect(onChange).toHaveBeenCalledWith("border-top-width", "2px");
  });
});

describe("LayoutPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<LayoutPanel values={{}} onChange={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange on select change", () => {
    const onChange = vi.fn();
    render(<LayoutPanel values={{}} onChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "flex" } });
    expect(onChange).toHaveBeenCalledWith("display", "flex");
  });
});

describe("EffectsPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<EffectsPanel values={{}} onChange={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(<EffectsPanel values={{}} onChange={onChange} />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "0.5" } });
    expect(onChange).toHaveBeenCalledWith("opacity", "0.5");
  });
});
