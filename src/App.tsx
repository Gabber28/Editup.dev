import { useState, useCallback, useEffect, useRef, type JSX } from "react";
import { invoke } from "@tauri-apps/api/core";
import { EditorShell } from "@/components/editor/editor-shell.js";
import { ElementIdentity } from "@/components/editor/element-identity.js";
import { PanelTabs, type PanelKey } from "@/components/editor/panel-tabs.js";
import { LayersPanel, type DomNode } from "@/components/editor/layers-panel.js";
import { CodeBox } from "@/components/editor/code-box.js";
import { ProgressMarker } from "@/components/editor/progress-marker.js";
import { AIInput } from "@/components/editor/ai-input.js";
import { ApplyBar } from "@/components/editor/apply-bar.js";
import { ApprovalToast } from "@/components/toast/approval-toast.js";
import {
  ColorsPanel, SpacingPanel, TypographyPanel,
  BorderPanel, LayoutPanel, EffectsPanel,
} from "@/components/editor/panels/index.js";
import { SetupScreen } from "@/components/setup-screen.js";
import { LicenseGate } from "@/components/license-gate.js";
import { useSession } from "@/hooks/useSession.js";
import { useTargetOrigin } from "@/hooks/useTargetOrigin.js";
import { useAgentConnection, type AgentSnapshot } from "@/hooks/useAgentConnection.js";
import { useApplyFlow } from "@/hooks/useApplyFlow.js";
import { useLicense } from "@/hooks/useLicense.js";
import { useUpdater } from "@/hooks/useUpdater.js";
import { UpdateBanner } from "@/components/update-banner.js";
import { StateSelector } from "@/components/editor/state-selector.js";
import { usePseudoState } from "@/hooks/usePseudoState.js";

type AppMode = "setup" | "editing";
type OverridesByState = Record<string, Record<string, Record<string, string>>>;

function buildElementKey(snap: AgentSnapshot): string {
  const el = snap.element;
  const parts = [el.tag];
  if (el.id) parts.push(`#${el.id}`);
  if (el.classes.length) parts.push(`.${el.classes.join(".")}`);
  if (el.source_file) parts.push(`@${el.source_file}:${el.source_line ?? 0}`);
  return parts.join("");
}

export function App(): JSX.Element {
  const session = useSession();
  const license = useLicense();
  const updater = useUpdater();
  const target = useTargetOrigin();
  const agent = useAgentConnection();
  const flow = useApplyFlow(session?.token ?? "", license.canApply());

  const [mode, setMode] = useState<AppMode>("setup");
  const [active, setActive] = useState<PanelKey>("colors");
  const [allOverrides, setAllOverrides] = useState<OverridesByState>({});
  const [snapshotCache, setSnapshotCache] = useState<Record<string, AgentSnapshot>>({});
  const [inputKey, setInputKey] = useState(0);
  const projectRootRef = useRef("");
  const textRef = useRef("");

  const elementKey = agent.snapshot ? buildElementKey(agent.snapshot) : "";

  useEffect(() => {
    if (agent.snapshot && elementKey) {
      setSnapshotCache((prev) => {
        if (prev[elementKey]) return prev;
        return { ...prev, [elementKey]: agent.snapshot as AgentSnapshot };
      });
    }
  }, [agent.snapshot, elementKey]);

  const baseSnapshot = elementKey ? (snapshotCache[elementKey] ?? agent.snapshot) : agent.snapshot;
  const elementOverrides = elementKey ? (allOverrides[elementKey] ?? {}) : {};
  const pseudo = usePseudoState(agent.snapshot, baseSnapshot, elementOverrides);

  const handleReady = useCallback(async (projectRoot: string) => {
    projectRootRef.current = projectRoot;
    await invoke("set_project_root", { path: projectRoot });
    await agent.startEditing();
    setMode("editing");
  }, [agent]);

  const handleChange = useCallback(
    (prop: string, value: string) => {
      if (!elementKey) return;
      const ps = pseudo.activeState;
      setAllOverrides((prev) => {
        const elMap = prev[elementKey] ?? {};
        return {
          ...prev,
          [elementKey]: {
            ...elMap,
            [ps]: { ...(elMap[ps] ?? {}), [prop]: value },
          },
        };
      });
      if (ps === "default") {
        agent.previewStyle(prop, value);
      } else {
        agent.previewPseudoStyle(prop, value, ps);
      }
    },
    [agent, elementKey, pseudo.activeState],
  );

  const handleApply = useCallback(() => {
    if (!agent.snapshot) return;
    flow.apply(
      snapshotCache,
      allOverrides,
      textRef.current,
      projectRootRef.current
    );
  }, [agent.snapshot, snapshotCache, allOverrides, flow]);

  const handleApplyDone = useCallback(async () => {
    setAllOverrides({});
    setSnapshotCache({});
    textRef.current = "";
    setInputKey((k) => k + 1);
    await agent.resetOverrides();
    await license.refresh();
    flow.reset();
  }, [flow, agent, license]);

  if (!session) {
    return <div className="setup-screen"><div className="setup-card">Loading...</div></div>;
  }

  if (mode === "setup") {
    return (
      <LicenseGate license={license}>
        <UpdateBanner updater={updater} />
        <SetupScreen
          proxyPort={session.proxy_port}
          agentConnected={agent.connected}
          onConnect={target.connect}
          onReady={handleReady}
          error={target.error}
          loading={target.loading}
          targetOrigin={target.origin}
        />
      </LicenseGate>
    );
  }

  const snap = agent.snapshot;
  const firstClass = snap?.element.classes[0];
  const layerNodes: DomNode[] = snap
    ? [{ id: "selected", tag: snap.element.tag, ...(firstClass ? { className: firstClass } : {}), depth: 0 }]
    : [];
  const sourceSnippet = snap?.element.source_file
    ? `<${snap.element.tag} class="${snap.element.classes.join(" ")}">`
    : "";

  const hasChanges = Object.values(allOverrides).some(
    (stateMap) => Object.values(stateMap).some((props) => Object.keys(props).length > 0)
  ) || textRef.current.length > 0;

  return (
    <EditorShell
      banner={<UpdateBanner updater={updater} />}
      layers={
        <LayersPanel
          nodes={layerNodes}
          {...(snap ? { activeId: "selected" } : {})}
          onSelect={(): void => undefined}
        />
      }
      identity={<ElementIdentity element={snap?.element ?? null} />}
      tabs={<PanelTabs active={active} onSelect={setActive} />}
      stateSelector={
        <StateSelector
          availableStates={pseudo.availableStates}
          active={pseudo.activeState}
          onSelect={pseudo.setActiveState}
        />
      }
      panel={renderPanel(active, pseudo.mergedValues, handleChange)}
      codeBox={
        <CodeBox
          source={sourceSnippet}
          file={snap?.element.source_file ?? ""}
          line={snap?.element.source_line ?? 0}
        />
      }
      progress={
        <ProgressMarker
          items={Object.entries(allOverrides)
            .filter(([, stateMap]) =>
              Object.values(stateMap).some((props) => Object.keys(props).length > 0)
            )
            .map(([key]) => {
              const cached = snapshotCache[key];
              const tag = cached?.element.tag;
              return {
                label: tag ?? key.split(/[#.@]/)[0] ?? "element",
                done: key === elementKey,
              };
            })}
        />
      }
      aiInput={
        <AIInput
          key={inputKey}
          onSubmit={(v): void => { textRef.current = v; }}
          onChange={(v): void => { textRef.current = v; }}
        />
      }
      applyBar={
        <ApplyBar
          phase={flow.phase}
          hasChanges={hasChanges}
          commitHash={flow.commitHash}
          error={flow.error}
          expressMode={flow.expressMode}
          canApply={license.canApply()}
          canUseExpress={license.canUseExpress()}
          editsUsed={license.rateLimit?.edits_used}
          editsLimit={license.rateLimit?.edits_limit}
          onApply={handleApply}
          onRevert={flow.revert}
          onToggleExpress={flow.toggleExpress}
          onReset={handleApplyDone}
        />
      }
      toast={
        flow.approval && flow.plan ? (
          <ApprovalToast
            plan={flow.plan}
            onApprove={flow.approve}
            onReject={flow.reject}
          />
        ) : undefined
      }
    />
  );
}

function renderPanel(
  key: PanelKey,
  values: Record<string, string>,
  onChange: (prop: string, value: string) => void,
): JSX.Element {
  switch (key) {
    case "colors":
      return <ColorsPanel values={values} onChange={onChange} />;
    case "spacing":
      return <SpacingPanel values={values} onChange={onChange} />;
    case "typography":
      return <TypographyPanel values={values} onChange={onChange} />;
    case "borders":
      return <BorderPanel values={values} onChange={onChange} />;
    case "layout":
      return <LayoutPanel values={values} onChange={onChange} />;
    case "effects":
      return <EffectsPanel values={values} onChange={onChange} />;
  }
}
