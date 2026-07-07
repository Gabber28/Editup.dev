import type { AIAdapter, DetectionResult } from "./types.js";
import { AdapterNotFoundError } from "../errors.js";
import { logger } from "../logger.js";

export class AdapterRegistry {
  private readonly adapters = new Map<string, AIAdapter>();

  register(adapter: AIAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter already registered: ${adapter.name}`);
    }
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): AIAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new AdapterNotFoundError(`Adapter not registered: ${name}`);
    }
    return adapter;
  }

  list(): AIAdapter[] {
    return Array.from(this.adapters.values());
  }

  async detectAvailable(): Promise<DetectionResult> {
    const adapters = Array.from(this.adapters.values());
    const results = await Promise.allSettled(
      adapters.map(async (adapter) => {
        const found = await adapter.detect();
        return { adapter, found };
      })
    );

    const available: AIAdapter[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.found) {
        available.push(result.value.adapter);
        logger.info("adapter detected", {
          adapter: result.value.adapter.name,
          type: result.value.adapter.type,
        });
      } else if (result.status === "rejected") {
        logger.warn("adapter detection failed", {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    const order: Array<AIAdapter["type"]> = ["mcp", "cli", "sdk", "clipboard"];
    const planCapable = available.filter((a) => a.type !== "clipboard");
    const preferred = planCapable.sort(
      (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
    )[0];

    return { available, preferred };
  }
}
