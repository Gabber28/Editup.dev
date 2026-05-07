import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApprovalToast } from "@/components/toast/approval-toast.js";
import { makePlan } from "../helpers/fixtures.js";
import type { EditPlanAlternative } from "@/types/edit-plan.js";

const twoAlternatives: EditPlanAlternative[] = [
  {
    description: "Use CSS variables instead",
    pros: ["Easier to maintain"],
    cons: ["Requires setup"],
  },
  {
    description: "Inline styles only",
    pros: ["No side effects"],
    cons: ["Hard to override"],
  },
];

describe("ApprovalToast — low confidence / alternatives", () => {
  it("shows alternatives section when confidence is low", () => {
    const plan = makePlan({
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: twoAlternatives,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/Alternatives/)).toBeTruthy();
  });

  it("lists each alternative description", () => {
    const plan = makePlan({
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: twoAlternatives,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText("Use CSS variables instead")).toBeTruthy();
    expect(screen.getByText("Inline styles only")).toBeTruthy();
  });

  it("does not show alternatives when confidence is high", () => {
    const plan = makePlan({
      confidence: "high",
      recommended_action: "apply",
      alternatives: twoAlternatives,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText(/Alternatives/)).toBeNull();
  });

  it("auto-expands for consider_alternatives action", () => {
    const plan = makePlan({
      confidence: "medium",
      recommended_action: "consider_alternatives",
      alternatives: twoAlternatives,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/Alternatives/)).toBeTruthy();
    expect(screen.getByText("Use CSS variables instead")).toBeTruthy();
  });

  it("does not show alternatives if list is undefined", () => {
    const plan = makePlan({
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: undefined,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText(/Alternatives/)).toBeNull();
  });

  it("renders Apply and Cancel buttons even when expanded", () => {
    const plan = makePlan({
      confidence: "low",
      recommended_action: "consider_alternatives",
      alternatives: twoAlternatives,
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/Apply/)).toBeTruthy();
    expect(screen.getByText(/Cancel/)).toBeTruthy();
  });
});
