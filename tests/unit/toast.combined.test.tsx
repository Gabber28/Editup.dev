import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApprovalToast } from "@/components/toast/approval-toast.js";
import { makePlan, makePlanFile } from "../helpers/fixtures.js";

describe("ApprovalToast — combined visual + text changes", () => {
  it("renders plan with only visual change_source files", () => {
    const plan = makePlan({
      files: [makePlanFile({ path: "src/A.tsx", change_source: "visual" })],
      visual_changes_applied: true,
      text_instructions_applied: false,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/1 file/)).toBeTruthy();
    expect(screen.getByText(/src\/A\.tsx/)).toBeTruthy();
  });

  it("renders plan with only text_instruction change_source files", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "src/B.css", change_source: "text_instruction" }),
      ],
      visual_changes_applied: false,
      text_instructions_applied: true,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/1 file/)).toBeTruthy();
    expect(screen.getByText(/src\/B\.css/)).toBeTruthy();
  });

  it("renders plan with mixed change_source files", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "src/C.tsx", change_source: "visual" }),
        makePlanFile({ path: "src/D.css", change_source: "text_instruction" }),
        makePlanFile({ path: "src/E.tsx", change_source: "both" }),
      ],
      visual_changes_applied: true,
      text_instructions_applied: true,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/3 files/)).toBeTruthy();
  });

  it("shows all file paths for mixed-source plans", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "src/Visual.tsx", change_source: "visual" }),
        makePlanFile({ path: "src/Text.css", change_source: "text_instruction" }),
      ],
      visual_changes_applied: true,
      text_instructions_applied: true,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/src\/Visual\.tsx/)).toBeTruthy();
    expect(screen.getByText(/src\/Text\.css/)).toBeTruthy();
  });

  it("correctly counts files with change_source 'both'", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "src/F.tsx", change_source: "both" }),
        makePlanFile({ path: "src/G.tsx", change_source: "both" }),
      ],
      visual_changes_applied: true,
      text_instructions_applied: true,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/2 files/)).toBeTruthy();
  });

  it("renders correctly with single file singular label", () => {
    const plan = makePlan({
      files: [makePlanFile({ path: "src/Only.tsx", change_source: "both" })],
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/1 file\b/)).toBeTruthy();
  });
});
