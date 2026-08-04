import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorsPanel } from "@/components/editor/panels/colors-panel.js";
import { SpacingPanel } from "@/components/editor/panels/spacing-panel.js";
import { TypographyPanel } from "@/components/editor/panels/typography-panel.js";
import { BorderPanel } from "@/components/editor/panels/border-panel.js";
import { LayoutPanel } from "@/components/editor/panels/layout-panel.js";
import { EffectsPanel } from "@/components/editor/panels/effects-panel.js";
import { PropRow, SelectRow, SectionLabel } from "@/components/editor/panels/prop-row.js";
import { PositionControls } from "@/components/editor/panels/position-controls.js";
import type { ElementInfo } from "@/types/snapshot.js";

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

  it("keeps the existing position fields alongside the visual controls", () => {
    render(<LayoutPanel values={{}} onChange={vi.fn()} />);
    for (const label of ["Top", "Right", "Bottom", "Left", "Z-Index"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    // display, flex-direction, justify, align, wrap, position, overflow-x, overflow-y
    expect(screen.getAllByRole("combobox")).toHaveLength(8);
  });
});

const parentEl = (display: string, flexDirection = "row"): ElementInfo => ({
  tag: "div",
  classes: [],
  layout: {
    offset: { left: 418, top: 150 },
    size: { width: 100, height: 40 },
    parent: { tag: "div", display, flex_direction: flexDirection },
  },
});

describe("PositionControls — alignment", () => {
  it("uses justify-self/align-self inside a grid parent", () => {
    const onChange = vi.fn();
    render(
      <PositionControls element={parentEl("grid")} values={{}} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText("Align right"));
    expect(onChange).toHaveBeenCalledWith("justify-self", "end");

    onChange.mockClear();
    fireEvent.click(screen.getByLabelText("Align top"));
    expect(onChange).toHaveBeenCalledWith("align-self", "start");
  });

  it("uses auto margins on the main axis and align-self on the cross axis of a flex row", () => {
    const onChange = vi.fn();
    render(
      <PositionControls element={parentEl("flex", "row")} values={{}} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText("Align horizontal center"));
    expect(onChange).toHaveBeenCalledWith("margin-left", "auto");
    expect(onChange).toHaveBeenCalledWith("margin-right", "auto");

    onChange.mockClear();
    fireEvent.click(screen.getByLabelText("Align bottom"));
    expect(onChange).toHaveBeenCalledWith("align-self", "flex-end");
  });

  it("swaps the axes for a flex column parent", () => {
    const onChange = vi.fn();
    render(
      <PositionControls element={parentEl("flex", "column")} values={{}} onChange={onChange} />,
    );
    fireEvent.click(screen.getByLabelText("Align left"));
    expect(onChange).toHaveBeenCalledWith("align-self", "flex-start");

    onChange.mockClear();
    fireEvent.click(screen.getByLabelText("Align top"));
    expect(onChange).toHaveBeenCalledWith("margin-top", "0px");
    expect(onChange).toHaveBeenCalledWith("margin-bottom", "auto");
  });

  it("writes insets when the element itself is absolutely positioned", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "absolute" }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("Align vertical center"));
    expect(onChange).toHaveBeenCalledWith("top", "0px");
    expect(onChange).toHaveBeenCalledWith("bottom", "0px");
    expect(onChange).toHaveBeenCalledWith("margin-top", "auto");
    expect(onChange).toHaveBeenCalledWith("margin-bottom", "auto");
  });

  it("disables vertical alignment in normal block flow", () => {
    render(<PositionControls element={parentEl("block")} values={{}} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Align top").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Align left").hasAttribute("disabled")).toBe(false);
  });
});

describe("PositionControls — X/Y", () => {
  it("shows the measured offset when no inset is authored", () => {
    render(<PositionControls element={parentEl("block")} values={{}} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("418")).toBeTruthy();
    expect(screen.getByDisplayValue("150")).toBeTruthy();
  });

  it("prefers the authored inset over the measured offset", () => {
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "relative", left: "24px" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue("24")).toBeTruthy();
  });

  it("writes left/top and promotes a static element to relative", () => {
    const onChange = vi.fn();
    render(<PositionControls element={parentEl("block")} values={{}} onChange={onChange} />);
    const x = screen.getByDisplayValue("418");
    fireEvent.blur(x, { target: { value: "40" } });
    expect(onChange).toHaveBeenCalledWith("position", "relative");
    expect(onChange).toHaveBeenCalledWith("left", "40px");
    expect(screen.getByText("position changed to relative")).toBeTruthy();
  });

  it("leaves position alone when the element is already positioned", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "absolute" }}
        onChange={onChange}
      />,
    );
    fireEvent.blur(screen.getByDisplayValue("150"), { target: { value: "12" } });
    expect(onChange).toHaveBeenCalledWith("top", "12px");
    expect(onChange).not.toHaveBeenCalledWith("position", "relative");
  });
});

describe("PositionControls — rotation", () => {
  it("adds 90 degrees per click of the rotate button", () => {
    const onChange = vi.fn();
    render(<PositionControls element={parentEl("block")} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Rotate 90°"));
    expect(onChange).toHaveBeenCalledWith("transform", "rotate(90deg)");
  });

  it("toggles flips into the transform string", () => {
    const onChange = vi.fn();
    render(<PositionControls element={parentEl("block")} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Flip horizontal"));
    expect(onChange).toHaveBeenCalledWith("transform", "scaleX(-1)");

    onChange.mockClear();
    fireEvent.click(screen.getByLabelText("Flip vertical"));
    expect(onChange).toHaveBeenCalledWith("transform", "scaleX(-1) scaleY(-1)");
  });

  it("seeds the angle from the computed matrix and writes a typed angle", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ transform: "matrix(0, 1, -1, 0, 0, 0)" }}
        onChange={onChange}
      />,
    );
    expect(screen.getByDisplayValue("90°")).toBeTruthy();
    fireEvent.blur(screen.getByDisplayValue("90°"), { target: { value: "15" } });
    expect(onChange).toHaveBeenCalledWith("transform", "rotate(15deg)");
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
