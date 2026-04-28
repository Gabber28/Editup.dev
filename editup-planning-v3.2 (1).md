# Opal — Documento de Planejamento MVP v3.2

## 0. Por que v3.2 e não v3.1

O v3.1 propôs substituir a LLM por um Apply Engine determinístico com adapters por sistema de styling. Essa direção estava errada por uma razão que só ficou clara em revisão: **o valor central da LLM no Opal é exatamente saber entender o projeto inteiro antes de editar**.

Adapters determinísticos assumem que o Opal consegue classificar corretamente como aplicar uma mudança sem conhecer a arquitetura específica do projeto. Isso funciona em casos triviais (Tailwind com string estática, CSS vanilla simples), mas falha quando:

- O projeto tem `Button.tsx` usado em 12 lugares com prop `variant` — mudar o botão clicado exige decidir entre criar variant nova, sobrescrever inline, ou estender o design system
- Há shadcn customizado com tokens próprios que devem ser respeitados
- Existe um design system interno com convenções não-óbvias
- Styled-components com props condicionais precisam de lógica contextual
- Monorepo com variantes de componente compartilhadas entre apps

Nesses casos, o adapter determinístico retornaria `cannot_apply` e cairia no fallback LLM — ou seja, o Apply Engine determinístico quase nunca rodaria na prática para projetos reais, e o Opal entregaria marketing de precisão que não cumpre. Pior ainda: os 2k LOC de adapters seriam código que raramente executa.

**O v3.2 aceita a premissa correta**: a LLM edita o código com a liberdade que ela precisa para entender e respeitar a arquitetura existente. O Opal oferece três coisas que transformam isso em uma experiência confiável:

1. **Transparência mínima via dry-run**: um toast antes do apply mostrando "vai mudar X arquivos: [lista]", com aprovação rápida.
2. **Verificação forte depois**: scope check visual, git diff audit, e auto-commit dedicado que torna revert um clique.
3. **Sem restrições artificiais na LLM**: ela pode reorganizar imports, consolidar código, atualizar o design system — o dev considera essas melhorias de manutenção úteis. Se for longe demais, o revert é trivial.

Essa é a arquitetura alinhada com a escolha do dev: "LLM decide tudo, Opal verifica e reverte se fugiu; fricção mínima com toast de aprovação; ajudas da AI são geralmente bem-vindas".

O v3.1 está oficialmente aposentado. Este v3.2 é o successor do v3.

---

## 1. Mudanças principais vs v3

- **LLM edita o código real com autoridade**: via Claude Code CLI (default) ou API direta (alternativa), com `--allowedTools "Edit,Read,Glob,Grep"` e acesso ao projeto inteiro em leitura. Ela decide como aplicar baseando-se na arquitetura real do projeto.
- **Dry-run obrigatório antes de aplicar**: primeira chamada à LLM retorna um plano estruturado listando arquivos/linhas que serão editados, antes de qualquer write. Segunda chamada executa (opcionalmente) após aprovação via toast.
- **Toast de aprovação leve**: não é um diff review — é *"Vai mudar 2 arquivos: `Hero.tsx`, `theme.css`. [Aplicar] [Ver detalhes] [Cancelar]"*. Clicar "Aplicar" é a interação padrão; "Ver detalhes" expande para os devs que querem ver antes.
- **Scope check visual como freio de segurança**: após apply, Opal relê `getComputedStyle` do alvo + irmãos. Se elementos que não deveriam mudar mudaram, alerta — não bloqueia, mas torna visível.
- **Auto-commit dedicado**: cada Apply é um commit isolado `opal: <resumo>`. Revert é `git reset --hard HEAD~1` via botão.
- **Copy Prompt mantido** como fluxo universal sem LLM (para Free tier e usuários de Cursor/Bolt/Lovable).
- **Tudo mais do v3 preservado**: proxy Rust, script injetado, Lemon Squeezy + JWT, Tauri, observabilidade, auto-update, LGPD/GDPR. Esse é um refinamento do v3, não uma reescrita.

Resultado: ~90% do v3 é mantido. A mudança específica está em **como a LLM é invocada**: sempre em dois passos (plan → approve → execute), nunca em um passo cego.

---

## 2. Posicionamento

### Headline

> **"Edit your frontend visually. Our AI applies changes to your code respecting your stack, conventions, and architecture."**

### Sub-headline

> *"Opal lets you edit any element visually in your running app. Click Apply — AI reads your project, plans the changes, and shows you exactly what will be modified before writing anything. You approve in one click."*

### Diferencial honesto

A LLM sabe entender um projeto React com design system customizado, styled-components com theme, CSS Modules com composição, Tailwind com convenções próprias. O Opal não tenta fazer essa parte melhor que a LLM — delega pra ela, mostra o que ela vai fazer antes de escrever, e entrega verificação forte depois. Se a AI fizer algo além do pedido (reorganizar imports, melhorar uma classe próxima, etc.), o dev vê no commit, e se não gostar, reverte num clique.

### Público-alvo

Devs frontend trabalhando em projetos React/Vue de complexidade real. Não "vibe coders" de uma página estática — devs que têm design system, componentes compartilhados, convenções de time, stack estabelecida. A proposta de valor só faz sentido para esse público, porque é o público cujo projeto a LLM precisa respeitar.

Público secundário atendido via Copy Prompt: quem não quer instalar LLM provider ou trabalha em ferramentas externas (Cursor, Bolt, Lovable).

---

## 3. Fluxo de edição (o coração do v3.2)

```
┌──────────────────────────────────────────────────────────────┐
│                  FLUXO DE APLY (v3.2)                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Dev edita visualmente → Clica "Aplicar"                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ PASSO 1 — PLAN (dry-run)                             │    │
│  │ ─────────────────────                                │    │
│  │ Opal chama LLM com:                                  │    │
│  │   • Snapshot visual (antes → depois)                 │    │
│  │   • Contexto do elemento (arquivo, componente)       │    │
│  │   • Acesso READ-ONLY ao projeto                      │    │
│  │   • Instrução: "Retorne um plano em JSON.            │    │
│  │      NÃO edite nenhum arquivo."                      │    │
│  │                                                      │    │
│  │ LLM retorna EditPlan:                                │    │
│  │   {                                                  │    │
│  │     summary: "Change button bg to black",            │    │
│  │     files: [                                         │    │
│  │       { path: "Hero.tsx", lines_affected: [47],      │    │
│  │         reason: "Target element" },                  │    │
│  │       { path: "theme.css", lines_affected: [12],     │    │
│  │         reason: "Update --primary token" }           │    │
│  │     ],                                               │    │
│  │     side_effects: ["3 other buttons use             │    │
│  │       --primary and will change color too"],         │    │
│  │     confidence: "high"                               │    │
│  │   }                                                  │    │
│  │ Tempo: ~2-4s                                         │    │
│  └─────────────────────┬────────────────────────────────┘    │
│                        │                                     │
│                        ▼                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ PASSO 2 — TOAST DE APROVAÇÃO                         │    │
│  │ ─────────────────────────────                        │    │
│  │                                                      │    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │  Aplicar mudanças?                             │  │    │
│  │  │                                                │  │    │
│  │  │  2 arquivos serão modificados:                 │  │    │
│  │  │  • Hero.tsx (1 linha)                          │  │    │
│  │  │  • theme.css (1 linha)                         │  │    │
│  │  │                                                │  │    │
│  │  │  ⚠ 3 outros botões também mudarão de cor       │  │    │
│  │  │                                                │  │    │
│  │  │  [Aplicar]  [Ver detalhes]  [Cancelar]         │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  │  "Ver detalhes": expande com lista completa e       │    │
│  │  trechos antes/depois (não é diff linha-a-linha —   │    │
│  │  é uma visão leve do que a AI vai mudar)            │    │
│  │                                                      │    │
│  │  "Aplicar sem confirmar de novo (sessão)":           │    │
│  │  checkbox opcional — devs que se sentiram           │    │
│  │  confortáveis podem acelerar o loop depois.          │    │
│  └─────────────────────┬────────────────────────────────┘    │
│                        │ (se aprovado)                       │
│                        ▼                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ PASSO 3 — EXECUTE                                    │    │
│  │ ─────────────────                                    │    │
│  │ Opal chama LLM novamente com:                        │    │
│  │   • Mesmo contexto do plan                           │    │
│  │   • + o EditPlan aprovado                            │    │
│  │   • Permissão: Edit, Read, Glob, Grep                │    │
│  │   • Instrução: "Execute o plano acima."              │    │
│  │                                                      │    │
│  │ LLM edita os arquivos via ferramentas normais        │    │
│  │ Tempo: ~5-15s                                        │    │
│  └─────────────────────┬────────────────────────────────┘    │
│                        │                                     │
│                        ▼                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ PASSO 4 — HOT RELOAD + VERIFICAÇÃO                   │    │
│  │ ───────────────────────────────                      │    │
│  │ Browser recarrega (~3-5s)                            │    │
│  │                                                      │    │
│  │ Opal executa 3 checks:                               │    │
│  │   a) Visual: alvo ficou como esperado?               │    │
│  │   b) Scope: irmãos com mesma classe não              │    │
│  │      mudaram involuntariamente? (ou mudaram como     │    │
│  │      anunciado no side_effects?)                     │    │
│  │   c) Git diff: arquivos mudados = arquivos           │    │
│  │      previstos no plan (± tolerância)?               │    │
│  │                                                      │    │
│  │ Resultados:                                          │    │
│  │   ✓ Tudo OK → auto-commit "opal: <summary>"          │    │
│  │   ⚠ Divergência visual → aviso, oferece reverter     │    │
│  │   ⚠ Scope leak inesperado → aviso + diff + revert    │    │
│  │   ⚠ Arquivos a mais → aviso, mostra diff completo    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### EditPlan: o contrato entre LLM e Opal

```typescript
type EditPlan = {
  summary: string;               // 1-line human-readable
  files: Array<{
    path: string;                // absolute path in project
    lines_affected: number[];    // approximate, 1-indexed
    reason: string;              // why this file is touched
    change_type: 'target' | 'linked_style' | 'design_token' | 'shared_component' | 'import' | 'formatting' | 'other';
  }>;
  side_effects: string[];        // human-readable warnings
  confidence: 'high' | 'medium' | 'low';
  recommended_action: 'apply' | 'review_first' | 'consider_alternatives';
  alternatives?: Array<{          // only for recommended_action != 'apply'
    description: string;
    pros: string[];
    cons: string[];
  }>;
};
```

Validado com Zod ao receber. Se LLM retornar algo fora do schema, Opal faz nova tentativa com prompt mais rígido; após 2 falhas, cai para Copy Prompt com aviso ao dev.

### O toast, em detalhe

Três comportamentos possíveis baseados em `confidence` e `side_effects`:

**Caso comum (`confidence: 'high'`, sem side effects significativos)**: toast compacto e discreto. Botão "Aplicar" é o default, dev pode apertar Enter.

> *Aplicar mudanças? 1 arquivo: `Hero.tsx`. [Aplicar] [Detalhes] [Cancelar]*

**Caso médio (`confidence: 'high'` ou `'medium'`, side effects presentes)**: toast destaca o side effect.

> *Aplicar mudanças? 2 arquivos. ⚠ 3 outros botões vão mudar também (usam mesmo token). [Aplicar] [Detalhes] [Cancelar]*

**Caso cuidadoso (`confidence: 'low'` ou `recommended_action: 'consider_alternatives'`)**: toast expande automaticamente para mostrar alternativas, "Aplicar" não é default.

> *Esta mudança pode ter várias abordagens:*
> - *Editar o design token (afeta 3 outros botões)*
> - *Criar uma variante local no componente*
> - *Sobrescrever inline neste uso específico*
>
> *[Editar token] [Criar variante] [Sobrescrever inline] [Ver todas as opções] [Cancelar]*

O toast de confiança baixa é raro (a maioria das edições é `high`) mas crítico — é onde o Opal entrega o valor de *"a AI entende a arquitetura"* visivelmente.

### "Aplicar sem confirmar de novo" (modo express)

Checkbox persistente na sessão (não entre sessões). Devs que fizeram 5 Applies seguidos e se acostumaram com a consistência da AI podem desativar o toast. Mantém o dry-run internamente, mas só mostra toast se `confidence != 'high'` ou `side_effects.length > 0`. Fricção vira quase zero para o fluxo limpo, e toasts ainda aparecem quando importam.

### Quando o plan e o execute divergem

A LLM pode, no execute, decidir mudar um arquivo a mais do que listou no plan. Razões legítimas: notou inconsistência óbvia, precisou de ajuste de tipo, etc. O Opal não bloqueia — **mostra no auditoria pós-apply**. O commit inclui o diff completo e um aviso explícito no log do Opal: *"A LLM modificou 3 arquivos (planejou 2). Extra: `utils.ts` — razão provável: ajuste de tipagem."*. Dev revisa, reverte se quiser.

Isso é consistente com a escolha "AI ajudando com manutenção é geralmente bom" — não punimos a LLM por melhorar além do pedido, só garantimos que o dev vê.

---

## 4. LLM provider (flexível)

Três modos, dev escolhe no `opal init`:

### 4.1 Claude Code CLI (default)

```typescript
// Plan step
const planArgs = [
  '-p', planPrompt,
  '--model', 'claude-sonnet-4-6',
  '--allowedTools', 'Read,Glob,Grep',      // NO Edit/Write on plan step
  '--add-dir', projectRoot,
  '--output-format', 'json',
  '--max-turns', '10',                     // Need to explore to plan well
];

// Execute step (after user approval)
const executeArgs = [
  '-p', executePrompt,                     // Includes the approved EditPlan
  '--model', 'claude-sonnet-4-6',
  '--allowedTools', 'Read,Glob,Grep,Edit', // Edit now allowed
  '--add-dir', projectRoot,
  '--output-format', 'json',
  '--max-turns', '15',
  '--continue',                            // Optional: continue the plan session
];

spawn('claude', args, { shell: false, cwd: projectRoot, timeout: 180_000 });
```

Observação crítica: no step de plan, `Edit` **não está na allowlist**. Isso garante que o dry-run é de fato um dry-run — mesmo se a LLM tentar editar, ela vai ser bloqueada pelo próprio Claude Code. É uma salvaguarda estrutural, não dependente de prompt.

Opção `--continue` no execute permite reuso do contexto de plan (mais barato, mais rápido). Mas por default continua desligado para evitar poluição do histórico interativo do dev (§12).

### 4.2 Anthropic SDK direto (alternativa)

Para devs sem Claude Code CLI, chave Anthropic direta. Usa o mesmo padrão de dois passos mas via API com `tools` filtrados (tools de `view` no plan, tools de `edit` no execute). LLM edita arquivos via protocol de tool-use standard.

Implementação: ~400-500 LOC de wrapper em torno do SDK.

### 4.3 Copy Prompt (fallback universal, sem LLM)

Mantido do v3. Dev clica "Copy Prompt", Opal copia o snapshot visual + contexto para clipboard, dev cola em qualquer AI tool (Cursor, Bolt, Lovable, Claude Desktop, ChatGPT). Sem dry-run, sem auto-commit (ferramenta externa gerencia) — mas existe para Free tier e para casos onde o dev quer controle total manual.

### Por que Claude Code como default

A LLM precisa de acesso real ao codebase para entender arquitetura antes de editar. Claude Code resolve isso nativamente (contexto incremental, read cache, convenções). Via SDK puro, o Opal precisaria reimplementar file reading loops, context management, etc. — é viável mas mais código. Claude Code é a ferramenta certa; SDK é a alternativa para quem não tem o CLI.

---

## 5. Segurança (muito mais leve que v3)

### Mudanças vs v3

- **Sai** a seção inteira sobre `--dangerously-skip-permissions`. Nunca é usado. Em nenhum momento.
- **Permanece** a restrição de allowlist, mas aplicada corretamente: plan = `Read,Glob,Grep` / execute = `Read,Glob,Grep,Edit` (sem `Write`, sem `Bash`, sem `WebFetch`).
- **Sai** muito da complexidade de prompt injection worst-case. A razão: a LLM no plan não pode editar (structural). No execute, ela recebeu um EditPlan que o dev aprovou — mesmo se um ataque de injection redirecionasse, o resultado fica no auto-commit isolado e o dev vê o diff.
- **Permanece** sanitização XML + CDATA dos dados do DOM. Custo baixo, defesa em profundidade.
- **Permanece** proteção do proxy: bind 127.0.0.1, validação Host, Origin WS, token challenge-response.
- **Permanece** `--add-dir <projectRoot>` como escopo de filesystem.

### Invocação via `spawn()` com args array

Mantido do v3. `shell: false` sempre. Nunca `exec()` com template string.

### Threat model atualizado

**Vetores mitigados estruturalmente:**
- Prompt injection que tenta executar shell: LLM não tem Bash. Claude Code bloqueia. Sem shell = sem RCE.
- Prompt injection que tenta editar arquivo fora do projeto: `--add-dir` restringe. Claude Code bloqueia escritas fora.
- Edição fora do escopo aprovado: visível no auto-commit, dev reverte em 1 clique.

**Vetores não mitigados, mas aceitos com trade-off explícito:**
- LLM durante o execute pode tocar mais arquivos do que o plan prometeu. Mitigação: scope audit + diff visível + auto-commit isolado. Dev tem informação e mecanismo de revert trivial. Este trade-off reflete a escolha "LLM ajudando em manutenção é geralmente bom".
- Site malicioso no dev server injetando conteúdo no DOM que acaba no prompt: sanitização + o dev aprova antes. Pior caso: LLM faz edição baseada em texto ruim, dev vê no plan, cancela.

### O que não existe mais vs v3

- Debate "--allowedTools vs --disallowedTools" bypass bugs → não aplicável (tools sempre positivamente listados)
- Preocupação com "o que se Claude Code mudar --output-format" → mitigado com validação Zod + fallback
- Discussão de `--dangerously-skip-permissions` → nunca usado

A seção de segurança do v3.2 fica ~40% do tamanho da do v3. Não porque relaxamos, mas porque o design estrutural já elimina a maioria das categorias.

---

## 6. Verificação pós-aplicação (detalhada)

### Camada 1 — Visual check

Após hot reload, relê `getComputedStyle(target)`. Compara com `expected_final_state` do snapshot. Tolerância ampla (>5px dimensões, >15 RGB per channel). Aguarda `transitionend` ou 1s antes de ler.

Se bater: silêncio (sucesso).
Se divergir: toast *"Visual diferente do esperado. Ver diferença? [Ver] [Reverter] [Aceitar]"*.

### Camada 2 — Scope check

Identifica elementos na página com:
- Mesmo seletor
- Mesma classe original
- Componente importado do mesmo arquivo (via source map)

Relê `getComputedStyle` de cada. Compara com snapshots pré-edit.

Se nenhum mudou: ok.
Se alguns mudaram **e estavam listados em `side_effects`**: confirma ao usuário *"3 botões relacionados mudaram como previsto ✓"*.
Se alguns mudaram **sem estar previstos**: alerta *"⚠ Scope leak: 2 elementos mudaram sem aviso no plano. [Ver] [Reverter]"*.

### Camada 3 — Git diff audit

```bash
git diff HEAD --stat
```

Compara lista de arquivos alterados com `plan.files.map(f => f.path)`.

Se idêntico ou subconjunto: ok.
Se tem extras: log + aviso suave *"A LLM também mudou `utils.ts` (não estava no plano). Ver diff completo? [Ver]"*. Não bloqueia — consistente com "ajudas da AI são geralmente bem-vindas".
Se tem extras em paths sensíveis (package.json, lockfiles, .env): aviso forte *"⚠ Arquivos críticos modificados"*. Ainda não bloqueia, mas destaca.

### Auto-commit

```bash
git add -A
git commit -m "opal: $(plan.summary)

Files: $(plan.files.map(f => f.path).join(', '))
Extras: $(extras.join(', '))  # se houve
Plan confidence: $(plan.confidence)
"
```

Commits ficam rastreáveis. `git log --grep "^opal:"` lista todas as edições Opal. Revert é `git reset --hard <hash>`.

Se o projeto não é git: aviso no primeiro Apply, opção de `git init`. Se declinar, desabilita auto-commit + scope check baseado em diff (camadas 1 e 2 continuam funcionando).

---

## 7. UX do painel (mantido do v3)

Sem mudanças vs v3. Sistema de camadas, seções colapsáveis, preview via `element.style`, controles CSS reais. Ver v3 §8.

Adição pequena: ao lado do botão "Aplicar", um indicador sutil mostrando o modo atual (*Claude Code / API Anthropic / Copy Prompt*). Dev sabe o que acontece quando clica, sem surpresa.

---

## 8. Stack (quase igual ao v3)

| Camada | Tecnologia | Mudança vs v3? |
|--------|-----------|----------------|
| Desktop app | Tauri v2 + React + TypeScript | Igual |
| Proxy local | Rust nativo (hyper + tower-http) | Igual |
| Script injetado | TypeScript bundlado com esbuild | Igual |
| Editor visual | React | Igual |
| Source maps | `@jridgewell/trace-mapping` | Igual |
| **LLM interface** | Claude Code CLI (default) + Anthropic SDK (alt) | Mesmo que v3 |
| **Plan/Execute orchestration** | TypeScript no Tauri | Refinado (2 passos em vez de 1) |
| **EditPlan schema validation** | Zod | **Novo** (mas pequeno, ~50 LOC) |
| Licenciamento | Lemon Squeezy + Cloudflare Workers (JWT) | Igual |
| Auto-update | Tauri Updater + GitHub Secrets | Igual |
| Landing | Next.js + Tally | Igual |

Mudanças de LOC vs v3: +200 LOC (orquestração plan/execute + EditPlan validation + toast UI). Não há Apply Engine com adapters (aposentado com v3.1). Código total permanece ~10-15k LOC.

---

## 9. Fluxo do usuário completo

```
1. Instalação (uma vez)
   • Baixa Opal (Tauri .dmg/.exe/.deb)
   • Instala Claude Code CLI se ainda não tem (opcional)
   • opal init no projeto
      → pergunta provider: [Claude Code] [Anthropic API] [Copy Prompt only]
      → configura chave se API
      → valida licença Opal

2. Uso diário
   $ npm run dev
   $ opal init
   → Proxy sobe em localhost:9200
   → Browser abre (redirecionado via proxy)

3. Edição
   → Entra em modo edição
   → Clica num elemento
   → Edita valores CSS visualmente (preview instantâneo)
   → Clica "Aplicar"

4. Aprovação
   → Spinner: "Planejando mudanças..."
   → Toast aparece (compacto se tudo OK, expandido se há side effects)
   → Dev clica "Aplicar"

5. Execução
   → Spinner: "Aplicando..."
   → Claude Code executa edições
   → Hot reload (~3-5s)

6. Verificação
   → 3 camadas de check rodam automaticamente
   → Se tudo ok: auto-commit silencioso
   → Se avisos: toast discreto no canto

7. Continuação
   → Edita próximo elemento
   → "Desfazer última edição" sempre disponível no menu
```

---

## 10. Limitações conhecidas (v3.2)

| Limitação | Impacto | Mitigação |
|-----------|---------|-----------|
| LLM pode editar arquivos além do planejado | Trade-off aceito | Git diff audit + auto-commit + revert 1-clique |
| Plan pode ser impreciso em projetos muito complexos | Toast mostra confidence, dev decide | Alternativas oferecidas em `recommended_action: 'consider_alternatives'` |
| Dois passos adicionam latência (~2-4s extras) | Aceitável | Modo express desliga toast para confidence=high no mesmo run |
| Custo por edição ~2x do v3 (plan + execute) | Sonnet: ~$0.02/edit | Aceitável; ainda barato; Free tier usa Copy Prompt |
| Scope check só detecta elementos visíveis | Edições em rotas não abertas não são verificadas | Aviso: "Verificação cobre apenas a rota atual" |
| Expo iOS/Android sem DOM | Não funciona | Só Expo Web |
| Edições em código gerado (types, build artifacts) | Pode confundir LLM | Detecção heurística + aviso |
| Hover/focus states | Só edita estado visível | Toggle de estados (v2 roadmap) |
| Auto-commit assume git limpo | Commits extras em work-in-progress | Baseline commit no `opal init` se tree sujo |

---

## 11. Observabilidade (do v3, com adições)

### Log de execuções

Cada Apply grava JSON em `~/.opal/history/<timestamp>.json`:

```json
{
  "timestamp": "2026-04-22T14:32:11Z",
  "project_root": "/home/dev/meu-projeto",
  "element": { "tag": "button", "file": "Hero.tsx:47" },
  "plan": {
    "summary": "Change button bg to black",
    "files_planned": ["Hero.tsx", "theme.css"],
    "confidence": "high",
    "side_effects_count": 1
  },
  "user_approved": true,
  "approval_mode": "toast",      // or "express" if skipped toast
  "execute": {
    "files_modified": ["Hero.tsx", "theme.css"],
    "files_extra": [],
    "duration_ms": 8320,
    "model": "claude-sonnet-4-6",
    "token_usage": { "input_total": 4120, "output_total": 890 }
  },
  "verification": {
    "visual_check": "pass",
    "scope_check": "pass",
    "diff_check": "pass_exact"
  },
  "git_commit": "a3f8e91",
  "status": "success"
}
```

Painel no app Tauri com "Histórico de edições" mostra isso em UI. Cada entrada: resumo, arquivos, botão "Reverter este commit" (faz `git revert` preservando commits posteriores).

### Rate limit local

Mantido do v3: 30 Applies/hora, 200/dia por default. Configurável. Contador visível no painel.

### Modo verbose + debug bundle

Mantido do v3.

---

## 12. Sessão Claude Code: isolada por default

**Mantido do v3**. Cada Apply inicia uma sessão isolada. `--continue` é opt-in pelos motivos do v3 (não poluir histórico interativo do dev). Adição pequena no v3.2: no plan step, `--continue` é ignorado mesmo se habilitado — plan é sempre sessão nova, pra não contaminar contexto com edições antigas do Opal.

---

## 13. Licenciamento e pricing

### Lemon Squeezy + JWT (mantido do v3)

### Pricing

| Plano | Preço | Inclui |
|-------|-------|--------|
| Free | $0 | 5 edições/dia via Copy Prompt (sem LLM API), 1 projeto, source maps, scope check |
| Pro | $19/mês | Edições ilimitadas, plan+execute via LLM (chave do dev), multi-projeto, auto-commit, suporte |
| Founder's Edition | $199 | Primeiros 100 usuários. Pro para sempre + 1 ano de updates. |

Mudanças vs v3:

- Free usa Copy Prompt por default (sem custo de LLM). Se dev quiser LLM integrada, ativa Pro.
- 5 edições/dia no Free é suficiente para testar e decidir. Copy Prompt funciona infinitamente como alternativa.
- Pro mantém modelo "dev traz chave da Anthropic". Transparência > margem.

### Custo real por edição (Pro)

Sonnet:
- Plan step: ~2k input + 400 output ≈ $0.009
- Execute step: ~3k input + 1.5k output ≈ $0.027
- **Total: ~$0.036 por Apply**

Opus (opt-in):
- Plan: ~$0.045
- Execute: ~$0.135
- **Total: ~$0.18 por Apply**

Dev típico fazendo 10 Applies/dia com Sonnet: ~$10/mês em API + $19/mês Opal = ~$29/mês total. Comparado ao v3 que exigia Max5 ($100) — barreira muito menor.

---

## 14. Segurança (resumo atualizado)

### Mantido do v3
- Proxy bind 127.0.0.1, validação Host/Origin, token WS challenge-response
- Sanitização XML + CDATA dos dados do DOM
- `spawn()` com args array, `shell: false`
- Auto-update Tauri com chave privada em GitHub Secrets
- `security.txt` + disclosure policy

### Novo no v3.2
- Plan step com allowlist sem `Edit` — salvaguarda estrutural contra edits antes de aprovação
- Execute step ocorre apenas após confirmação explícita do dev
- 3 camadas de verificação pós-execute
- Auto-commit por edição para revert trivial

### Removido vs v3
- Debate sobre `--dangerously-skip-permissions`: nunca usado
- Complexidade de detecção de sessão ativa: irrelevante porque sessões são sempre novas no plan
- Apply Engine com adapters (aposentado junto com v3.1): não existe

---

## 15. Testes

### Estratégia

Matriz de testes agora foca em:

1. **Validação do EditPlan schema**: Zod + property-based testing para variações de output da LLM.
2. **E2E por framework**: mesma matriz do v3 (Next 15/Turbopack, Vite 6, Vue 3, etc.) — mas agora cada teste verifica plan → toast → execute → 3 verifications → commit.
3. **Golden dataset**: repositório público `opal-test-corpus` com 50+ projetos reais. Cada commit Opal é verificado manualmente na primeira vez e vira snapshot. Regressões rodam contra snapshot.
4. **Testes de verificação**: simulações de scope leak, diff extras, visual divergence — todos testados em unit + integration.
5. **Testes de toast UX**: Playwright rodando cenários de aprovação/cancelamento, modo express, alternativas expandidas.

### Resultado não é binário, mas é observável

Ao contrário do v3.1 que prometia resultado binário (e mentia sobre isso na prática), o v3.2 é honesto: **testamos que o fluxo funciona, que a verificação detecta problemas, que o revert é trivial, e que a LLM tipicamente se comporta bem**. Onde a LLM surpreende positivamente (ajudas úteis), o teste registra. Onde surpreende negativamente (fora de escopo), o teste verifica que o dev foi avisado e pôde reverter.

Isso é testável, é CI-amigável, e é honesto sobre a natureza LLM-based do produto.

---

## 16. Roadmap pós-MVP

### P1 (primeiros 3 meses)

1. **Modo express melhorado**: aprender padrões do dev (que tipo de edit ele sempre aprova sem olhar) e oferecer auto-skip inteligente.
2. **MCP Server**: expor o Opal como MCP server. AI tools consomem plan/execute via protocolo padrão — abre para Cursor, Claude Desktop, Cline, etc.
3. **Alternatives expandidas**: quando `recommended_action: 'consider_alternatives'`, Opal pode gerar preview visual de cada alternativa antes do dev escolher.
4. **Integração Anthropic SDK** (se não for MVP default).
5. **Audit log visível**: painel completo com filtros, exportação, revert granular.

### P2 (3-6 meses)

6. Hover/focus/active states.
7. Breakpoints responsivos.
8. Batch de edições (multiple targets, single plan).
9. Extensão de browser como alternativa ao proxy (do review arquitetural).
10. Team licenses.

### P3

11. Modelos LLM locais (Ollama) via SDK com adapter próprio.
12. Edição de texto inline.
13. Drag-and-drop com preservação de JSX.

---

## 17. Decisões técnicas consolidadas

1. **LLM edita o código real** com acesso ao projeto inteiro — é a premissa central do produto.
2. **Dois passos obrigatórios**: plan (read-only) → toast de aprovação → execute (com edit permission).
3. **EditPlan como contrato tipado** entre LLM e Opal, validado com Zod.
4. **Toast leve, não diff review**: aprovação é rápida, detalhes sob demanda.
5. **Modo express opcional** para devs confortáveis com o loop.
6. **3 camadas de verificação pós-apply**: visual, scope, git diff.
7. **Auto-commit por edição**: revert é 1 clique, rastreável via `git log`.
8. **LLM pode fazer mais do que planejou**: aceito, visível, reversível. Não punido.
9. **Claude Code CLI como provider default**, Anthropic SDK como alternativa, Copy Prompt como fallback universal.
10. **Nunca `--dangerously-skip-permissions`**: tools positivamente listadas, plan sem Edit, execute com Edit restrito.
11. **Proxy Rust nativo, validação Host/Origin, WS challenge-response**: do v3.
12. **Lemon Squeezy + JWT**: do v3.
13. **Pricing**: Free com Copy Prompt, Pro $19 com chave do dev, Founder's $199 limitado.
14. **Threat model drasticamente reduzido vs v3** porque plan step estrutural + verificação multi-camada.
15. **Testes**: schema validation + E2E por framework + golden dataset + teste de fluxos UX.
16. **Observabilidade**: histórico JSON + painel visual + rate limit.
17. **Auto-update Tauri assinado**: do v3.
18. **Posicionamento honesto**: "AI edita com contexto do projeto, você aprova em um clique, verificamos o que ela fez."
19. **Aposentado com v3.1**: Apply Engine determinístico. Era a direção errada.
20. **MCP server como P1**: abre fluxo para outros AI tools de forma padrão.

---

## Apêndice — Evolução do planning

**v2** → plano original. AI edita, sem verificação forte, segurança com `--dangerously-skip-permissions` problemática.

**v3** → correções P0 de segurança, posicionamento, licenciamento. AI ainda editava sem aprovação prévia.

**v3.1** (aposentado) → tentou substituir AI por Apply Engine determinístico. Direção errada: tirava a capacidade mais útil da LLM (entender arquitetura do projeto). Adapters falhariam na maioria dos projetos reais.

**v3.2** (este documento) → AI edita com contexto completo como no v3, mas **em dois passos**: plan com aprovação, execute com verificação. Resolve o problema de escopo do v3 sem perder o valor da LLM. Toast leve mantém fricção mínima. 3 camadas de verificação dão confiança. Auto-commit torna revert trivial.

A arquitetura chegou onde precisava chegar. O próximo passo é codar.
