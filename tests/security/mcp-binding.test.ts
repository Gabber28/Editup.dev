import { describe, it, expect } from "vitest";
import {
  MCPServer,
  assertLocalhostBinding,
} from "@/lib/ai-adapters/mcp-server.js";
import { SecurityViolationError } from "@/lib/errors.js";

describe("security — MCP server binding", () => {
  it("rejects 0.0.0.0 binding", () => {
    expect(() => assertLocalhostBinding("0.0.0.0")).toThrow(
      SecurityViolationError
    );
  });

  it("rejects external IP binding", () => {
    expect(() => assertLocalhostBinding("192.168.1.10")).toThrow(
      SecurityViolationError
    );
  });

  it("rejects empty string binding", () => {
    expect(() => assertLocalhostBinding("")).toThrow(SecurityViolationError);
  });

  it("accepts 127.0.0.1 binding", () => {
    expect(() => assertLocalhostBinding("127.0.0.1")).not.toThrow();
  });

  it("MCPServer constructor enforces 127.0.0.1", () => {
    expect(
      () =>
        new MCPServer({
          host: "0.0.0.0",
          port: 9201,
          sessionToken: "test",
        })
    ).toThrow(SecurityViolationError);
  });

  it("MCPServer rejects calls with invalid token", async () => {
    const server = new MCPServer({
      host: "127.0.0.1",
      port: 9201,
      sessionToken: "real-token",
    });
    const result = await server.handleTool(
      { name: "editup_get_status", arguments: {} },
      "wrong-token"
    );
    expect(result.isError).toBe(true);
  });

  it("MCPServer accepts calls with valid token", async () => {
    const server = new MCPServer({
      host: "127.0.0.1",
      port: 9201,
      sessionToken: "real-token",
    });
    const result = await server.handleTool(
      { name: "editup_get_status", arguments: {} },
      "real-token"
    );
    expect(result.isError).toBeFalsy();
  });

  it("token validation is constant time (length difference returns false)", () => {
    const server = new MCPServer({
      host: "127.0.0.1",
      port: 9201,
      sessionToken: "abc",
    });
    expect(server.validateToken("abcdef")).toBe(false);
  });

  it("lists exactly the 4 documented tools", () => {
    const server = new MCPServer({
      host: "127.0.0.1",
      port: 9201,
      sessionToken: "x",
    });
    const tools = server.listTools().map((t) => t.name);
    expect(tools).toEqual([
      "editup_get_snapshot",
      "editup_get_plan",
      "editup_apply_plan",
      "editup_get_status",
    ]);
  });
});
