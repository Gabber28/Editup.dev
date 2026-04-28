import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SessionConflictError } from "../errors.js";
import { logger } from "../logger.js";

export interface Session {
  project_root: string;
  ai_adapter: string;
  ai_pid?: number | undefined;
  session_token: string;
  started_at: string;
  apply_lock?: { acquired_at: string; pid: number } | undefined;
}

export class SessionManager {
  private readonly sessionsPath: string;

  constructor(home: string = homedir()) {
    this.sessionsPath = join(home, ".editup", "sessions.json");
  }

  async load(): Promise<Session[]> {
    try {
      const raw = await fs.readFile(this.sessionsPath, "utf8");
      const parsed = JSON.parse(raw) as { sessions?: Session[] };
      return parsed.sessions ?? [];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  async save(sessions: Session[]): Promise<void> {
    const dir = join(this.sessionsPath, "..");
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      this.sessionsPath,
      JSON.stringify({ sessions }, null, 2),
      { mode: 0o600 }
    );
  }

  async start(input: {
    projectRoot: string;
    aiAdapter: string;
    aiPid?: number;
  }): Promise<Session> {
    const sessions = await this.load();
    const existing = sessions.find(
      (s) => s.project_root === input.projectRoot
    );
    if (existing && (await this.isProcessAlive(existing.ai_pid))) {
      throw new SessionConflictError(
        `Active session already exists for project: ${input.projectRoot}`,
        existing.ai_pid
      );
    }

    const filtered = sessions.filter(
      (s) => s.project_root !== input.projectRoot
    );

    const session: Session = {
      project_root: input.projectRoot,
      ai_adapter: input.aiAdapter,
      ai_pid: input.aiPid,
      session_token: randomUUID(),
      started_at: new Date().toISOString(),
    };

    filtered.push(session);
    await this.save(filtered);
    logger.info("session started", {
      adapter: input.aiAdapter,
      project: input.projectRoot,
    });
    return session;
  }

  async end(projectRoot: string): Promise<void> {
    const sessions = await this.load();
    const filtered = sessions.filter((s) => s.project_root !== projectRoot);
    await this.save(filtered);
    logger.info("session ended", { project: projectRoot });
  }

  async acquireApplyLock(
    projectRoot: string,
    pid: number
  ): Promise<Session> {
    const sessions = await this.load();
    const idx = sessions.findIndex((s) => s.project_root === projectRoot);
    if (idx === -1) {
      throw new SessionConflictError(
        `No active session for project: ${projectRoot}`
      );
    }
    const session = sessions[idx];
    if (!session) {
      throw new SessionConflictError(
        `Session vanished during lock acquisition: ${projectRoot}`
      );
    }
    if (session.apply_lock && (await this.isProcessAlive(session.apply_lock.pid))) {
      throw new SessionConflictError(
        `Apply lock already held by pid ${session.apply_lock.pid}`,
        session.apply_lock.pid
      );
    }
    session.apply_lock = {
      acquired_at: new Date().toISOString(),
      pid,
    };
    sessions[idx] = session;
    await this.save(sessions);
    return session;
  }

  async releaseApplyLock(projectRoot: string): Promise<void> {
    const sessions = await this.load();
    const idx = sessions.findIndex((s) => s.project_root === projectRoot);
    if (idx === -1) return;
    const session = sessions[idx];
    if (!session) return;
    delete session.apply_lock;
    sessions[idx] = session;
    await this.save(sessions);
  }

  private async isProcessAlive(pid?: number): Promise<boolean> {
    if (!pid) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      return code === "EPERM";
    }
  }
}
