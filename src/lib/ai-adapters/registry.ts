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
    const available: AIAdapter[] = [];
    for (const adapter of this.adapters.values()) {
      try {
        const found = await adapter.detect();
        if (found) {
          available.push(adapter);
          logger.info("adapter detected", {
            adapter: adapter.name,
            type: adapter.type,
          });
        }
      } catch (err) {
        logger.warn("adapter detection failed", {
          adapter: adapter.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const order: Array<AIAdapter["type"]> = ["mcp", "cli", "sdk", "clipboard"];
    const preferred = available.sort(
      (a, b) => order.indexOf(a.type) - order.indexOf(b.type)
    )[0];

    return { available, preferred };
  }
}
