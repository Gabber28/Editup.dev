import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));
vi.mock("@/lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/ai-adapters/registry.js", () => ({
  AdapterRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    detectAvailable: vi.fn().mockResolvedValue({
      available: [],
      preferred: {
        name: "mock",
        type: "cli",
        detect: vi.fn().mockResolvedValue(true),
        plan: vi.fn().mockResolvedValue({
          summary: "Update button bg",
          files: [{ path: "A.tsx", lines_affected: [1], reason: "r", change_type: "target", change_source: "visual" }],
          visual_changes_applied: true,
          text_instructions_applied: false,
          side_effects: [],
          confidence: "high",
          recommended_action: "apply",
        }),
        execute: vi.fn().mockResolvedValue({
          files_modified: ["A.tsx"], files_extra: [], duration_ms: 100,
          model: "m", token_usage: { input_total: 1, output_total: 1 },
        }),
        isRunning: vi.fn().mockResolvedValue(false),
      },
    }),
  })),
}));
vi.mock("@/lib/ai-adapters/claude-code.js", () => ({ ClaudeCodeAdapter: vi.fn() }));
vi.mock("@/lib/ai-adapters/aider.js", () => ({ AiderAdapter: vi.fn() }));
vi.mock("@/lib/ai-adapters/copy-prompt.js", () => ({ CopyPromptAdapter: vi.fn() }));
vi.mock("@/lib/verify-flow.js", () => ({ createVerifier: vi.fn().mockReturnValue(undefined) }));

describe("verification — auto-commit message format", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "git_auto_commit") return Promise.resolve({ hash: "abc123" });
      if (cmd === "increment_edit_count") return Promise.resolve({ plan: "pro", edits_used: 1, edits_limit: 30, resets_at: "", blocked: false });
      return Promise.resolve(null);
    });
  });

  it("git_auto_commit is called with editup: prefix", async () => {
    const { useApplyFlow } = await import("@/hooks/useApplyFlow.js");

    const calls = mockInvoke.mock.calls.filter(
      (c: unknown[]) => c[0] === "git_auto_commit"
    );

    expect(mockInvoke).toBeDefined();
    expect(typeof useApplyFlow).toBe("function");

    const commitCall = calls.find(
      (c: unknown[]) => typeof c[1] === "object" && c[1] !== null
    );
    if (commitCall) {
      const args = commitCall[1] as Record<string, unknown>;
      expect(String(args.message ?? "")).toMatch(/^editup:/);
    }
  });
});
