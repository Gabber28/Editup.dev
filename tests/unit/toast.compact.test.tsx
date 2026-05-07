import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ApprovalToast } from "@/components/toast/approval-toast.js";
import { makePlan, makePlanFile } from "../helpers/fixtures.js";

describe("ApprovalToast — compact (high confidence, no side effects)", () => {
  const highNoPlan = makePlan({
    confidence: "high",
    side_effects: [],
    summary: "Update button background color",
    files: [makePlanFile({ path: "src/Button.tsx" })],
  });

  it("renders plan summary in the title", () => {
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/Apply changes/)).toBeTruthy();
    expect(screen.getByText(/1 file/)).toBeTruthy();
  });

  it("shows correct file count for multiple files", () => {
    const plan = makePlan({
      confidence: "high",
      side_effects: [],
      files: [
        makePlanFile({ path: "a.tsx" }),
        makePlanFile({ path: "b.css" }),
        makePlanFile({ path: "c.ts" }),
      ],
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/3 files/)).toBeTruthy();
  });

  it("displays the file paths", () => {
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText(/src\/Button\.tsx/)).toBeTruthy();
  });

  it("does not show side effects section", () => {
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Side effects/)).toBeNull();
  });

  it("does not show alternatives section for high confidence", () => {
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Alternatives/)).toBeNull();
  });

  it("Enter key calls onApprove", () => {
    const onApprove = vi.fn();
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("Escape key calls onReject", () => {
    const onReject = vi.fn();
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("clicking Apply button calls onApprove", () => {
    const onApprove = vi.fn();
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={onApprove}
        onReject={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/Apply/));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("clicking Cancel button calls onReject", () => {
    const onReject = vi.fn();
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={vi.fn()}
        onReject={onReject}
      />,
    );
    fireEvent.click(screen.getByText(/Cancel/));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it("has alertdialog role for accessibility", () => {
    render(
      <ApprovalToast
        plan={highNoPlan}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
