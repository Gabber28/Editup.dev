import type { EnrichedSnapshot } from "../../types/snapshot.js";
import type { EditPlan } from "../../types/edit-plan.js";
import { SecurityViolationError } from "../errors.js";
import { logger } from "../logger.js";

const ALLOWED_HOST = "127.0.0.1";

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{ type: "text" | "json"; text?: string; json?: unknown }>;
  isError?: boolean;
}

export interface MCPServerState {
  currentSnapshot?: EnrichedSnapshot;
  currentPlan?: EditPlan;
  status: "idle" | "planning" | "awaiting_approval" | "executing" | "verifying";
}

export interface MCPServerConfig {
  host: string;
  port: number;
  sessionToken: string;
}

export function assertLocalhostBinding(host: string): void {
  if (host !== ALLOWED_HOST) {
    throw new SecurityViolationError(
      `MCP server must bind to ${ALLOWED_HOST}, got: ${host}`
    );
  }
}

export class MCPServer {
  private state: MCPServerState = { status: "idle" };

  constructor(private readonly config: MCPServerConfig) {
    assertLocalhostBinding(config.host);
  }

  setSnapshot(snapshot: EnrichedSnapshot): void {
    this.state.currentSnapshot = snapshot;
  }

  setPlan(plan: EditPlan): void {
    this.state.currentPlan = plan;
    this.state.status = "awaiting_approval";
  }

  setStatus(status: MCPServerState["status"]): void {
    this.state.status = status;
  }

  validateToken(provided: string): boolean {
    if (provided.length !== this.config.sessionToken.length) return false;
    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) {
      mismatch |=
        provided.charCodeAt(i) ^ this.config.sessionToken.charCodeAt(i);
    }
    return mismatch === 0;
  }

  async handleTool(
    call: MCPToolCall,
    token: string
  ): Promise<MCPToolResult> {
    if (!this.validateToken(token)) {
      logger.warn("mcp tool call with invalid token", { tool: call.name });
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid session token" }],
      };
    }

    switch (call.name) {
      case "editup_get_snapshot":
        return {
          content: [
            {
              type: "json",
              json: this.state.currentSnapshot ?? null,
            },
          ],
        };
      case "editup_get_plan":
        return {
          content: [
            { type: "json", json: this.state.currentPlan ?? null },
          ],
        };
      case "editup_get_status":
        return {
          content: [
            {
              type: "json",
              json: { status: this.state.status },
            },
          ],
        };
      case "editup_apply_plan":
        return {
          content: [
            {
              type: "text",
              text: "Plan apply requested via MCP. Approval handled by Tauri app.",
            },
          ],
        };
      default:
        return {
          isError: true,
          content: [
            { type: "text", text: `Unknown tool: ${call.name}` },
          ],
        };
    }
  }

  listTools(): Array<{ name: string; description: string }> {
    return [
      {
        name: "editup_get_snapshot",
        description:
          "Returns the current EnrichedSnapshot of the selected element",
      },
      {
        name: "editup_get_plan",
        description: "Returns the current EditPlan for pending changes",
      },
      {
        name: "editup_apply_plan",
        description: "Requests apply of the current plan (requires approval)",
      },
      {
        name: "editup_get_status",
        description: "Returns current edit pipeline status",
      },
    ];
  }
}
