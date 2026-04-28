import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult } from "@/types/execute.js";

export type AdapterType = "cli" | "mcp" | "sdk" | "clipboard";

export interface AdapterContext {
  projectRoot: string;
  sessionToken: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export interface AIAdapter {
  readonly name: string;
  readonly type: AdapterType;
  detect(): Promise<boolean>;
  plan(
    snapshot: EnrichedSnapshot,
    context: AdapterContext
  ): Promise<EditPlan>;
  execute(
    plan: EditPlan,
    snapshot: EnrichedSnapshot,
    context: AdapterContext
  ): Promise<ExecuteResult>;
  isRunning(): Promise<boolean>;
}

export interface DetectionResult {
  available: AIAdapter[];
  preferred?: AIAdapter | undefined;
}
