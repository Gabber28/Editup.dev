import type { Page } from "@playwright/test";

const EDIT_PLAN_JSON = JSON.stringify({
  summary: "Update button background color",
  files: [{
    path: "src/components/Button.tsx",
    lines_affected: [12, 13],
    reason: "Change background color",
    change_type: "target",
    change_source: "visual",
  }],
  visual_changes_applied: true,
  text_instructions_applied: false,
  side_effects: [],
  confidence: "high",
  recommended_action: "apply",
});

const MOCK_INIT_SCRIPT = `
(() => {
  const state = {
    agentConnected: false,
    eventListeners: {},
    invokeCalls: [],
    editsUsed: 0,
    previewValues: {},
  };
  window.__MOCK_STATE__ = state;

  let cbId = 0;

  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main" },
    },
    transformCallback(callback, once) {
      const id = cbId++;
      const name = "_" + id;
      Object.defineProperty(window, name, {
        value(result) {
          if (once) delete window[name];
          return callback(result);
        },
        writable: false,
        configurable: true,
      });
      return id;
    },
    convertFileSrc(src) { return src; },
    async invoke(cmd, args) {
      state.invokeCalls.push({ cmd, args, ts: Date.now() });

      if (cmd === "plugin:event|listen") {
        const ev = args.event;
        if (!state.eventListeners[ev]) state.eventListeners[ev] = [];
        state.eventListeners[ev].push(args.handler);
        return args.handler;
      }
      if (cmd === "plugin:event|unlisten") return;

      const plan = ${JSON.stringify(EDIT_PLAN_JSON)};
      const spawnOut = JSON.stringify({
        result: plan,
        usage: { input_tokens: 500, output_tokens: 200 },
      });

      const routes = {
        get_session_token: () => ({
          token: "e2e-test-token",
          proxy_port: 9200,
          ws_port: 9201,
        }),
        get_license_status: () => ({
          valid: true, plan: "pro",
          grace_remaining_days: null,
          last_verified: "2026-05-07T00:00:00Z",
        }),
        get_rate_limit_state: () => ({
          plan: "pro", edits_used: state.editsUsed,
          edits_limit: 30,
          resets_at: "2026-05-07T01:00:00Z",
          blocked: false,
        }),
        check_license: () => ({
          valid: true, plan: "pro",
          grace_remaining_days: null,
          last_verified: "2026-05-07T00:00:00Z",
        }),
        save_license_key: () => ({
          valid: true, plan: "pro",
          grace_remaining_days: null,
          last_verified: "2026-05-07T00:00:00Z",
        }),
        set_target_origin: () => null,
        get_target_origin: () => null,
        get_agent_status: () => state.agentConnected,
        set_project_root: () => null,
        get_project_root: () => null,
        start_editing: () => null,
        stop_editing: () => null,
        preview_style: (a) => {
          if (a && a.property) state.previewValues[a.property] = a.value;
          return null;
        },
        reset_overrides: () => {
          for (const k in state.previewValues) delete state.previewValues[k];
          return null;
        },
        request_snapshot: () => {
          setTimeout(() => {
            const snap = {
              element: {
                tag: "button", classes: ["btn", "btn-primary"],
                component_name: "Button",
                source_file: "src/components/Button.tsx",
                source_line: 12,
              },
              styling: {
                framework: "tailwind",
                class_to_rule_map: {},
                active_css_variables: {},
              },
              computed_style: Object.assign({
                "background-color": "rgb(124, 58, 237)",
                color: "rgb(255, 255, 255)",
                "font-size": "16px",
                "margin-top": "0px",
                "padding-top": "8px",
                "border-top-width": "0px",
                display: "inline-flex",
                opacity: "1",
                "font-weight": "600",
              }, state.previewValues),
            };
            window.__TAURI_TEST_EMIT__("agent_snapshot", snap);
          }, 50);
          return null;
        },
        detect_cli: () => true,
        spawn_cli: () => ({
          exit_code: 0, stdout: spawnOut,
          stderr: "", duration_ms: 100,
        }),
        git_auto_commit: () => ({ hash: "abc1234def" }),
        git_revert: () => "abc1234def",
        git_status: () => ({ modified: [], untracked: [] }),
        git_log: () => [],
        increment_edit_count: () => {
          state.editsUsed++;
          return {
            plan: "pro", edits_used: state.editsUsed,
            edits_limit: 30,
            resets_at: "2026-05-07T01:00:00Z",
            blocked: false,
          };
        },
        write_history_entry: () => null,
        read_history: () => [],
        check_for_update: () => ({
          available: false, version: "",
          body: null, current_version: "0.1.0",
        }),
        install_update: () => null,
        get_current_version: () => "0.1.0",
      };

      if (routes[cmd]) return routes[cmd](args);
      return null;
    },
  };

  window.__TAURI_TEST_EMIT__ = (eventName, payload) => {
    const handlers = state.eventListeners[eventName] || [];
    for (const id of handlers) {
      const fn = window["_" + id];
      if (fn) fn({ event: eventName, id: 0, payload });
    }
  };
})();
`;

export async function injectTauriMock(page: Page): Promise<void> {
  await page.addInitScript(MOCK_INIT_SCRIPT);
}

export async function setAgentConnected(page: Page, v: boolean): Promise<void> {
  await page.evaluate((val) => {
    (window as Record<string, unknown>).__MOCK_STATE__
      && ((window as Record<string, unknown>).__MOCK_STATE__ as Record<string, unknown>).agentConnected !== undefined
      && (((window as Record<string, unknown>).__MOCK_STATE__ as Record<string, boolean>).agentConnected = val);
  }, v);
}

export async function emitSnapshot(
  page: Page,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await page.evaluate((ov) => {
    const snap = {
      element: {
        tag: "button",
        classes: ["btn", "btn-primary"],
        component_name: "Button",
        source_file: "src/components/Button.tsx",
        source_line: 12,
      },
      styling: {
        framework: "tailwind",
        class_to_rule_map: {},
        active_css_variables: {},
      },
      computed_style: {
        "background-color": "rgb(124, 58, 237)",
        color: "rgb(255, 255, 255)",
        "font-size": "16px",
        "margin-top": "0px",
        "padding-top": "8px",
        "border-top-width": "0px",
        display: "inline-flex",
        opacity: "1",
        "font-weight": "600",
        ...ov,
      },
    };
    const emit = (window as Record<string, unknown>).__TAURI_TEST_EMIT__ as
      (ev: string, p: unknown) => void;
    if (emit) emit("agent_snapshot", snap);
  }, overrides);
}

export async function getInvokeCalls(
  page: Page,
  cmd?: string,
): Promise<Array<{ cmd: string; args: unknown }>> {
  return page.evaluate((c) => {
    const st = (window as Record<string, unknown>).__MOCK_STATE__ as
      { invokeCalls: Array<{ cmd: string; args: unknown }> };
    if (!st) return [];
    return c ? st.invokeCalls.filter((x) => x.cmd === c) : st.invokeCalls;
  }, cmd);
}
