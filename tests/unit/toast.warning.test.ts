import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApprovalToast } from "@/components/toast/approval-toast.js";
import { makePlan, makePlanFile } from "../helpers/fixtures.js";

describe("ApprovalToast — side-effect warnings", () => {
  it("displays side effects when plan has them", () => {
    const plan = makePlan({
      side_effects: ["Shared .btn class may affect other buttons"],
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/Side effects/)).toBeTruthy();
    expect(
      screen.getByText(/Shared \.btn class may affect other buttons/),
    ).toBeTruthy();
  });

  it("joins multiple side effects with semicolons", () => {
    const plan = makePlan({
      side_effects: ["Affects navbar", "Changes global token"],
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    const el = screen.getByText(/Affects navbar; Changes global token/);
    expect(el).toBeTruthy();
  });

  it("side-effect text uses accent color styling", () => {
    const plan = makePlan({
      side_effects: ["Leaks to siblings"],
    });
    const { container } = render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    const sideEffectEl = container.querySelector(
      "[style*='color']",
    ) as HTMLElement | null;
    expect(sideEffectEl).not.toBeNull();
    const text = sideEffectEl?.textContent ?? "";
    expect(text).toContain("Side effects");
  });

  it("does not render side-effect section when array is empty", () => {
    const plan = makePlan({ side_effects: [] });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.queryByText(/Side effects/)).toBeNull();
  });

  it("shows both side effects and file info together", () => {
    const plan = makePlan({
      files: [
        makePlanFile({ path: "src/Button.tsx" }),
        makePlanFile({ path: "src/styles.css" }),
      ],
      side_effects: ["Global token change"],
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/2 files/)).toBeTruthy();
    expect(screen.getByText(/Global token change/)).toBeTruthy();
  });

  it("renders warning for medium confidence with side effects", () => {
    const plan = makePlan({
      confidence: "medium",
      side_effects: ["May break layout"],
      recommended_action: "review_first",
    });
    render(
      <ApprovalToast plan={plan} onApprove={vi.fn()} onReject={vi.fn()} />,
    );
    expect(screen.getByText(/Side effects/)).toBeTruthy();
    expect(screen.getByText(/May break layout/)).toBeTruthy();
  });
});
