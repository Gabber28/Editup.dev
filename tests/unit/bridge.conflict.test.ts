import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManager } from "@/lib/ai-adapters/session-manager.js";
import { SessionConflictError } from "@/lib/errors.js";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "editup-conflict-"));
});

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true });
});

describe("SessionManager — conflict scenarios", () => {
  it("SessionConflictError carries the existing PID", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "claude-code",
      aiPid: process.pid,
    });

    try {
      await mgr.start({
        projectRoot: "/proj/x",
        aiAdapter: "aider",
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SessionConflictError);
      const conflict = err as SessionConflictError;
      expect(conflict.existingPid).toBe(process.pid);
      expect(conflict.message).toContain("/proj/x");
    }
  });

  it("allows session for different projects even when one is alive", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/proj/a",
      aiAdapter: "claude-code",
      aiPid: process.pid,
    });

    const sessionB = await mgr.start({
      projectRoot: "/proj/b",
      aiAdapter: "aider",
      aiPid: process.pid,
    });

    expect(sessionB.project_root).toBe("/proj/b");
    const all = await mgr.load();
    expect(all).toHaveLength(2);
  });

  it("replaces dead-PID session and allows new start", async () => {
    const mgr = new SessionManager(tmpHome);
    const deadPid = 2147483;
    await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "claude-code",
      aiPid: deadPid,
    });

    const fresh = await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "aider",
      aiPid: process.pid,
    });

    expect(fresh.ai_adapter).toBe("aider");
    expect(fresh.ai_pid).toBe(process.pid);
    const sessions = await mgr.load();
    expect(sessions).toHaveLength(1);
  });

  it("session without PID is treated as dead (no conflict)", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "claude-code",
    });

    const second = await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "aider",
      aiPid: process.pid,
    });

    expect(second.ai_adapter).toBe("aider");
  });

  it("acquireApplyLock throws when no session exists", async () => {
    const mgr = new SessionManager(tmpHome);
    await expect(
      mgr.acquireApplyLock("/proj/nonexistent", 1234)
    ).rejects.toThrow(SessionConflictError);
  });

  it("acquireApplyLock succeeds when prior lock PID is dead", async () => {
    const mgr = new SessionManager(tmpHome);
    const deadPid = 2147483;
    await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "claude-code",
    });
    await mgr.acquireApplyLock("/proj/x", deadPid);

    const session = await mgr.acquireApplyLock("/proj/x", process.pid);
    expect(session.apply_lock?.pid).toBe(process.pid);
  });

  it("lock conflict error carries the holding PID", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "claude-code",
    });
    await mgr.acquireApplyLock("/proj/x", process.pid);

    try {
      await mgr.acquireApplyLock("/proj/x", 99999);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(SessionConflictError);
      const conflict = err as SessionConflictError;
      expect(conflict.existingPid).toBe(process.pid);
    }
  });

  it("release lock then re-acquire succeeds", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/proj/x",
      aiAdapter: "claude-code",
    });
    await mgr.acquireApplyLock("/proj/x", process.pid);
    await mgr.releaseApplyLock("/proj/x");

    const session = await mgr.acquireApplyLock("/proj/x", 99999);
    expect(session.apply_lock?.pid).toBe(99999);
  });

  it("SessionConflictError has correct name property", () => {
    const err = new SessionConflictError("test", 42);
    expect(err.name).toBe("SessionConflictError");
    expect(err).toBeInstanceOf(Error);
    expect(err.existingPid).toBe(42);
  });
});
