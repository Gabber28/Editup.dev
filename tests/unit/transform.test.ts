import { describe, it, expect } from "vitest";
import { parseTransform, buildTransform } from "@/lib/transform.js";

describe("parseTransform", () => {
  it("treats none and empty as idle", () => {
    expect(parseTransform("none")).toEqual({ rotate: 0, flipX: false, flipY: false, translate: "" });
    expect(parseTransform("")).toEqual({ rotate: 0, flipX: false, flipY: false, translate: "" });
  });

  it("reads the identity matrix as no rotation", () => {
    expect(parseTransform("matrix(1, 0, 0, 1, 0, 0)")).toEqual({
      rotate: 0,
      flipX: false,
      flipY: false,
      translate: "",
    });
  });

  it("recovers a pure rotation from the matrix", () => {
    // rotate(90deg) → matrix(0, 1, -1, 0, 0, 0)
    expect(parseTransform("matrix(0, 1, -1, 0, 0, 0)").rotate).toBe(90);
    // rotate(45deg)
    const m = Math.SQRT1_2;
    expect(parseTransform(`matrix(${m}, ${m}, ${-m}, ${m}, 0, 0)`).rotate).toBe(45);
  });

  it("normalizes negative angles into [0, 360)", () => {
    // rotate(-90deg) → matrix(0, -1, 1, 0, 0, 0)
    expect(parseTransform("matrix(0, -1, 1, 0, 0, 0)").rotate).toBe(270);
  });

  it("flags a mirrored matrix and keeps the underlying rotation", () => {
    // scaleX(-1) → matrix(-1, 0, 0, 1, 0, 0)
    expect(parseTransform("matrix(-1, 0, 0, 1, 0, 0)")).toEqual({
      rotate: 0,
      flipX: true,
      flipY: false,
      translate: "",
    });
    // rotate(90deg) scaleX(-1) → matrix(0, -1, -1, 0, 0, 0)
    const flipped = parseTransform("matrix(0, -1, -1, 0, 0, 0)");
    expect(flipped.flipX).toBe(true);
    expect(flipped.rotate).toBe(90);
  });

  it("falls back to idle on malformed input", () => {
    expect(parseTransform("matrix(a, b, c)")).toEqual({ rotate: 0, flipX: false, flipY: false, translate: "" });
  });

  it("reads back the authored syntax it writes (regression: angle reset to 0)", () => {
    expect(parseTransform("rotate(90deg)")).toEqual({ rotate: 90, flipX: false, flipY: false, translate: "" });
    expect(parseTransform("rotate(15deg) scaleX(-1) scaleY(-1)")).toEqual({
      rotate: 15,
      flipX: true,
      flipY: true,
      translate: "",
    });
    expect(parseTransform("scaleY(-1)")).toEqual({ rotate: 0, flipX: false, flipY: true, translate: "" });
  });

  it("accumulates across repeated clicks instead of stalling", () => {
    let value = "none";
    for (let i = 1; i <= 4; i += 1) {
      const state = parseTransform(value);
      value = buildTransform({ ...state, rotate: state.rotate + 90 });
      expect(parseTransform(value).rotate).toBe((90 * i) % 360);
    }
    // Fourth click completes the turn and lands back on none.
    expect(value).toBe("none");
  });

  it("toggles a flip off on the second click", () => {
    const first = buildTransform({ ...parseTransform("none"), flipX: true });
    expect(first).toBe("scaleX(-1)");
    const state = parseTransform(first);
    expect(buildTransform({ ...state, flipX: !state.flipX })).toBe("none");
  });

  it("understands non-degree angle units and rotateZ", () => {
    expect(parseTransform("rotateZ(0.25turn)").rotate).toBe(90);
    expect(parseTransform("rotate(3.14159rad)").rotate).toBe(180);
    expect(parseTransform("rotate(200grad)").rotate).toBe(180);
  });

  it("reads uniform scale() as flips and ignores 3D rotations", () => {
    expect(parseTransform("scale(-1, 1)")).toEqual({ rotate: 0, flipX: true, flipY: false, translate: "" });
    expect(parseTransform("scale(-1)")).toEqual({ rotate: 0, flipX: true, flipY: true, translate: "" });
    expect(parseTransform("rotateX(45deg)").rotate).toBe(0);
  });

  it("keeps a translation the page's own CSS already applied", () => {
    // translate(10px, -4px) → matrix(1, 0, 0, 1, 10, -4)
    expect(parseTransform("matrix(1, 0, 0, 1, 10, -4)").translate).toBe("translate(10px, -4px)");
    expect(parseTransform("translate(-50%, -50%) rotate(15deg)")).toEqual({
      rotate: 15,
      flipX: false,
      flipY: false,
      translate: "translate(-50%, -50%)",
    });
  });

  it("decomposes matrix3d for a Z rotation", () => {
    // rotate(90deg) in 3D form
    const m3d = "matrix3d(0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)";
    expect(parseTransform(m3d).rotate).toBe(90);
  });
});

describe("buildTransform", () => {
  it("returns none when nothing is applied", () => {
    expect(buildTransform({ rotate: 0, flipX: false, flipY: false, translate: "" })).toBe("none");
  });

  it("composes rotation and both flips in a stable order", () => {
    expect(buildTransform({ rotate: 15, flipX: true, flipY: true, translate: "" })).toBe(
      "rotate(15deg) scaleX(-1) scaleY(-1)",
    );
  });

  it("wraps angles past a full turn", () => {
    expect(buildTransform({ rotate: 450, flipX: false, flipY: false, translate: "" })).toBe("rotate(90deg)");
    expect(buildTransform({ rotate: 360, flipX: false, flipY: false, translate: "" })).toBe("none");
  });

  it("emits the preserved translation before the rotation", () => {
    expect(
      buildTransform({
        rotate: 90,
        flipX: false,
        flipY: false,
        translate: "translate(-50%, -50%)",
      }),
    ).toBe("translate(-50%, -50%) rotate(90deg)");
    // A translation alone still counts as a transform.
    expect(
      buildTransform({ rotate: 0, flipX: false, flipY: false, translate: "translate(4px, 0px)" }),
    ).toBe("translate(4px, 0px)");
  });

  it("round-trips a rotation applied on top of an existing translate", () => {
    const state = parseTransform("matrix(1, 0, 0, 1, 10, -4)");
    const next = buildTransform({ ...state, rotate: state.rotate + 90 });
    expect(next).toBe("translate(10px, -4px) rotate(90deg)");
    expect(parseTransform(next)).toEqual({
      rotate: 90,
      flipX: false,
      flipY: false,
      translate: "translate(10px, -4px)",
    });
  });

  it("round-trips through parseTransform for rotation", () => {
    const built = buildTransform({ rotate: 90, flipX: false, flipY: false, translate: "" });
    expect(built).toBe("rotate(90deg)");
    expect(parseTransform("matrix(0, 1, -1, 0, 0, 0)").rotate).toBe(90);
  });
});
