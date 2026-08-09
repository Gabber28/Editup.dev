# CLAUDE.md — EditUp.dev

## Projeto

> **Nota:** o projeto foi originalmente chamado de **Opal** e passou a se chamar **EditUp.dev**. Qualquer referência antiga a "Opal" deve ser tratada como "EditUp.dev".

EditUp.dev é um editor visual no-code para frontend web. Funciona via proxy local, captura estilos CSS de qualquer elemento no browser do usuário via `getComputedStyle()` + CSS rules + source maps, permite edição visual com preview ao vivo, e invoca qualquer AI tool (Claude Code, Cursor, Aider, Cline, ou via MCP) em dois passos — plan (dry-run read-only) e execute (com aprovação) — para aplicar as mudanças no código fonte. Suporta também instruções textuais do dev combinadas com edições visuais. Style-agnostic: funciona com Tailwind, CSS puro, Modules, styled-components, design tokens.

Documento de planejamento: `editup-planning-v3.2 (1).md` (na raiz do projeto, apenas referência — não incluir no build).

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

## Layout do editor — barra de botões no topo

As ferramentas de edição ficam atrás de uma **barra de botões pequenos no topo** (`panel-tabs.tsx`), um por grupo de propriedades, mostrando **um painel por vez**. Os botões são derivados de um **registry declarativo** (`sections.tsx`) que é a fonte única de ordem + aplicabilidade — nunca duplicar essa lista em outro lugar.

### Ordem e agrupamento (fixos)

**Universais (sempre):** Layout → Spacing → Effects → Colors → Borders. Colors é ocultado em elementos de mídia substituída (`img/video/iframe/canvas/embed/object`).
**Contextuais (só quando aplicável):** Typography (quando `element.has_text`) · Image (quando `media.kind ≠ "none"`).
**Interação (por último):** Link.
**Source:** botão ao final, só quando há snippet capturado.

Como a barra é contextual, o botão ativo pode deixar de existir ao trocar de elemento (estava em Image, seleciona um `<p>`). O `Inspector` **cai para o primeiro botão visível** nesse caso — sem isso a área de painel renderiza vazia.

O `StateSelector` (default/:hover/:focus…) fica logo abaixo da barra, global ao painel ativo.

### 3 modos adaptativos (largura)

- **Wide (>900px):** Layers panel à esquerda (200px) + editor à direita.
- **Medium (500-900px) / Narrow (<500px):** Layers oculto; o editor ocupa a largura toda. A barra de botões é a mesma nos 3 modos, rolando na horizontal quando não cabe.

Apenas o painel ativo (`.panel-content`) rola; identity + barra de botões + state selector ficam fixos no topo e progress + AI input + Apply bar fixos no rodapé. Tauri window config: `min_width: 280`, `min_height: 400`.

### Componentes do editor

- **Element identity:** tag, classe, source file:line, mini-preview (cloneNode + computed styles)
- **Layers panel:** árvore DOM hierárquica, marcadores visuais nos elementos já editados
- **Panel tabs:** barra de botões pequenos; recebe a lista pronta por prop (apresentação apenas)
- **Inspector:** deriva os botões do registry, guarda o ativo e renderiza o painel correspondente
- **Code box:** snippet read-only do source do elemento (botão "Source")
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

Tipo completo em `src/types/snapshot.ts`.

O agente injetado captura não apenas `getComputedStyle`, mas também:
- `document.styleSheets` → CSS rules matching o elemento
- Source map lookup via `@jridgewell/trace-mapping` → arquivo:linha
- Framework detection → contexto específico no prompt

## EditPlan — contrato entre AI e EditUp.dev

Schema Zod em `ai-bridge/edit-plan.ts`.

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

Para AI tools CLI-based, adapters diretos com `spawn()`. Interface `AIAdapter` em `src/lib/ai-adapters/types.ts`.

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

### Invocação Claude Code

Argumentos exatos em `src/lib/ai-adapters/claude-code.ts`.

Regras: sempre `spawn()` com `shell: false`. Nunca `--dangerously-skip-permissions`. Plan step sempre sessão nova. `--add-dir` restringe filesystem.

## Testes obrigatórios

Todo PR deve passar em todos os testes antes de merge.

Os testes vivem em `tests/unit/`, `tests/e2e/` e `tests/security/`.

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
