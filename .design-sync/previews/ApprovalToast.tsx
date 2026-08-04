import type { ReactNode } from "react";
import { ApprovalToast } from "editup";

// .toast is position:fixed — the transform on this wrapper makes the fixed
// toast anchor to the card cell instead of the viewport.
const Anchor = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      transform: "translateZ(0)",
      position: "relative",
      minHeight: 170,
      background: "var(--color-bg)",
      color: "var(--color-fg)",
    }}
  >
    {children}
  </div>
);

const noop = () => {};

export const HighConfidenceCompact = () => (
  <Anchor>
    <ApprovalToast
      onApprove={noop}
      onReject={noop}
      plan={{
        summary: "Round the primary button and increase padding",
        files: [
          {
            path: "src/components/pricing-card.tsx",
            lines_affected: [42],
            reason: "Target element edited visually",
            change_type: "target",
            change_source: "visual",
          },
        ],
        visual_changes_applied: true,
        text_instructions_applied: false,
        side_effects: [],
        confidence: "high",
        recommended_action: "apply",
      }}
    />
  </Anchor>
);

export const WithSideEffects = () => (
  <Anchor>
    <ApprovalToast
      onApprove={noop}
      onReject={noop}
      onShowDetails={noop}
      plan={{
        summary: "Update the shared Button component accent color",
        files: [
          {
            path: "src/components/ui/button.tsx",
            lines_affected: [18, 24],
            reason: "Shared component styles the selected element",
            change_type: "shared_component",
            change_source: "visual",
          },
          {
            path: "src/styles/tokens.css",
            lines_affected: [7],
            reason: "Accent token referenced by the button",
            change_type: "design_token",
            change_source: "visual",
          },
        ],
        visual_changes_applied: true,
        text_instructions_applied: false,
        side_effects: [
          "12 other buttons using Button will change color",
        ],
        confidence: "medium",
        recommended_action: "review_first",
      }}
    />
  </Anchor>
);

export const LowConfidenceWithAlternatives = () => (
  <Anchor>
    <ApprovalToast
      onApprove={noop}
      onReject={noop}
      onShowDetails={noop}
      plan={{
        summary: "Add hover glow to the hero CTA",
        files: [
          {
            path: "src/app/globals.css",
            lines_affected: [88],
            reason: "Hover state must live in a stylesheet",
            change_type: "linked_style",
            change_source: "text_instruction",
          },
        ],
        visual_changes_applied: false,
        text_instructions_applied: true,
        side_effects: [],
        confidence: "low",
        recommended_action: "consider_alternatives",
        alternatives: [
          {
            description: "Use a box-shadow transition on the existing class",
            pros: ["No new CSS rules"],
            cons: ["Weaker glow effect"],
          },
          {
            description: "Add a dedicated .cta-glow utility class",
            pros: ["Reusable on other CTAs"],
            cons: ["One more global class"],
          },
        ],
      }}
    />
  </Anchor>
);
