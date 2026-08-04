/** What a Claude Code run actually did, as reported by its own output. */
export interface ClaudeRunOutcome {
  /** Final assistant text (the plan JSON, for the plan step). */
  text: string;
  /** Absolute paths the run edited successfully — the ground truth. */
  filesEdited: string[];
  /** True when the CLI itself flagged the run as failed. */
  isError: boolean;
  /** "success", "error_max_turns", "error_during_execution", … */
  subtype: string;
  /** Tools the run was blocked from using (a denied Edit still exits 0). */
  permissionDenials: string[];
  usage: { input_total: number; output_total: number };
}

/** Tools whose successful use means a file on disk changed. */
const EDIT_TOOLS = new Set(["Edit", "MultiEdit", "Write", "NotebookEdit"]);

interface ToolUseBlock {
  type?: string;
  id?: string;
  name?: string;
  input?: { file_path?: string; path?: string };
}

interface ToolResultBlock {
  type?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

interface StreamEvent {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  permission_denials?: Array<{ tool_name?: string } | string>;
  message?: { content?: Array<ToolUseBlock & ToolResultBlock> };
  content?: Array<{ text?: string }>;
}

function emptyOutcome(): ClaudeRunOutcome {
  return {
    text: "",
    filesEdited: [],
    isError: false,
    subtype: "",
    permissionDenials: [],
    usage: { input_total: 0, output_total: 0 },
  };
}

function denialName(entry: { tool_name?: string } | string): string {
  return typeof entry === "string" ? entry : (entry.tool_name ?? "unknown");
}

/**
 * Reads the CLI's output into what actually happened.
 *
 * Accepts both shapes the CLI can emit: the newline-delimited stream
 * (`--output-format stream-json`), which carries the per-tool records proving
 * which files were written, and the single terminal object
 * (`--output-format json`), which carries only the final text.
 *
 * @param stdout Raw stdout from the `claude` process
 * @returns The run's text, the files it really edited, and its error signals
 */
export function parseClaudeOutput(stdout: string): ClaudeRunOutcome {
  const outcome = emptyOutcome();
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);

  // tool_use id → file path, promoted to filesEdited once its result is OK.
  const pending = new Map<string, string>();
  const edited = new Set<string>();
  let sawEvent = false;

  for (const line of lines) {
    let event: StreamEvent;
    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      continue;
    }
    sawEvent = true;

    for (const block of event.message?.content ?? []) {
      if (block.type === "tool_use" && block.name && EDIT_TOOLS.has(block.name)) {
        const path = block.input?.file_path ?? block.input?.path;
        if (path && block.id) pending.set(block.id, path);
        // Without an id we cannot pair the result; count it optimistically —
        // a denied tool still shows up in permission_denials below.
        else if (path) edited.add(path);
      }
      if (block.type === "tool_result" && block.tool_use_id) {
        const path = pending.get(block.tool_use_id);
        if (path && block.is_error !== true) edited.add(path);
        pending.delete(block.tool_use_id);
      }
    }

    if (event.type === "result" || event.result !== undefined) {
      if (typeof event.result === "string") outcome.text = event.result;
      if (event.is_error === true) outcome.isError = true;
      if (event.subtype) outcome.subtype = event.subtype;
      outcome.permissionDenials = (event.permission_denials ?? []).map(denialName);
      outcome.usage = {
        input_total: event.usage?.input_tokens ?? 0,
        output_total: event.usage?.output_tokens ?? 0,
      };
    }

    if (!outcome.text && Array.isArray(event.content)) {
      outcome.text = event.content.map((c) => c.text ?? "").filter(Boolean).join("\n");
    }
  }

  // A pretty-printed single object spans several lines, so none of them parse.
  if (!sawEvent) {
    try {
      const whole = JSON.parse(stdout) as StreamEvent;
      if (typeof whole.result === "string") outcome.text = whole.result;
      if (whole.is_error === true) outcome.isError = true;
      if (whole.subtype) outcome.subtype = whole.subtype;
      outcome.usage = {
        input_total: whole.usage?.input_tokens ?? 0,
        output_total: whole.usage?.output_tokens ?? 0,
      };
    } catch {
      // Not JSON at all — the raw text still lets the plan step recover.
    }
  }
  if (!outcome.text) outcome.text = stdout;

  outcome.filesEdited = Array.from(edited);
  return outcome;
}
