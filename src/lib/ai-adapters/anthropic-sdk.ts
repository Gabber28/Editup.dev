import type { AIAdapter, AdapterContext } from "./types.js";
import type { EnrichedSnapshot } from "../../types/snapshot.js";
import type { EditPlan } from "../../types/edit-plan.js";
import type { ExecuteResult } from "../../types/execute.js";
import { buildPlanPrompt } from "../../../ai-bridge/prompt.js";
import { extractEditPlanFromText } from "../../../ai-bridge/edit-plan.js";
import { PlanFailedError, EditUpError } from "../errors.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_TOKENS = 4096;

export interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface AnthropicClient {
  createMessage(input: {
    model: string;
    apiKey: string;
    maxTokens: number;
    system: string;
    messages: Array<{ role: "user"; content: string }>;
    timeoutMs: number;
  }): Promise<AnthropicMessageResponse>;
}

export class AnthropicSDKAdapter implements AIAdapter {
  readonly name = "anthropic-sdk";
  readonly type = "sdk" as const;

  constructor(private readonly client: AnthropicClient) {}

  async detect(): Promise<boolean> {
    return Boolean(process.env["ANTHROPIC_API_KEY"]);
  }

  async plan(
    snapshot: EnrichedSnapshot,
    context: AdapterContext
  ): Promise<EditPlan> {
    if (!context.apiKey) {
      throw new EditUpError("AnthropicSDKAdapter requires apiKey in context");
    }
    const prompt = buildPlanPrompt({
      snapshot,
      projectRoot: context.projectRoot,
    });

    const response = await this.client.createMessage({
      model: context.model ?? DEFAULT_MODEL,
      apiKey: context.apiKey,
      maxTokens: MAX_TOKENS,
      system: "You return only valid JSON EditPlan objects. No prose.",
      messages: [{ role: "user", content: prompt }],
      timeoutMs: context.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");

    if (!text) {
      throw new PlanFailedError(
        "AnthropicSDKAdapter received empty plan response",
        1
      );
    }

    return extractEditPlanFromText(text);
  }

  async execute(
    _plan: EditPlan,
    _snapshot: EnrichedSnapshot,
    _context: AdapterContext
  ): Promise<ExecuteResult> {
    throw new EditUpError(
      "AnthropicSDKAdapter execute requires tool-use with file editing tools — implement via dedicated executor."
    );
  }

  async isRunning(): Promise<boolean> {
    return false;
  }
}
