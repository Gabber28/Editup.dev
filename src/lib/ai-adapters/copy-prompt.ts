import type { AIAdapter, AdapterContext } from "./types.js";
import type { EnrichedSnapshot } from "@/types/snapshot.js";
import type { EditPlan } from "@/types/edit-plan.js";
import type { ExecuteResult } from "@/types/execute.js";
import { buildPlanPrompt } from "@bridge/prompt.js";
import { EditUpError } from "@/lib/errors.js";

export interface ClipboardWriter {
  write(text: string): Promise<void>;
}

export class CopyPromptAdapter implements AIAdapter {
  readonly name = "copy-prompt";
  readonly type = "clipboard" as const;

  constructor(private readonly clipboard: ClipboardWriter) {}

  async detect(): Promise<boolean> {
    return true;
  }

  async plan(
    snapshot: EnrichedSnapshot,
    context: AdapterContext
  ): Promise<EditPlan> {
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: context.projectRoot,
    });
    await this.clipboard.write(prompt);
    throw new EditUpError(
      "CopyPromptAdapter does not produce an EditPlan automatically. Prompt copied to clipboard."
    );
  }

  async execute(
    _plan: EditPlan,
    _snapshot: EnrichedSnapshot,
    _context: AdapterContext
  ): Promise<ExecuteResult> {
    throw new EditUpError(
      "CopyPromptAdapter does not execute plans — the developer applies edits manually via their AI tool."
    );
  }

  async isRunning(): Promise<boolean> {
    return false;
  }
}
