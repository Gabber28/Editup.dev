import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../../src/lib/ai-adapters/session-manager.js";
import { SessionConflictError } from "../../src/lib/errors.js";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

let tmpHome: string;

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "editup-test-"));
});

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true });
});

describe("SessionManager", () => {
  it("starts a fresh session and persists it", async () => {
    const mgr = new SessionManager(tmpHome);
    const session = await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "claude-code",
      aiPid: 99999, // unlikely to be alive
    });
    expect(session.session_token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    const sessions = await mgr.load();
    expect(sessions).toHaveLength(1);
  });

  it("ends a session", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "claude-code",
    });
    await mgr.end("/project/a");
    expect(await mgr.load()).toHaveLength(0);
  });

  it("replaces stale session when previous PID is dead", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "claude-code",
      aiPid: 99999,
    });
    await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "aider",
      aiPid: 99998,
    });
    const sessions = await mgr.load();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.ai_adapter).toBe("aider");
  });

  it("rejects when active session exists with live PID", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "claude-code",
      aiPid: process.pid,
    });
    await expect(
      mgr.start({
        projectRoot: "/project/a",
        aiAdapter: "aider",
      })
    ).rejects.toThrow(SessionConflictError);
  });

  it("acquires and releases apply lock", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "claude-code",
    });
    const session = await mgr.acquireApplyLock("/project/a", 99999);
    expect(session.apply_lock).toBeDefined();
    await mgr.releaseApplyLock("/project/a");
    const sessions = await mgr.load();
    expect(sessions[0]!.apply_lock).toBeUndefined();
  });

  it("rejects acquire when lock held by live process", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "claude-code",
    });
    await mgr.acquireApplyLock("/project/a", process.pid);
    await expect(
      mgr.acquireApplyLock("/project/a", process.pid + 1)
    ).rejects.toThrow(SessionConflictError);
  });

  it("writes sessions file with restrictive permissions", async () => {
    const mgr = new SessionManager(tmpHome);
    await mgr.start({
      projectRoot: "/project/a",
      aiAdapter: "claude-code",
    });
    const path = join(tmpHome, ".editup", "sessions.json");
    const stat = await fs.stat(path);
    if (process.platform !== "win32") {
      expect(stat.mode & 0o077).toBe(0);
    } else {
      expect(stat.isFile()).toBe(true);
    }
  });
});
