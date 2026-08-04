# EditUp Editor UI — conventions

These components are the UI of EditUp.dev, a dark-theme visual CSS editor (Tauri + React 19). They are presentational and controlled: every component takes data + callbacks via props — there is **no provider, no context, no global store**. Pass realistic props and they render.

## Dark shell is mandatory

The whole system assumes the app's dark background. `styles.css` sets it on `body` via tokens; if you compose inside a lighter container, re-establish the surface yourself:

```jsx
<div style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}>…</div>
```

Foreground text is near-white (`--color-fg: #f5f5f5`) — on a light background it becomes unreadable.

## Styling idiom: CSS custom properties, not utility classes

There is no Tailwind. Style your own layout glue with inline styles (or small style blocks) that reference the design tokens — never hardcode hex values:

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#09090b` | app background |
| `--color-card` | `#18181b` | elevated surfaces |
| `--color-border` | `#27272a` | 1px borders |
| `--color-fg` | `#f5f5f5` | primary text |
| `--color-muted` | `#a1a1aa` | secondary text, labels |
| `--color-accent` | `#7c3aed` | primary purple |
| `--color-accent-light` | `#a855f7` | active states, highlights |
| `--color-accent-blue` | `#3b82f6` | secondary accent |
| `--font-sans` / `--font-mono` | system stacks | UI text / code & selectors |

Component classes (`.editor-shell`, `.panel-tabs__tab--active`, `.toast`, `.apply-bar`, `.setup-card`, `.state-selector__pill`, `.code-box`, `.progress-marker__dot--done`, `.ai-input__field`, `.update-banner`) ship in `styles.css` and are applied by the components themselves — read them for reference, don't invent new BEM names in that vocabulary. Base font-size is 13px; labels are often 9–11px uppercase with letter-spacing.

## Composition model

`EditorShell` is the layout root: it takes named **slots** (`layers`, `identity`, `tabs`, `stateSelector`, `panel`, `codeBox`, `progress`, `aiInput`, `applyBar`, optional `banner`/`toast`) and adapts wide/medium/narrow to container width. Give it an explicit height.

Gotchas learned building the previews:
- `ApprovalToast` uses `position: fixed` (bottom of viewport). To scope it inside a card/section, wrap it in a container with `transform: translateZ(0)`.
- `CodeBox` returns `null` without a `source` prop; `StateSelector` returns `null` with fewer than 2 `availableStates`; `UpdateBanner` returns `null` unless `updater.update.available && !dismissed`.
- Panel components (`ColorsPanel`, `SpacingPanel`, `TypographyPanel`, `BorderPanel`, `LayoutPanel`, `EffectsPanel`) all take `values: Record<string, string>` keyed by CSS property name (e.g. `"background-color"`, `"margin-top"`) + `onChange(property, value)`. They're designed for ~280px-wide sidebars.

## Idiomatic example

```jsx
import { EditorShell, LayersPanel, ElementIdentity, PanelTabs, ColorsPanel,
         CodeBox, ProgressMarker, AIInput, ApplyBar } from "editup";

<div style={{ height: 520, background: "var(--color-bg)", color: "var(--color-fg)" }}>
  <EditorShell
    layers={<LayersPanel nodes={[{ id: "cta", tag: "button", className: "btn-primary", depth: 2, edited: true }]} activeId="cta" onSelect={select} />}
    identity={<ElementIdentity element={{ tag: "button", classes: ["btn-primary"], source_file: "src/hero.tsx", source_line: 27 }} />}
    tabs={<PanelTabs active="colors" onSelect={setTab} />}
    panel={<ColorsPanel values={{ "background-color": "#7c3aed" }} onChange={edit} />}
    codeBox={<CodeBox file="src/hero.tsx" line={27} source={'<button className="btn-primary">Go</button>'} />}
    progress={<ProgressMarker items={[{ label: "hero", done: true }]} />}
    aiInput={<AIInput onSubmit={ask} />}
    applyBar={<ApplyBar phase="idle" hasChanges commitHash={null} error={null} expressMode={false} canApply canUseExpress onApply={apply} onRevert={revert} onToggleExpress={toggle} onReset={reset} />}
  />
</div>
```

## Where the truth lives

Read `styles.css` (project root) before styling — it is the complete stylesheet. Each component ships `components/<group>/<Name>/<Name>.d.ts` (exact props) and `<Name>.prompt.md` (usage).
