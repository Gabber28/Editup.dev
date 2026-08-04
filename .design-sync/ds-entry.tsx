// design-sync bundle entry — re-exports the editor UI components synced to
// claude.ai/design. Not part of the app build. HistoryPanel is excluded
// (imports @tauri-apps/api at runtime, which breaks browser previews).
export { EditorShell } from "../src/components/editor/editor-shell.js";
export { ElementIdentity } from "../src/components/editor/element-identity.js";
export { LayersPanel } from "../src/components/editor/layers-panel.js";
export { PanelTabs } from "../src/components/editor/panel-tabs.js";
export { CodeBox } from "../src/components/editor/code-box.js";
export { ProgressMarker } from "../src/components/editor/progress-marker.js";
export { AIInput } from "../src/components/editor/ai-input.js";
export { StateSelector } from "../src/components/editor/state-selector.js";
export { ApplyBar } from "../src/components/editor/apply-bar.js";
export { ColorsPanel } from "../src/components/editor/panels/colors-panel.js";
export { SpacingPanel } from "../src/components/editor/panels/spacing-panel.js";
export { TypographyPanel } from "../src/components/editor/panels/typography-panel.js";
export { BorderPanel } from "../src/components/editor/panels/border-panel.js";
export { LayoutPanel } from "../src/components/editor/panels/layout-panel.js";
export { EffectsPanel } from "../src/components/editor/panels/effects-panel.js";
export { PropRow, SelectRow, SectionLabel } from "../src/components/editor/panels/prop-row.js";
export { ApprovalToast } from "../src/components/toast/approval-toast.js";
export { LicenseGate } from "../src/components/license-gate.js";
export { UpdateBanner } from "../src/components/update-banner.js";
export { SetupScreen } from "../src/components/setup-screen.js";
