# CLAUDE.md — EditUp.dev

## Projeto

> **Nota:** o projeto foi originalmente chamado de **Opal** e passou a se chamar **EditUp.dev**. Qualquer referência antiga a "Opal" deve ser tratada como "EditUp.dev".

EditUp.dev é um editor visual no-code para frontend web. Funciona via proxy local, captura estilos CSS de qualquer elemento no browser do usuário via `getComputedStyle()` + CSS rules + source maps, permite edição visual com preview ao vivo, e invoca qualquer AI tool (Claude Code, Cursor, Aider, Cline, ou via MCP) em dois passos — plan (dry-run read-only) e execute (com aprovação) — para aplicar as mudanças no código fonte. Suporta também instruções textuais do dev combinadas com edições visuais. Style-agnostic: funciona com Tailwind, CSS puro, Modules, styled-components, design tokens.

Documento de planejamento: `editup-planning-v3.2 (1).md` (na raiz do projeto, apenas referência — não incluir no build).

## Stack

- **Runtime:** Tauri v2 (Rust backend + webview frontend)
- **Frontend do app:** React 19 + TypeScript
- **Proxy:** Rust nativo (hyper + tower-http)
- **Script injetado no browser:** TypeScript vanilla, bundlado com esbuild
- **Source maps:** `@jridgewell/trace-mapping`
- **AI interface:** Adapter Registry — MCP Server (universal) + CLI Adapters (Claude Code, Aider) + Anthropic SDK + Copy Prompt
- **EditPlan validation:** Zod
- **Testes:** Vitest (unit) + Playwright (e2e)
- **Linting:** ESLint + Prettier
- **Package manager:** pnpm

## Estrutura do projeto

```
editup.dev/
├── src-tauri/              # Backend Rust do Tauri (inclui proxy nativo)
│   ├── src/
│   └── Cargo.toml
├── src/                    # Frontend React do app Tauri
│   ├── components/
│   │   └── editor/         # Editor visual (layout adaptativo)
│   │       ├── editor-shell.tsx      # Container principal, detecta width (wide/medium/narrow)
│   │       ├── element-identity.tsx  # Barra de identidade + breadcrumb + mini-preview
│   │       ├── layers-panel.tsx      # Árvore DOM, seleção, marcadores de editado
│   │       ├── panel-tabs.tsx        # Tabs dos painéis (ícone+texto ou ícone only)
│   │       ├── panels/
│   │       │   ├── color-panel.tsx
│   │       │   ├── spacing-panel.tsx
│   │       │   ├── typography-panel.tsx
│   │       │   ├── border-panel.tsx
│   │       │   ├── layout-panel.tsx
│   │       │   └── effects-panel.tsx
│   │       ├── code-box.tsx          # Snippet do source (read-only, syntax highlight)
│   │       ├── progress-marker.tsx   # Dots horizontais de elementos editados na seção
│   │       └── ai-input.tsx          # Input de texto para instruções AI
│   ├── hooks/
│   ├── lib/
│   │   └── ai-adapters/    # Adapter Registry para múltiplas AI tools
│   │       ├── types.ts              # Interface AIAdapter
│   │       ├── registry.ts           # Detecção, seleção, registro
│   │       ├── claude-code.ts        # ClaudeCodeAdapter (spawn)
│   │       ├── aider.ts              # AiderAdapter (spawn)
│   │       ├── anthropic-sdk.ts      # AnthropicSDKAdapter (API direta)
│   │       ├── copy-prompt.ts        # CopyPromptAdapter (clipboard)
│   │       ├── mcp-server.ts         # MCP server (127.0.0.1 only)
│   │       └── session-manager.ts    # Registro de sessão, PID tracking
│   ├── types/
│   └── App.tsx
├── injected/               # Script injetado no browser do usuário
│   ├── agent.ts            # Captura DOM, getComputedStyle, CSS rules, source maps, WebSocket
│   └── overlay.ts          # Floating brackets nos cantos (sem overlay de fundo)
├── ai-bridge/              # Orquestração plan → approve → execute
│   ├── orchestrator.ts     # Plan → Toast → Execute (dois passos)
│   ├── plan.ts             # Step 1: dry-run read-only
│   ├── execute.ts          # Step 2: edição com aprovação
│   ├── edit-plan.ts        # Schema Zod do EditPlan
│   ├── enriched-snapshot.ts # Snapshot enriquecido com CSS rules + source mapping
│   └── prompt.ts           # Gerador de prompts (visual + text instructions)
├── verification/           # Verificação pós-aplicação (3 camadas + correction pass)
│   ├── visual.ts           # Camada 1: getComputedStyle check
│   ├── scope.ts            # Camada 2: scope leak detection
│   ├── diff-audit.ts       # Camada 3: git diff vs plan
│   └── correction.ts       # Correction pass automático (max 2 tentativas)
├── tests/
│   ├── unit/
│   ├── e2e/
│   └── security/
├── landing/                # Landing page (Next.js)
├── CLAUDE.md
├── editup-planning-v3.2 (1).md
└── package.json
```

## Comandos

```bash
pnpm dev              # Inicia o app Tauri em dev mode
pnpm build            # Build de produção
pnpm test             # Roda todos os testes (unit + e2e + security)
pnpm test:unit        # Apenas testes unitários
pnpm test:e2e         # Apenas testes e2e
pnpm test:security    # Apenas testes de segurança
pnpm lint             # ESLint + Prettier check
pnpm lint:fix         # ESLint + Prettier fix
pnpm inject:build     # Builda o script injetado (esbuild)
pnpm landing:dev      # Dev server da landing page
pnpm landing:build    # Build da landing page
```

## Convenções de código

- TypeScript strict mode em todo o projeto
- Imports absolutos com alias `@/` apontando para `src/`
- Componentes React: functional components com hooks, nunca class components
- Nomes de arquivos: kebab-case para arquivos, PascalCase para componentes React
- Tipos: definir em `src/types/`, exportar via barrel file `index.ts`
- Nenhum `any` — use `unknown` e faça type narrowing
- Nenhum `console.log` em código de produção — use o logger do projeto
- Comentários apenas quando o PORQUÊ não é óbvio pelo código
- Cada função pública deve ter JSDoc com `@param` e `@returns`
- Erros devem ser typed (criar classes de erro em `src/lib/errors.ts`)
- Máximo 200 linhas por arquivo — se exceder, extrair módulo

## Segurança de dados — regras invioláveis

Estas regras NUNCA podem ser quebradas em nenhum commit:

1. **Nenhum código do usuário transita pela rede.** O proxy, o agente injetado, o parsing de source maps, e a geração de prompts rodam 100% localmente. A única comunicação externa é a verificação de licença (HTTPS, apenas a license key).

2. **Todos os servers apenas em 127.0.0.1.** WebSocket do proxy, MCP server, e qualquer outro server devem fazer bind explícito em `127.0.0.1`, nunca em `0.0.0.0`. Token de sessão UUID v4 gerado no init, obrigatório para conectar. Validação de Host e Origin no WS.

3. **Nenhum dado de código em telemetria.** Se analytics forem implementados, devem ser: opt-in, apenas métricas agregadas (contagem de edições, painéis usados), sem nomes de arquivos, sem conteúdo de código, sem valores CSS, sem conteúdo de prompts.

4. **License key criptografada no disco.** Armazenar em `~/.editup/license` criptografada com chave derivada do hardware ID (machine-id). Nunca em plaintext.

5. **Prompt fica local.** O prompt gerado pelo EditUp.dev é executado via `spawn()` com `shell: false` e args array. Nunca `exec()` com template string. Nunca enviar prompts para um servidor intermediário.

6. **Nenhum endpoint externo além do Lemon Squeezy.** O EditUp.dev não deve fazer requests para nenhum servidor exceto a API do Lemon Squeezy para verificação de licença.

7. **Nunca `--dangerously-skip-permissions`.** Em nenhum momento, em nenhum contexto. Tools são positivamente listados via `--allowedTools`. Plan step não inclui `Edit`. Execute step inclui `Edit` mas não `Write`, `Bash`, ou `WebFetch`.

8. **Sanitização XML + CDATA** dos dados do DOM antes de incluir no prompt. Defesa em profundidade.

## Seleção de elementos — Floating Brackets

O EditUp.dev NÃO usa overlay com background semi-transparente sobre o elemento selecionado (isso bloqueia a visualização de bordas, sombras e efeitos visuais).

Em vez disso, usa **floating brackets** — 4 marcadores em L nos cantos do `getBoundingClientRect()`:
- **Hover (antes do clique):** outline 1px dashed + brackets leves (8px cada braço)
- **Selecionado:** brackets sólidos 2px com pulse sutil + tag flutuante acima (`button.btn-primary` ou nome do componente via source map)
- **Zero cobertura da superfície do elemento** — bordas, sombras e efeitos ficam 100% visíveis

Na janela do EditUp:
- **Barra de identidade:** tag + classe principal + arquivo:linha + mini-preview do elemento
- **Breadcrumb DOM:** `body > main > section > div > button` (clicável — troca seleção ao clicar em ancestral)

## Layout do editor — 3 modos adaptativos

O editor se adapta à largura da janela com 3 modos:

### Wide (>900px) — tela cheia ou metade grande

Layers panel à esquerda (200px) | Tabs de painéis + code box à direita | Progress marker | AI input na parte inferior.

### Medium (500-900px) — metade da tela

Layers vira dropdown no topo. Code box colapsa para 1 linha. Tabs de painéis em linha horizontal.

### Narrow (<500px) — quarter snap ou sidebar strip

Identity compacta (1 linha). Tabs com ícones only. Code box escondido (toggle). AI input sempre visível no bottom.

Todos os limites de painel são arrastáveis. Preferências são persistidas por size-class. Tauri window config: `min_width: 280`, `min_height: 400`.

### Componentes do editor

- **Element identity:** tag, classe, source file:line, mini-preview (cloneNode + computed styles)
- **Layers panel:** árvore DOM hierárquica, marcadores visuais nos elementos já editados
- **Panel tabs:** 6 painéis — Cores, Espaçamento, Tipografia, Bordas, Layout, Efeitos
- **Code box:** snippet read-only do source do elemento (syntax highlighted, colapsável)
- **Progress marker:** dots horizontais mostrando quais elementos da seção já foram editados
- **AI input:** caixa de texto para instruções em linguagem natural (sempre visível)

## Fluxo de edição (plan → approve → execute)

### Passo 1 — Edição visual + instruções de texto

Dev edita propriedades CSS visualmente (preview instantâneo via `element.style`). Opcionalmente escreve instruções de texto na caixa AI ("adicione hover glow e aumente font no mobile"). Clica "Apply" quando pronto.

### Passo 2 — Plan (dry-run)

AI recebe enriched snapshot + text instructions + acesso READ-ONLY ao projeto. Instrução: retornar um `EditPlan` em JSON sem editar nenhum arquivo.

O prompt separa claramente: `<visual_changes>` (valores CSS exatos, prioridade) + `<text_instructions>` (texto livre, interpretado pela AI). Visual tem prioridade sobre texto em caso de conflito.

### Passo 3 — Toast de aprovação

Toast mostra arquivos afetados, distinguindo mudanças visuais vs instruções de texto. Três comportamentos:
- **`confidence: 'high'`, sem side effects**: toast compacto, Enter para aplicar
- **Side effects presentes**: toast destaca o side effect com aviso
- **`confidence: 'low'`**: toast expande automaticamente com alternativas

Modo express (opt-in por sessão): desliga toast para `confidence: 'high'` sem side effects.

### Passo 4 — Execute

Após aprovação, AI recebe o EditPlan aprovado + permissão de Edit. Edita os arquivos.

### Passo 5 — Verificação + correction pass + auto-commit

3 camadas de verificação após hot reload:
1. **Visual**: `getComputedStyle(target)` vs `expected_final_state` (tolerância: >5px dimensões, >15 RGB por canal). Aplica-se a mudanças visuais (valores exatos conhecidos).
2. **Scope**: elementos com mesmo seletor/classe/componente mudaram sem estar em `side_effects`?
3. **Git diff**: arquivos modificados = arquivos previstos no plan?

**Verificação diferenciada:**
- Mudanças visuais: tolerância estrita (valor esperado é conhecido)
- Instruções de texto: verificação leve (algo mudou na direção certa, sem valor exato esperado)

**Correction pass:** se verificação visual falhar, envia prompt de correção automático com as divergências específicas. Máximo 2 tentativas. Após 2 falhas, mostra resultado ao dev com opção de revert.

Se tudo OK: auto-commit silencioso `editup: <summary>`. Revert é 1 clique.

## EnrichedSnapshot — captura completa do elemento

```typescript
type EnrichedSnapshot = {
  element: {
    tag: string;
    id?: string;
    classes: string[];
    component_name?: string;
    source_file?: string;
    source_line?: number;
  };
  styling: {
    framework: 'tailwind' | 'css-modules' | 'styled-components' | 'css-variables' | 'plain-css' | 'mixed';
    class_to_rule_map: Record<string, {
      source_file: string;
      rule_text: string;
      line_number: number;
    }>;
    active_css_variables: Record<string, {
      value: string;
      declared_in: string;
    }>;
    tailwind_classes?: string[];
  };
  changes: Array<{
    property: string;
    before_computed: string;
    after_computed: string;
    before_source_rule?: string;
    expected_final_computed: string;
  }>;
  text_instructions?: string;
};
```

O agente injetado captura não apenas `getComputedStyle`, mas também:
- `document.styleSheets` → CSS rules matching o elemento
- Source map lookup via `@jridgewell/trace-mapping` → arquivo:linha
- Framework detection → contexto específico no prompt

## EditPlan — contrato entre AI e EditUp.dev

```typescript
type EditPlan = {
  summary: string;
  files: Array<{
    path: string;
    lines_affected: number[];
    reason: string;
    change_type: 'target' | 'linked_style' | 'design_token' | 'shared_component' | 'import' | 'formatting' | 'other';
    change_source: 'visual' | 'text_instruction' | 'both';
  }>;
  visual_changes_applied: boolean;
  text_instructions_applied: boolean;
  side_effects: string[];
  confidence: 'high' | 'medium' | 'low';
  recommended_action: 'apply' | 'review_first' | 'consider_alternatives';
  alternatives?: Array<{
    description: string;
    pros: string[];
    cons: string[];
  }>;
};
```

Validado com Zod. Se AI retornar fora do schema: nova tentativa com prompt rígido. Após 2 falhas: fallback para Copy Prompt com aviso.

## Integração AI — Adapter Registry

EditUp.dev suporta múltiplas AI tools via um sistema de adapters em 4 tiers:

### Tier 1 — MCP Server (universal)

EditUp expõe um MCP server em `127.0.0.1` com tools:
- `editup_get_snapshot` — retorna o enriched snapshot atual
- `editup_get_plan` — retorna o EditPlan para as mudanças visuais atuais
- `editup_apply_plan` — aplica um EditPlan aprovado
- `editup_get_status` — retorna estado atual da edição

Qualquer AI tool compatível com MCP (Cursor, Claude Desktop, Cline, Windsurf) pode se conectar como client.

### Tier 2 — CLI Adapters (spawn)

Para AI tools CLI-based, adapters diretos com `spawn()`:

```typescript
interface AIAdapter {
  readonly name: string;
  readonly type: 'cli' | 'mcp' | 'sdk' | 'clipboard';
  detect(): Promise<boolean>;
  plan(snapshot: EnrichedSnapshot): Promise<EditPlan>;
  execute(plan: EditPlan): Promise<ExecuteResult>;
  isRunning(): Promise<boolean>;
}
```

Adapters implementados:
- **ClaudeCodeAdapter**: `spawn('claude', [...args])` com `--allowedTools`, `--add-dir`, `--output-format json`
- **AiderAdapter**: `spawn('aider', ['--message', prompt, '--yes-always'])`

Todos usam `spawn()` com `shell: false` e args array.

### Tier 3 — Anthropic SDK (API direta)

Para devs sem CLI tool. ~400-500 LOC de wrapper. Mesmo padrão de dois passos via API com tools filtrados.

### Tier 4 — Copy Prompt (clipboard)

Sempre disponível. Copia enriched snapshot para clipboard. Para uso com qualquer AI tool externa.

### Detecção no `editup init`

1. Scan CLIs no PATH (`which claude`, `which aider`, etc.)
2. Scan MCP clients ativos
3. Verifica processo AI pai no terminal (PID tracking)
4. Dev escolhe adapter → salvo em `.editup/config.json`

### Session Manager — multi-terminal

Registro em `~/.editup/sessions.json`:
```json
{ "project_root": "/path", "ai_adapter": "claude-code", "ai_pid": 12345, "session_token": "uuid", "started_at": "..." }
```

- **Lock no apply step**: só um agente executando por vez. Se segundo tenta, enfileira com aviso.
- **Conflito detection**: antes de spawnar novo processo AI, verifica se já existe um ativo para o projeto.
- **PID tracking**: registra PID do terminal pai para identificar de qual terminal veio o `editup init`.

### Invocação Claude Code (exemplo)

```typescript
// PLAN STEP — read-only, sem Edit
const planArgs = [
  '-p', planPrompt,
  '--model', 'claude-sonnet-4-6',
  '--allowedTools', 'Read,Glob,Grep',
  '--add-dir', projectRoot,
  '--output-format', 'json',
  '--max-turns', '10',
];

// EXECUTE STEP — após aprovação do dev
const executeArgs = [
  '-p', executePrompt,
  '--model', 'claude-sonnet-4-6',
  '--allowedTools', 'Read,Glob,Grep,Edit',
  '--add-dir', projectRoot,
  '--output-format', 'json',
  '--max-turns', '15',
];

spawn('claude', args, { shell: false, cwd: projectRoot, timeout: 180_000 });
```

Regras: sempre `spawn()` com `shell: false`. Nunca `--dangerously-skip-permissions`. Plan step sempre sessão nova. `--add-dir` restringe filesystem.

## Testes obrigatórios

Todo PR deve passar em todos os testes antes de merge.

### Testes unitários (`tests/unit/`)

**Proxy:**
- `proxy.injection.test.ts` — Script injetado em HTML, NÃO em não-HTML
- `proxy.passthrough.test.ts` — Headers, cookies, status codes repassados
- `proxy.websocket.test.ts` — WebSocket HMR repassado intacto
- `proxy.binding.test.ts` — Bind apenas em `127.0.0.1`

**Agente injetado:**
- `agent.capture.test.ts` — `getComputedStyle()` + CSS rules corretos para diferentes fontes de estilo
- `agent.context.test.ts` — Classes, seletor DOM, texto visível, árvore de ancestrais
- `agent.rules.test.ts` — CSS rule matching via `document.styleSheets`
- `agent.preview.test.ts` — `element.style` override funciona e é removido ao resetar
- `agent.token.test.ts` — Rejeita WebSocket sem token válido
- `agent.brackets.test.ts` — Floating brackets posicionados corretamente nos 4 cantos

**Snapshot:**
- `snapshot.diff.test.ts` — Diff inclui apenas propriedades que mudaram
- `snapshot.enriched.test.ts` — EnrichedSnapshot contém class_to_rule_map, active_css_variables, framework
- `snapshot.format.test.ts` — Campos obrigatórios presentes
- `snapshot.values.test.ts` — Valores CSS normalizados (rgb → hex)

**Prompt:**
- `prompt.generation.test.ts` — Prompt contém snapshot, instrução, framework
- `prompt.combined.test.ts` — Prompt combina visual_changes + text_instructions separados
- `prompt.sanitization.test.ts` — Escapa caracteres especiais (XML + CDATA)
- `prompt.framework.test.ts` — Menciona framework correto

**AI Bridge (plan/execute):**
- `bridge.plan.test.ts` — Plan step usa allowlist sem Edit
- `bridge.execute.test.ts` — Execute step inclui Edit e EditPlan no prompt
- `bridge.spawn.test.ts` — Invocação usa `spawn()` com `shell: false`
- `bridge.no-dangerous.test.ts` — `--dangerously-skip-permissions` NUNCA aparece
- `bridge.session.test.ts` — Plan step é sempre sessão nova
- `bridge.conflict.test.ts` — Detecção de processo AI ativo
- `bridge.fallback.test.ts` — Após 2 falhas, cai para Copy Prompt

**AI Adapters:**
- `adapter.registry.test.ts` — Registro e detecção de adapters disponíveis
- `adapter.detection.test.ts` — Detecção de CLIs no PATH e MCP clients
- `adapter.claude-code.test.ts` — ClaudeCodeAdapter spawn correto
- `adapter.session-manager.test.ts` — Registro de sessão, PID tracking, conflito
- `mcp.server.test.ts` — MCP server expõe tools corretamente em 127.0.0.1

**EditPlan validation:**
- `editplan.schema.test.ts` — Zod valida campos obrigatórios, tipos, enums
- `editplan.combined.test.ts` — change_source, visual_changes_applied, text_instructions_applied
- `editplan.invalid.test.ts` — Respostas fora do schema rejeitadas
- `editplan.property-based.test.ts` — Property-based testing

**Editor:**
- `editor.panels.test.ts` — Cada painel renderiza e aceita input
- `editor.layers.test.ts` — Hierarquia correta, troca seleção ao clicar
- `editor.responsive.test.ts` — 3 modos de layout (wide/medium/narrow)
- `editor.ai-input.test.ts` — Input de texto captura e combina com visual
- `editor.progress.test.ts` — Progress marker mostra elementos editados
- `editor.code-box.test.ts` — Code box mostra source do elemento

**Toast UX:**
- `toast.compact.test.ts` — Toast compacto para `confidence: 'high'`
- `toast.warning.test.ts` — Toast destaca side effects
- `toast.alternatives.test.ts` — Toast expande com alternativas para `confidence: 'low'`
- `toast.combined.test.ts` — Toast distingue mudanças visuais vs texto
- `toast.express.test.ts` — Modo express pula toast

**Licenciamento:**
- `license.check.test.ts` — Key válida/inválida/sem key
- `license.grace.test.ts` — Grace period (< 7 dias permite, > 7 bloqueia)
- `license.encryption.test.ts` — Key armazenada criptografada
- `license.tester-limit.test.ts` — Tester limitado a 15 edits/dia

### Testes de segurança (`tests/security/`)

- `security.ws-binding.test.ts` — WebSocket NÃO aceita conexões fora de 127.0.0.1
- `security.mcp-binding.test.ts` — MCP server NÃO aceita conexões fora de 127.0.0.1
- `security.ws-token.test.ts` — WebSocket rejeita sem token
- `security.no-external-requests.test.ts` — NENHUMA request externa exceto Lemon Squeezy
- `security.license-storage.test.ts` — Licença NÃO em plaintext
- `security.proxy-isolation.test.ts` — Proxy não expõe headers internos
- `security.prompt-no-leak.test.ts` — Prompt não é logado
- `security.no-dangerous-skip.test.ts` — `--dangerously-skip-permissions` ausente
- `security.plan-no-edit.test.ts` — Plan step sem Edit na allowlist

### Testes e2e (`tests/e2e/`)

- `e2e.full-flow.test.ts` — Fluxo completo: proxy → browser → seleciona (floating brackets) → edita → escreve instrução texto → plan → toast → execute → 3 verificações → commit
- `e2e.preview.test.ts` — Edição atualiza visual no browser em < 100ms
- `e2e.layers.test.ts` — Clicar em camadas atualiza editor
- `e2e.reset.test.ts` — Resetar remove overrides
- `e2e.multi-edit.test.ts` — Múltiplas edições geram snapshots independentes
- `e2e.toast-approval.test.ts` — Fluxos de aprovação/cancelamento, modo express
- `e2e.combined-flow.test.ts` — Visual + texto combinados no mesmo apply
- `e2e.revert.test.ts` — Botão "Reverter" executa revert do auto-commit
- `e2e.responsive-editor.test.ts` — Editor adapta nos 3 modos de largura
- `e2e.frameworks.test.ts` — Fluxo completo contra React+Vite, Next.js, Vue+Vite, Nuxt, HTML vanilla

### Testes de verificação pós-aplicação (`tests/unit/`)

- `verification.visual.test.ts` — getComputedStyle pós-edit vs expected (>5px, >15 RGB)
- `verification.visual-text.test.ts` — Verificação diferenciada: visual estrita, texto leve
- `verification.scope.test.ts` — Scope leak em irmãos não previstos
- `verification.scope-expected.test.ts` — Mudanças previstas confirmadas
- `verification.diff-audit.test.ts` — Git diff vs plan.files
- `verification.diff-extras.test.ts` — Arquivos extras logados com aviso
- `verification.correction.test.ts` — Correction pass automático com prompt de divergências
- `verification.max-retries.test.ts` — Após 2 correction attempts, para e mostra ao dev
- `verification.auto-commit.test.ts` — Auto-commit `editup: <summary>` com metadados

## Observabilidade

### Log de execuções

Cada Apply grava JSON em `~/.editup/history/<timestamp>.json` com: timestamp, project_root, element, plan (summary, files, confidence, side_effects_count), user_approved, approval_mode (toast/express), ai_adapter_used, execute (files_modified, files_extra, duration_ms, model, token_usage), verification (visual_check, scope_check, diff_check, correction_attempts), git_commit, status.

Painel no app Tauri com "Histórico de edições" mostra cada entrada com resumo, arquivos, e botão "Reverter este commit".

### Rate limit local

Tester: 15 edits/dia. Pro/Founder's: 30 Applies/hora, sem limite diário. Configurável. Contador visível no painel.

### Modo verbose + debug bundle

Disponível para troubleshooting. Debug bundle coleta logs sem conteúdo de código.

## Fase 1: Landing Page

A landing page é construída ANTES do produto. Objetivo: validar demanda com waitlist.

### Referência visual: https://www.blitzit.app

**Estrutura:**
- Header fixo com logo wordmark + nav minimalista + CTA
- Hero section com headline, sub-headline, CTA + demo animada do fluxo em loop
- Seção "How it works" com 4 steps visuais
- Seção de features com lista completa de propriedades CSS editáveis
- Seção de pricing com 3 planos (Tester, Pro, Founder's)
- Seção de waitlist com Tally embed
- Footer minimalista

**Estilo visual:**
- Background escuro (dark mode por padrão)
- Cores de accent: purple #7c3aed, light purple #a855f7, blue #3b82f6
- Tipografia: Geist Sans + Geist Mono
- Cards com bordas sutis, backgrounds elevados
- Animações de scroll-reveal (Framer Motion)
- Design mobile-first, responsivo

### Stack da landing page

- Next.js 16 + TypeScript
- Tailwind CSS v4 para styling
- Framer Motion para animações
- Tally embed para waitlist
- Deploy na Vercel

## Licenciamento e pricing

| Plano | Preço | Inclui |
|-------|-------|--------|
| Tester | $0 | TODAS as features incluindo AI plan+execute, 15 edits/dia, 1 projeto, dev traz API key |
| Pro | $19/mês | Edições ilimitadas, multi-projeto, express mode, auto-commit, suporte prioritário |
| Founder's Edition | $199 one-time | Pro para sempre + updates vitalícios, primeiros 100 users, Discord privado |

Tester tem acesso completo ao produto (incluindo AI integration). A limitação é apenas de volume (15/dia) e projetos (1). Dev traz própria API key em todos os planos. Transparência > margem.

## Ordem de desenvolvimento

1. **Landing page** — construir e deployar, iniciar distribuição
2. **Proxy Rust + agente injetado** — proof-of-concept (floating brackets, captura CSS rules)
3. **Editor visual** — layout adaptativo (3 modos), painéis CSS, code box, layers, progress
4. **Enriched snapshot + prompt generator** — ponte entre visual e AI (5 camadas de precisão)
5. **AI Adapter Registry** — MCP server + CLI adapters + SDK + Copy Prompt
6. **AI bridge (plan/execute)** — orquestração de dois passos + EditPlan Zod
7. **AI input (texto)** — caixa de instruções combinada com edições visuais
8. **Toast de aprovação** — 3 comportamentos (compacto, warning, alternativas) + visual vs texto
9. **Verificação pós-aplicação** — 3 camadas + correction pass (max 2)
10. **Auto-commit + revert** — commit isolado por edição, revert 1 clique
11. **Session manager** — multi-terminal, PID tracking, lock no apply
12. **Source maps** — Vite primeiro, Webpack depois
13. **Licenciamento** — Lemon Squeezy + JWT, Tester 15/dia, Pro ilimitado
14. **Observabilidade** — histórico JSON, painel, rate limit
15. **Testes e2e completos** — contra múltiplos frameworks
16. **Polish + beta release**

## O que NÃO fazer

- Não usar `--dangerously-skip-permissions` — nunca, em nenhum contexto
- Não usar `exec()` com template string — sempre `spawn()` com `shell: false` e args array
- Não incluir `Edit` na allowlist do plan step — plan é read-only estruturalmente
- Não incluir `Write`, `Bash`, ou `WebFetch` na allowlist de nenhum step
- Não usar overlay com background sobre elementos — usar floating brackets
- Não hardcodar integração para uma única AI tool — usar Adapter Registry
- Não instalar dependências no projeto do usuário
- Não fazer requests para servidores externos (exceto Lemon Squeezy)
- Não logar conteúdo de prompts, código, ou valores CSS
- Não usar `0.0.0.0` em nenhum bind de servidor (incluindo MCP server)
- Não armazenar dados do usuário em nenhum lugar exceto localmente
- Não adicionar `console.log` em produção
- Não criar componentes de classe React
- Não usar `any` em TypeScript
- Não exceder 200 linhas por arquivo
- Não fazer merge sem todos os testes passando
