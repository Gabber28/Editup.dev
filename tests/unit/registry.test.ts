import { describe, it, expect } from "vitest";
import { AdapterRegistry } from "../../src/lib/ai-adapters/registry.js";
import { AdapterNotFoundError } from "../../src/lib/errors.js";
import type {
  AIAdapter,
  AdapterContext,
} from "../../src/lib/ai-adapters/types.js";
import type { EnrichedSnapshot } from "../../src/types/snapshot.js";
import type { EditPlan } from "../../src/types/edit-plan.js";
import type { ExecuteResult } from "../../src/types/execute.js";

class MockAdapter implements AIAdapter {
  constructor(
    public readonly name: string,
    public readonly type: AIAdapter["type"],
    private readonly available: boolean
  ) {}

  async detect(): Promise<boolean> {
    return this.available;
  }

  async plan(
    _s: EnrichedSnapshot,
    _c: AdapterContext
  ): Promise<EditPlan> {
    throw new Error("not implemented");
  }

  async execute(
    _p: EditPlan,
    _s: EnrichedSnapshot,
    _c: AdapterContext
  ): Promise<ExecuteResult> {
    throw new Error("not implemented");
  }

  async isRunning(): Promise<boolean> {
    return false;
  }
}

describe("AdapterRegistry", () => {
  it("registers and retrieves adapters", () => {
    const registry = new AdapterRegistry();
    const a = new MockAdapter("a", "cli", true);
    registry.register(a);
    expect(registry.get("a")).toBe(a);
  });

  it("throws on duplicate registration", () => {
    const registry = new AdapterRegistry();
    registry.register(new MockAdapter("a", "cli", true));
    expect(() => registry.register(new MockAdapter("a", "cli", true))).toThrow();
  });

  it("throws AdapterNotFoundError for unknown name", () => {
    const registry = new AdapterRegistry();
    expect(() => registry.get("missing")).toThrow(AdapterNotFoundError);
  });

  it("detects only available adapters", async () => {
    const registry = new AdapterRegistry();
    registry.register(new MockAdapter("yes", "cli", true));
    registry.register(new MockAdapter("no", "cli", false));
    const result = await registry.detectAvailable();
    expect(result.available.map((a) => a.name)).toEqual(["yes"]);
  });

  it("prefers MCP > CLI > SDK > clipboard", async () => {
    const registry = new AdapterRegistry();
    registry.register(new MockAdapter("clip", "clipboard", true));
    registry.register(new MockAdapter("cli1", "cli", true));
    registry.register(new MockAdapter("sdk1", "sdk", true));
    registry.register(new MockAdapter("mcp1", "mcp", true));
    const result = await registry.detectAvailable();
    expect(result.preferred?.name).toBe("mcp1");
  });

  it("survives detect() throwing", async () => {
    const registry = new AdapterRegistry();
    const broken = new MockAdapter("broken", "cli", true);
    broken.detect = async (): Promise<boolean> => {
      throw new Error("boom");
    };
    registry.register(broken);
    registry.register(new MockAdapter("ok", "cli", true));
    const result = await registry.detectAvailable();
    expect(result.available.map((a) => a.name)).toEqual(["ok"]);
  });
});
