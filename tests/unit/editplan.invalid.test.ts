import { describe, it, expect } from "vitest";
import {
  parseEditPlan,
  extractEditPlanFromText,
} from "@bridge/edit-plan.js";
import { SchemaValidationError } from "@/lib/errors.js";
import { makePlan, makePlanFile } from "../helpers/fixtures.js";

describe("EditPlan — invalid inputs rejected", () => {
  it("rejects null input", () => {
    expect(() => parseEditPlan(null)).toThrow(SchemaValidationError);
  });

  it("rejects undefined input", () => {
    expect(() => parseEditPlan(undefined)).toThrow(SchemaValidationError);
  });

  it("rejects primitive number input", () => {
    expect(() => parseEditPlan(42)).toThrow(SchemaValidationError);
  });

  it("rejects empty object", () => {
    expect(() => parseEditPlan({})).toThrow(SchemaValidationError);
  });

  it("rejects missing summary", () => {
    const { summary: _, ...noSummary } = makePlan();
    expect(() => parseEditPlan(noSummary)).toThrow(SchemaValidationError);
  });

  it("rejects missing files", () => {
    const { files: _, ...noFiles } = makePlan();
    expect(() => parseEditPlan(noFiles)).toThrow(SchemaValidationError);
  });

  it("rejects missing confidence", () => {
    const { confidence: _, ...noConf } = makePlan();
    expect(() => parseEditPlan(noConf)).toThrow(SchemaValidationError);
  });

  it("rejects missing recommended_action", () => {
    const { recommended_action: _, ...noAction } = makePlan();
    expect(() => parseEditPlan(noAction)).toThrow(SchemaValidationError);
  });

  it("rejects wrong enum for confidence", () => {
    const bad = { ...makePlan(), confidence: "ultra" };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects wrong enum for recommended_action", () => {
    const bad = { ...makePlan(), recommended_action: "yolo" };
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects wrong enum for change_type in file", () => {
    const bad = makePlan({
      files: [makePlanFile({ change_type: "magic" as "target" })],
    });
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });

  it("rejects file with empty path", () => {
    const bad = makePlan({ files: [makePlanFile({ path: "" })] });
    expect(() => parseEditPlan(bad)).toThrow(SchemaValidationError);
  });
});

describe("extractEditPlanFromText — edge cases", () => {
  it("parses plain JSON", () => {
    const plan = makePlan();
    const result = extractEditPlanFromText(JSON.stringify(plan));
    expect(result.summary).toBe(plan.summary);
  });

  it("parses fenced ```json block", () => {
    const plan = makePlan();
    const text = "Here is the plan:\n```json\n" +
      JSON.stringify(plan) + "\n```\nDone.";
    const result = extractEditPlanFromText(text);
    expect(result.summary).toBe(plan.summary);
  });

  it("parses fenced ``` block without json tag", () => {
    const plan = makePlan();
    const text = "```\n" + JSON.stringify(plan) + "\n```";
    const result = extractEditPlanFromText(text);
    expect(result.summary).toBe(plan.summary);
  });

  it("throws SchemaValidationError on non-JSON text", () => {
    expect(() => extractEditPlanFromText("this is not json")).toThrow(
      SchemaValidationError
    );
  });

  it("throws SchemaValidationError on valid JSON but wrong shape", () => {
    expect(() => extractEditPlanFromText('{"foo": 1}')).toThrow(
      SchemaValidationError
    );
  });

  it("throws on empty string", () => {
    expect(() => extractEditPlanFromText("")).toThrow(SchemaValidationError);
  });

  it("extracts from fenced block even with surrounding prose", () => {
    const plan = makePlan({ summary: "unique-marker" });
    const text = "I recommend:\n```json\n" +
      JSON.stringify(plan) +
      "\n```\nLet me know if you approve.";
    const result = extractEditPlanFromText(text);
    expect(result.summary).toBe("unique-marker");
  });
});
