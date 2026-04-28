type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: string | number | boolean | undefined;
}

const FORBIDDEN_KEYS = new Set([
  "prompt",
  "snapshot",
  "code",
  "source",
  "file_content",
  "css_value",
  "rule_text",
  "api_key",
  "token",
  "license",
]);

function sanitizeContext(ctx: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && value.length > 200) {
      out[key] = `${value.slice(0, 200)}...`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx ? sanitizeContext(ctx) : {}),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (typeof process !== "undefined" && process.stderr) {
    process.stderr.write(`${line}\n`);
  } else {
    console.warn(line);
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext): void => {
    if (process.env["EDITUP_DEBUG"] === "1") {
      emit("debug", msg, ctx);
    }
  },
  info: (msg: string, ctx?: LogContext): void => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext): void => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext): void => emit("error", msg, ctx),
};
