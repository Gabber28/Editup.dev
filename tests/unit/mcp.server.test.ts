import { describe, it, expect, beforeEach } from "vitest";
import { MCPServer } from "@/lib/ai-adapters/mcp-server.js";
import type { MCPToolResult } from "@/lib/ai-adapters/mcp-server.js";
import { makeSnapshot, makePlan } from "../helpers/fixtures.js";

const TOKEN = "valid-session-token-uuid";

function createServer(): MCPServer {
  return new MCPServer({
    host: "127.0.0.1",
    port: 9201,
    sessionToken: TOKEN,
  });
}

describe("MCPServer — tool dispatch and responses", () => {
  let server: MCPServer;

  beforeEach(() => {
    server = createServer();
  });

  it("editup_get_snapshot returns null when no snapshot set", async () => {
    const result = await server.handleTool(
      { name: "editup_get_snapshot", arguments: {} },
      TOKEN
    );
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.json).toBeNull();
  });

  it("editup_get_snapshot returns the set snapshot", async () => {
    const snapshot = makeSnapshot();
    server.setSnapshot(snapshot);

    const result = await server.handleTool(
      { name: "editup_get_snapshot", arguments: {} },
      TOKEN
    );
    expect(result.content[0]?.json).toEqual(snapshot);
  });

  it("editup_get_plan returns null when no plan set", async () => {
    const result = await server.handleTool(
      { name: "editup_get_plan", arguments: {} },
      TOKEN
    );
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.json).toBeNull();
  });

  it("editup_get_plan returns the set plan", async () => {
    const plan = makePlan();
    server.setPlan(plan);

    const result = await server.handleTool(
      { name: "editup_get_plan", arguments: {} },
      TOKEN
    );
    expect(result.content[0]?.json).toEqual(plan);
  });

  it("setPlan transitions status to awaiting_approval", async () => {
    server.setPlan(makePlan());

    const result = await server.handleTool(
      { name: "editup_get_status", arguments: {} },
      TOKEN
    );
    const json = result.content[0]?.json as { status: string };
    expect(json.status).toBe("awaiting_approval");
  });

  it("editup_get_status returns idle by default", async () => {
    const result = await server.handleTool(
      { name: "editup_get_status", arguments: {} },
      TOKEN
    );
    const json = result.content[0]?.json as { status: string };
    expect(json.status).toBe("idle");
  });

  it("setStatus updates the reported status", async () => {
    server.setStatus("executing");

    const result = await server.handleTool(
      { name: "editup_get_status", arguments: {} },
      TOKEN
    );
    const json = result.content[0]?.json as { status: string };
    expect(json.status).toBe("executing");
  });

  it("editup_apply_plan returns acknowledgment text", async () => {
    const result = await server.handleTool(
      { name: "editup_apply_plan", arguments: {} },
      TOKEN
    );
    expect(result.isError).toBeFalsy();
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("Plan apply requested");
  });

  it("returns error for unknown tool name", async () => {
    const result = await server.handleTool(
      { name: "editup_nonexistent", arguments: {} },
      TOKEN
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("Unknown tool");
  });

  it("rejects every tool call when token is invalid", async () => {
    server.setSnapshot(makeSnapshot());
    const tools = [
      "editup_get_snapshot",
      "editup_get_plan",
      "editup_apply_plan",
      "editup_get_status",
    ];

    const results: MCPToolResult[] = [];
    for (const name of tools) {
      results.push(
        await server.handleTool({ name, arguments: {} }, "bad-token")
      );
    }

    for (const r of results) {
      expect(r.isError).toBe(true);
      expect(r.content[0]?.text).toBe("Invalid session token");
    }
  });

  it("listTools returns exactly 4 tools with descriptions", () => {
    const tools = server.listTools();
    expect(tools).toHaveLength(4);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^editup_/);
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("snapshot and plan are independent state slots", async () => {
    const snapshot = makeSnapshot();
    const plan = makePlan({ summary: "custom plan" });
    server.setSnapshot(snapshot);
    server.setPlan(plan);

    const snapResult = await server.handleTool(
      { name: "editup_get_snapshot", arguments: {} },
      TOKEN
    );
    const planResult = await server.handleTool(
      { name: "editup_get_plan", arguments: {} },
      TOKEN
    );

    expect(snapResult.content[0]?.json).toEqual(snapshot);
    const planJson = planResult.content[0]?.json as { summary: string };
    expect(planJson.summary).toBe("custom plan");
  });
});
