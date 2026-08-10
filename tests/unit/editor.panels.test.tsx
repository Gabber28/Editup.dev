import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorsPanel } from "@/components/editor/panels/colors-panel.js";
import { SpacingPanel } from "@/components/editor/panels/spacing-panel.js";
import { TypographyPanel } from "@/components/editor/panels/typography-panel.js";
import { BorderPanel } from "@/components/editor/panels/border-panel.js";
import { LayoutPanel } from "@/components/editor/panels/layout-panel.js";
import { EffectsPanel } from "@/components/editor/panels/effects-panel.js";
import {
  PropRow,
  SelectRow,
  SectionLabel,
} from "@/components/editor/panels/prop-row.js";
import { PositionControls } from "@/components/editor/panels/position-controls.js";
import type { ElementInfo } from "@/types/snapshot.js";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

// SectionGroup persists its open state, so one test would otherwise decide the
// starting state of the next.
beforeEach(() => {
  localStorage.clear();
});

/** First element with `role`, narrowed — indexing getAllByRole widens to undefined. */
function firstByRole(role: string): HTMLElement {
  const [el] = screen.getAllByRole(role);
  if (!el) throw new Error(`no element with role "${role}"`);
  return el;
}

/**
 * Opens the "Advanced" section the box model now lives in.
 *
 * Idempotent on purpose: the section auto-opens for elements that already carry
 * offsets, so a blind click would collapse it instead.
 */
function expandAdvanced(): void {
  const trigger = screen.getByRole("button", { name: /Advanced/ });
  if (trigger.getAttribute("aria-expanded") !== "true")
    fireEvent.click(trigger);
}

describe("PropRow", () => {
  it("renders label and input with value", () => {
    render(<PropRow label="Width" value="100px" onChange={vi.fn()} />);
    expect(screen.getByText("Width")).toBeTruthy();
    expect(screen.getByDisplayValue("100px")).toBeTruthy();
  });

  it("calls onChange on input change", () => {
    const onChange = vi.fn();
    render(<PropRow label="W" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "50px" },
    });
    expect(onChange).toHaveBeenCalledWith("50px");
  });
});

describe("SelectRow", () => {
  it("renders options and fires onChange", () => {
    const onChange = vi.fn();
    render(
      <SelectRow
        label="Align"
        value="left"
        options={["left", "center"]}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "center" },
    });
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
      <ColorsPanel
        values={{ "background-color": "#fff", color: "#000" }}
        onChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(
      <ColorsPanel
        values={{ "background-color": "", color: "" }}
        onChange={onChange}
      />
    );

    // Colors are edited through a swatch button that opens a picker popover,
    // not a bare text field — open Background, then type into its hex input.
    fireEvent.click(screen.getByRole("button", { name: /Background/ }));
    fireEvent.change(firstByRole("textbox"), {
      target: { value: "#ff0000" },
    });

    expect(onChange).toHaveBeenCalledWith(
      "background-color",
      expect.stringMatching(/ff0000/i)
    );
  });
});

describe("SpacingPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <SpacingPanel values={{}} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(
      <SpacingPanel values={{ "margin-top": "0px" }} onChange={onChange} />
    );
    fireEvent.change(firstByRole("textbox"), { target: { value: "16px" } });
    expect(onChange).toHaveBeenCalledWith("margin-top", "16px");
  });
});

describe("TypographyPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <TypographyPanel values={{}} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange on select change", () => {
    const onChange = vi.fn();
    render(<TypographyPanel values={{}} onChange={onChange} />);
    fireEvent.change(firstByRole("combobox"), { target: { value: "700" } });
    expect(onChange).toHaveBeenCalledWith("font-weight", "700");
  });
});

describe("BorderPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <BorderPanel values={{}} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(<BorderPanel values={{}} onChange={onChange} />);
    fireEvent.change(firstByRole("textbox"), { target: { value: "2px" } });
    expect(onChange).toHaveBeenCalledWith("border-top-width", "2px");
  });
});

describe("LayoutPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <LayoutPanel values={{}} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange on select change", () => {
    const onChange = vi.fn();
    render(<LayoutPanel values={{}} onChange={onChange} />);
    fireEvent.change(firstByRole("combobox"), { target: { value: "flex" } });
    expect(onChange).toHaveBeenCalledWith("display", "flex");
  });

  it("routes every position property through the box model, with no duplicate rows", () => {
    render(<LayoutPanel values={{ position: "fixed" }} onChange={vi.fn()} />);
    expandAdvanced();

    // The old panel had a labelled row per offset next to the visual controls,
    // so "Position" appeared twice and left/top were editable in two places.
    for (const label of ["Top", "Right", "Bottom", "Left", "Z-Index"]) {
      expect(screen.queryByText(label)).toBeNull();
    }
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(screen.getByLabelText(`${side} offset`)).toBeTruthy();
    }
    expect(screen.getByLabelText("z-index")).toBeTruthy();

    // display, flex-direction, justify, align, wrap, overflow-x, overflow-y —
    // the standalone position select is gone, absorbed by the section header.
    expect(screen.getAllByRole("combobox")).toHaveLength(8);
    expect(screen.getByLabelText("Position mode")).toBeTruthy();
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
      <PositionControls
        element={parentEl("grid")}
        values={{}}
        onChange={onChange}
      />
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
      <PositionControls
        element={parentEl("flex", "row")}
        values={{}}
        onChange={onChange}
      />
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
      <PositionControls
        element={parentEl("flex", "column")}
        values={{}}
        onChange={onChange}
      />
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
      />
    );
    fireEvent.click(screen.getByLabelText("Align vertical center"));
    expect(onChange).toHaveBeenCalledWith("top", "0px");
    expect(onChange).toHaveBeenCalledWith("bottom", "0px");
    expect(onChange).toHaveBeenCalledWith("margin-top", "auto");
    expect(onChange).toHaveBeenCalledWith("margin-bottom", "auto");
  });

  it("disables vertical alignment in normal block flow", () => {
    render(
      <PositionControls
        element={parentEl("block")}
        values={{}}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Align top").hasAttribute("disabled")).toBe(
      true
    );
    expect(screen.getByLabelText("Align left").hasAttribute("disabled")).toBe(
      false
    );
  });
});

describe("PositionControls — X/Y", () => {
  // X/Y write `translate`, not left/top: the box model owns the offsets, and
  // two controls editing the same property was the ambiguity being removed.
  it("writes translate rather than left/top", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "relative" }}
        onChange={onChange}
      />
    );
    fireEvent.blur(screen.getByLabelText("translate X"), {
      target: { value: "40" },
    });
    expect(onChange).toHaveBeenCalledWith("transform", "translate(40px, 0)");
    expect(onChange).not.toHaveBeenCalledWith("left", expect.anything());
  });

  it("keeps the other axis when one is edited", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "relative", transform: "translate(10px, 5px)" }}
        onChange={onChange}
      />
    );
    fireEvent.blur(screen.getByLabelText("translate Y"), {
      target: { value: "8" },
    });
    expect(onChange).toHaveBeenCalledWith("transform", "translate(10px, 8px)");
  });

  it("reads the existing translate into the fields", () => {
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "relative", transform: "translate(12px, 3px)" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("translate X")).toHaveProperty(
      "value",
      "12px"
    );
    expect(screen.getByLabelText("translate Y")).toHaveProperty("value", "3px");
  });

  it("preserves the rotation when a translate is typed", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "relative", transform: "rotate(90deg)" }}
        onChange={onChange}
      />
    );
    fireEvent.blur(screen.getByLabelText("translate X"), {
      target: { value: "5" },
    });
    expect(onChange).toHaveBeenCalledWith(
      "transform",
      "translate(5px, 0) rotate(90deg)"
    );
  });
});

describe("PositionControls — box model", () => {
  const positioned = { position: "fixed" };

  it("shows auto for an offset no rule declares", () => {
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ ...positioned, top: "-99999px" }}
        onChange={vi.fn()}
      />
    );
    expandAdvanced();
    // The computed value must never be presented as if it were authored.
    const top = screen.getByLabelText("top offset");
    expect(top).toHaveProperty("value", "");
    expect(top.getAttribute("placeholder")).toBe("auto");
  });

  it("shows the authored value when a rule declares it", () => {
    render(
      <PositionControls
        element={parentEl("block")}
        values={positioned}
        rules={[
          {
            selector: ".card",
            source_file: "a.css",
            rule_text: ".card { top: 24px }",
            line_number: 1,
            match_count: 1,
          },
        ]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("top offset")).toHaveProperty("value", "24px");
  });

  it("assumes px for a bare number", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={positioned}
        onChange={onChange}
      />
    );
    expandAdvanced();
    fireEvent.blur(screen.getByLabelText("right offset"), {
      target: { value: "24" },
    });
    expect(onChange).toHaveBeenCalledWith("right", "24px");
  });

  it("preserves an explicit unit", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={positioned}
        onChange={onChange}
      />
    );
    expandAdvanced();
    fireEvent.blur(screen.getByLabelText("bottom offset"), {
      target: { value: "10%" },
    });
    expect(onChange).toHaveBeenCalledWith("bottom", "10%");
  });

  it("clears rather than writing a literal auto", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={positioned}
        overrides={{ left: "8px" }}
        onChange={onChange}
        onClear={onClear}
      />
    );
    fireEvent.blur(screen.getByLabelText("left offset"), {
      target: { value: "" },
    });
    expect(onClear).toHaveBeenCalledWith("left");
    expect(onChange).not.toHaveBeenCalledWith("left", "auto");
  });

  it("names the containing block for each mode", () => {
    const { rerender } = render(
      <PositionControls
        element={parentEl("block")}
        values={positioned}
        onChange={vi.fn()}
      />
    );
    expandAdvanced();
    expect(screen.getByText("viewport")).toBeTruthy();

    rerender(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "relative" }}
        onChange={vi.fn()}
      />
    );
    // The section stays expanded across the change of mode.
    expect(screen.getByText("self")).toBeTruthy();
  });

  it("hides the box model and layer stepper under static", () => {
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "static" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("top offset")).toBeNull();
    expect(screen.queryByLabelText("z-index")).toBeNull();
    // The rest of the section stays.
    expect(screen.getByLabelText("Position mode")).toBeTruthy();
    expect(screen.getByLabelText("translate X")).toBeTruthy();
  });

  it("restores the offsets when leaving static", () => {
    const values = { position: "fixed", top: "" };
    const { rerender } = render(
      <PositionControls
        element={parentEl("block")}
        values={values}
        overrides={{ top: "16px" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("top offset")).toHaveProperty("value", "16px");

    rerender(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "static" }}
        overrides={{ top: "16px" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText("top offset")).toBeNull();

    rerender(
      <PositionControls
        element={parentEl("block")}
        values={values}
        overrides={{ top: "16px" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("top offset")).toHaveProperty("value", "16px");
  });
});

describe("PositionControls — layer stepper", () => {
  it("steps the z-index with the arrows", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "fixed" }}
        overrides={{ "z-index": "3" }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText("Bring forward"));
    expect(onChange).toHaveBeenCalledWith("z-index", "4");

    // Steps build on what the stepper now shows, so going back returns to 3.
    onChange.mockClear();
    fireEvent.click(screen.getByLabelText("Send backward"));
    expect(onChange).toHaveBeenCalledWith("z-index", "3");
  });

  it("steps down from an unset z-index", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{ position: "fixed", "z-index": "auto" }}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText("Send backward"));
    expect(onChange).toHaveBeenCalledWith("z-index", "-1");
  });
});

describe("PositionControls — rotation", () => {
  it("adds 90 degrees per click of the rotate button", () => {
    const onChange = vi.fn();
    render(
      <PositionControls
        element={parentEl("block")}
        values={{}}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText("Rotate 90°"));
    expect(onChange).toHaveBeenCalledWith("transform", "rotate(90deg)");
  });

  it("toggles flips into the transform string", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PositionControls
        element={parentEl("block")}
        values={{}}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText("Flip horizontal"));
    expect(onChange).toHaveBeenCalledWith("transform", "scaleX(-1)");

    // The control is fully controlled by `values`, so the second flip only
    // accumulates if the first one is fed back in — as App.tsx does.
    onChange.mockClear();
    rerender(
      <PositionControls
        element={parentEl("block")}
        values={{ transform: "scaleX(-1)" }}
        onChange={onChange}
      />
    );
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
      />
    );
    expect(screen.getByDisplayValue("90°")).toBeTruthy();
    fireEvent.blur(screen.getByDisplayValue("90°"), {
      target: { value: "15" },
    });
    expect(onChange).toHaveBeenCalledWith("transform", "rotate(15deg)");
  });
});

describe("EffectsPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <EffectsPanel values={{}} onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });

  it("calls onChange with property and value", () => {
    const onChange = vi.fn();
    render(<EffectsPanel values={{}} onChange={onChange} />);
    fireEvent.change(firstByRole("textbox"), { target: { value: "0.5" } });
    expect(onChange).toHaveBeenCalledWith("opacity", "0.5");
  });
});
