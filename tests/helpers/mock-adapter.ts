import { vi } from "vitest";
import type { AIAdapter, AdapterContext } from "@/lib/ai-adapters/types.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult } from "@/types/execute.js";
import { makePlan, makeExecuteResult } from "./fixtures.js";

export interface MockAdapterOptions {
  name?: string;
  type?: AIAdapter["type"];
  detectable?: boolean;
  planResult?: EditPlan;
  executeResult?: ExecuteResult;
  shouldFailPlan?: boolean;
  shouldFailExecute?: boolean;
}

export class MockAdapter implements AIAdapter {
  readonly name: string;
  readonly type: AIAdapter["type"];

  plan: AIAdapter["plan"];
  execute: AIAdapter["execute"];
  detect: AIAdapter["detect"];
  isRunning: AIAdapter["isRunning"];

  constructor(opts: MockAdapterOptions = {}) {
    this.name = opts.name ?? "mock";
    this.type = opts.type ?? "cli";

    this.detect = vi.fn<() => Promise<boolean>>().mockResolvedValue(
      opts.detectable ?? true
    );

    this.isRunning = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);

    if (opts.shouldFailPlan) {
      this.plan = vi.fn<(s: EnrichedSnapshot, c: AdapterContext) => Promise<EditPlan>>()
        .mockRejectedValue(new Error("plan failed"));
    } else {
      this.plan = vi.fn<(s: EnrichedSnapshot, c: AdapterContext) => Promise<EditPlan>>()
        .mockResolvedValue(opts.planResult ?? makePlan());
    }

    if (opts.shouldFailExecute) {
      this.execute = vi.fn<(p: EditPlan, s: EnrichedSnapshot, c: AdapterContext) => Promise<ExecuteResult>>()
        .mockRejectedValue(new Error("execute failed"));
    } else {
      this.execute = vi.fn<(p: EditPlan, s: EnrichedSnapshot, c: AdapterContext) => Promise<ExecuteResult>>()
        .mockResolvedValue(opts.executeResult ?? makeExecuteResult());
    }
  }
}
