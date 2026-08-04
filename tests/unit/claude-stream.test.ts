import { describe, it, expect } from "vitest";
import { parseClaudeOutput } from "@/lib/ai-adapters/claude-stream.js";
import { toProjectRelative, normalizePath } from "@/lib/ai-adapters/project-paths.js";

function line(obj: unknown): string {
  return JSON.stringify(obj);
}

const toolUse = (id: string, name: string, file: string): string =>
  line({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input: { file_path: file } }] } });

const toolResult = (id: string, isError = false): string =>
  line({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, is_error: isError }] } });

const resultLine = (extra: Record<string, unknown> = {}): string =>
  line({ type: "result", subtype: "success", is_error: false, result: "done", usage: { input_tokens: 7, output_tokens: 3 }, ...extra });

describe("parseClaudeOutput — proof of what the run did", () => {
  it("collects the files whose edit tool succeeded", () => {
    const out = parseClaudeOutput(
      [toolUse("a", "Edit", "/p/index.html"), toolResult("a"), resultLine()].join("\n"),
    );
    expect(out.filesEdited).toEqual(["/p/index.html"]);
    expect(out.isError).toBe(false);
    expect(out.usage).toEqual({ input_total: 7, output_total: 3 });
  });

  it("ignores an edit whose tool_result came back as an error", () => {
    const out = parseClaudeOutput(
      [toolUse("a", "Edit", "/p/index.html"), toolResult("a", true), resultLine()].join("\n"),
    );
    expect(out.filesEdited).toEqual([]);
  });

  it("counts Write and MultiEdit, but not read-only tools", () => {
    const out = parseClaudeOutput(
      [
        toolUse("a", "Write", "/p/new.css"),
        toolResult("a"),
        toolUse("b", "MultiEdit", "/p/index.html"),
        toolResult("b"),
        toolUse("c", "Read", "/p/other.html"),
        toolResult("c"),
        resultLine(),
      ].join("\n"),
    );
    expect(out.filesEdited.sort()).toEqual(["/p/index.html", "/p/new.css"]);
  });

  it("reports a run with no edit tool at all as having edited nothing", () => {
    const out = parseClaudeOutput([resultLine()].join("\n"));
    expect(out.filesEdited).toEqual([]);
    expect(out.text).toBe("done");
  });

  it("surfaces the CLI's own error flags", () => {
    const out = parseClaudeOutput(
      resultLine({ is_error: true, subtype: "error_max_turns" }),
    );
    expect(out.isError).toBe(true);
    expect(out.subtype).toBe("error_max_turns");
  });

  it("surfaces permission denials, which leave exit code 0", () => {
    const out = parseClaudeOutput(
      resultLine({ permission_denials: [{ tool_name: "Edit" }] }),
    );
    expect(out.permissionDenials).toEqual(["Edit"]);
  });

  it("still reads a single pretty-printed JSON object (plan step format)", () => {
    const pretty = JSON.stringify(
      { result: '{"summary":"x"}', usage: { input_tokens: 5, output_tokens: 2 } },
      null,
      2,
    );
    const out = parseClaudeOutput(pretty);
    expect(out.text).toBe('{"summary":"x"}');
    expect(out.usage.input_total).toBe(5);
  });

  it("falls back to raw text when the output is not JSON", () => {
    const out = parseClaudeOutput("total garbage");
    expect(out.text).toBe("total garbage");
    expect(out.filesEdited).toEqual([]);
  });
});

describe("toProjectRelative", () => {
  it("strips the project root from an absolute path", () => {
    expect(toProjectRelative("/home/user/project/src/a.tsx", "/home/user/project")).toBe("src/a.tsx");
  });

  it("handles Windows separators and case differences", () => {
    expect(
      toProjectRelative("C:\\Users\\me\\proj\\index.html", "c:/users/me/proj"),
    ).toBe("index.html");
  });

  it("leaves a path outside the root untouched", () => {
    expect(toProjectRelative("/elsewhere/x.css", "/home/user/project")).toBe("/elsewhere/x.css");
  });

  it("normalizes separators and a leading ./", () => {
    expect(normalizePath(".\\src\\a.ts")).toBe("src/a.ts");
  });
});
