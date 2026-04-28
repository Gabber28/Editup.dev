# EditUp.dev — Documento de Planejamento MVP v2

## Arquitetura Core: Visual-First, Style-Agnostic

O EditUp.dev é um editor visual que lê o resultado visual final de qualquer elemento no browser do usuário, permite edição via controles no-code, e envia um snapshot visual preciso (antes → depois) para a AI aplicar no código fonte. O EditUp.dev não precisa saber como o estilo é implementado — a AI decide como traduzir valores CSS absolutos para a arquitetura de styling do projeto.

---

## Stack de desenvolvimento

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Desktop app | Tauri v2 + React + TypeScript | Leve (~7MB), acesso ao filesystem e terminal, stack que você domina |
| Proxy local | Node.js (`http-proxy`) embutido no Tauri | Framework-agnostic, injeta script em qualquer HTML |
| Script injetado | TypeScript vanilla (bundlado) | Roda no browser, captura DOM via getComputedStyle, comunica via WebSocket |
| Editor visual | React (dentro do Tauri) | Controles de edição CSS: color pickers, sliders, dropdowns |
| Source maps | Biblioteca `source-map` (Mozilla) | Parsing de source maps de Vite e Webpack/Turbopack |
| Licenciamento | Stripe + endpoint serverless (Vercel) | Simples, sem infra própria |
| Landing page | Next.js ou Framer + Tally (waitlist) | Rápido de montar |

---

## Clipboard 1: Fluxo do usuário

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DO USUÁRIO                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. INICIAR                                                 │
│     $ cd meu-projeto && npm run dev                         │
│     $ editup init                                             │
│     → EditUp.dev detecta dev server (qualquer porta)              │
│     → Verifica Claude Code CLI (instalado? sessão? modelo?) │
│     → Se sessão existe com Opus: ✓ conecta                  │
│     → Se modelo errado: ⚠️ pede para alterar                │
│     → Se sem sessão: abre Claude Code com Opus              │
│       → Proxy sobe em localhost:9200                          │
│       → Browser abre automaticamente
caso esteja sem sessão, deve abrir o claude code com o Opus dentro da pasta raiz do projeto
│                                                             │
│  2. SELECIONAR                                              │
│     → Caso tudo esteja certo ao iniciar: Entra em modo de edição altomaticamente                                               │
│     → Elemento selecionado ganham highlight ao hover        │
│     → Dev clica no botão "Comprar Agora"                    │
│     → Painel de camadas mostra:                             │
│       span "Comprar Agora"                                  │
│       button ← selecionado                                  │
│       div (container)                                       │
│       section (hero)                                        │
│                                                             │
│  3. EDITAR                                                  │
│     → Painel de propriedades abre à direita                 │
│     → Mostra valores CSS reais:                             │
│       Background: #ffffff  [color picker]                 │
│       Padding H:  16px     [slider]                         │
│       Radius:     8px      [slider]                         │
│     → Dev muda background para #000000                    │
│     → Preview instantâneo no browser                        │
│                                                             │
│  4. APLICAR                                                 │
│     → Dev clica "Aplicar com Claude Code"                   │
│     → EditUp.dev gera snapshot: antes (#fff) → depois (#000)      │
│     → Prompt contextualizado dispara no terminal            │
│     → Claude Code edita o arquivo fonte                     │
│     → Hot reload atualiza o browser (~3-5 seg)              │
│                                                             │
│  5. VERIFICAR                                               │
│     → EditUp.dev relê getComputedStyle do elemento                │
│     → Compara com snapshot esperado                         │
│     → ✓ Match: sucesso silencioso                           │
│     → ✗ Divergência: mostra quais propriedades              │
│       não bateram e oferece reenviar correção               │
│                                                             │
│  6. CONTINUAR                                               │
│     → Dev edita outro elemento (volta ao passo 2)           │
│     → Ou Ctrl+Shift+O para sair do modo edição              │
│     → Ctrl+C no terminal encerra o EditUp.dev                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Clipboard 2: Fluxo de trabalho do software

```
┌─────────────────────────────────────────────────────────────┐
│               FLUXO DE TRABALHO DO SOFTWARE                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐                                               │
│  │ editup init│                                               │
│  └────┬─────┘                                               │
│       │                                                     │
│       ▼                                                     │
│  ┌────────────────────────────────────┐                     │
│  │ 1. DETECÇÃO                        │                     │
│  │    Escaneia portas (3000-9200)      │                     │
│  │    Lê package.json → identifica:    │                     │
│  │    • Framework (Next/React/Vue/etc) │                     │
│  │    • Bundler (Vite/Webpack/Turbo)   │                     │
│  │    • Sistema de styling (qualquer)  │                     │
│  │    Verifica licença (Lemon Squeezy) │                     │
│  │    Verifica Claude Code:            │                     │
│  │    • CLI instalado?                 │                     │
│  │    • Sessão existente no diretório? │                     │
│  │    • Modelo = Opus?                 │                     │
│  │    • Se não: avisa ou abre nova     │                     │
│  └────────────┬───────────────────────┘                     │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────┐                     │
│  │ 2. PROXY                           │                     │
│  │    Sobe HTTP proxy (localhost:9200) │                     │
│  │    Repassa todo tráfego HTTP+WS     │                     │
│  │    Injeta <script> em respostas     │                     │
│  │    HTML (Content-Type: text/html)   │                     │
│  │    Abre browser automaticamente     │                     │
│  └────────────┬───────────────────────┘                     │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────┐                     │
│  │ 3. AGENTE NO BROWSER               │                     │
│  │    Script injetado conecta via WS   │                     │
│  │    Token de sessão para segurança   │                     │
│  │    Intercepta cliques (modo edição) │                     │
│  │    Para cada clique:                │                     │
│  │    • getComputedStyle() → valores   │                     │
│  │    • element.classList → classes     │                     │
│  │    • DOM tree → ancestrais          │                     │
│  │    • Source map → arquivo:linha      │                     │
│  │    Envia tudo via WS → app Tauri    │                     │
│  └────────────┬───────────────────────┘                     │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────┐                     │
│  │ 4. EDITOR VISUAL (App Tauri)       │                     │
│  │    Recebe dados do agente           │                     │
│  │    Mostra valores CSS reais:        │                     │
│  │    • Cores → color pickers          │                     │
│  │    • Tamanhos → sliders (px)        │                     │
│  │    • Layout → botões visuais        │                     │
│  │    Cada mudança do usuário:         │                     │
│  │    → WS → agente → element.style    │                     │
│  │    → Preview instantâneo no browser │                     │
│  │    Armazena estado ANTES e DEPOIS   │                     │
│  └────────────┬───────────────────────┘                     │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────┐                     │
│  │ 5. GERADOR DE PROMPT               │                     │
│  │    Calcula diff: ANTES → DEPOIS     │                     │
│  │    Só propriedades que mudaram      │                     │
│  │    Monta prompt com:                │                     │
│  │    • Valores CSS absolutos (px/hex) │                     │
│  │    • Arquivo fonte + linha          │                     │
│  │    • Classes atuais no DOM          │                     │
│  │    • Texto do elemento              │                     │
│  │    • Framework detectado            │                     │
│  │    • Instrução restritiva           │                     │
│  └────────────┬───────────────────────┘                     │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────┐                     │
│  │ 6. EXECUÇÃO (Claude Code)         │                     │
│  │    Se sessão existente:            │                     │
│  │      claude --continue -p "prompt" │                     │
│  │      --model claude-opus-4-6       │                     │
│  │      --dangerously-skip-permissions│                     │
│  │    Se sem sessão:                  │                     │
│  │      claude -p "prompt"            │                     │
│  │      --model claude-opus-4-6       │                     │
│  │      --dangerously-skip-permissions│                     │
│  │    Claude Code:                     │                     │
│  │    • Retoma contexto da sessão     │                     │
│  │    • Encontra o arquivo/componente  │                     │
│  │    • Decide COMO aplicar:           │                     │
│  │      - Tailwind? Troca classes      │                     │
│  │      - CSS file? Edita propriedade  │                     │
│  │      - Styled-comp? Edita template  │                     │
│  │      - CSS Modules? Edita .module   │                     │
│  │      - Tokens? Edita theme          │                     │
│  │    • Salva o arquivo                │                     │
│  └────────────┬───────────────────────┘                     │
│               │                                             │
│               ▼                                             │
│  ┌────────────────────────────────────┐                     │
│  │ 7. VERIFICAÇÃO                     │                     │
│  │    Hot reload atualiza o browser    │                     │
│  │    Agente relê getComputedStyle     │                     │
│  │    Compara com snapshot DEPOIS      │                     │
│  │    Se divergência > threshold:      │                     │
│  │    → Gera prompt corretivo          │                     │
│  │    → Reenvia para Claude Code       │                     │
│  │    → Loop até match ou max 2 tries  │                     │
│  └────────────────────────────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tópico 1: Como o software captura, edita e envia para a AI

### Captura (leitura universal)

O EditUp.dev captura o estado visual de qualquer elemento usando `getComputedStyle()`, uma API nativa do browser que retorna todos os valores CSS resolvidos em unidades absolutas. Não importa se o estilo veio de Tailwind, CSS Modules, styled-components, um arquivo CSS separado, variáveis CSS, herança, ou browser defaults — o `getComputedStyle()` retorna o resultado visual final.

Para um botão com `class="btn-primary"` onde `.btn-primary` está definido num arquivo CSS separado, o EditUp.dev lê:

```
background-color: rgb(255, 255, 255)   → #ffffff
padding: 8px 16px 8px 16px
border-radius: 8px
font-size: 16px
font-weight: 500
color: rgb(17, 17, 17)                 → #111111
box-shadow: rgba(0,0,0,0.1) 0px 1px 3px 0px
```

Para um botão com `className="bg-white px-4 py-2 rounded-lg"`, o EditUp.dev lê exatamente os mesmos tipos de valores. A fonte do estilo é invisível para o EditUp.dev — ele só vê o resultado visual.

Adicionalmente, o agente captura o contexto do elemento:
- Classes presentes no DOM (`class` ou `className`): "btn-primary", "bg-white px-4", "sc-bdnxRM", ou qualquer outra
- Seletor DOM completo: `section.hero > div.cta-wrapper > button:first-child`
- Texto visível: "Comprar Agora"
- Arquivo e linha do código fonte (via source map, quando disponível): `src/components/Hero.tsx:47`
- Nome do componente React/Vue (quando source map disponível): `HeroButton`

### Edição (preview visual)

O editor mostra os valores CSS reais com controles visuais (color pickers, sliders, dropdowns). Quando o usuário altera uma propriedade, o agente no browser aplica um override via `element.style` — CSS inline temporário que não toca em nenhum arquivo. O preview é instantâneo.

O `element.style` tem a especificidade mais alta do CSS (exceto `!important`), então ele sempre funciona como override visual, independente de como o estilo original foi definido. Quando a edição é aplicada e o hot reload acontece, o override temporário é removido automaticamente.

### Envio para a AI (snapshot comparativo)

Quando o usuário clica "Aplicar", o EditUp.dev gera um **snapshot comparativo** contendo apenas as propriedades que mudaram:

```
EDITUP EDIT — snapshot

Elemento: <button> com texto "Comprar Agora"
Arquivo fonte: src/components/Hero.tsx, linha 47
Componente: HeroButton
Classes no DOM: "btn-primary"
Seletor: section.hero > div > button:first-child
Framework: Next.js (detectado via package.json)

MUDANÇAS:
  background-color: #ffffff → #000000
  color: (não definido inline) → #ffffff
  padding-left: 16px → 24px
  padding-right: 16px → 24px
  box-shadow: none → 0 10px 15px -3px rgba(0,0,0,0.1)

ESTADO VISUAL FINAL ESPERADO:
  background-color: #000000
  color: #ffffff
  padding: 8px 24px
  border-radius: 8px
  font-size: 16px
  font-weight: 500
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1)

INSTRUÇÃO:
Aplique essas mudanças visuais respeitando a arquitetura de
styling existente no projeto. Se o estilo vem de classes
Tailwind, atualize as classes. Se vem de CSS customizado,
edite o arquivo CSS correspondente. Se vem de styled-components
ou CSS Modules, edite a definição correspondente.
Altere apenas este elemento. Não modifique nenhum outro
componente, arquivo, ou elemento.
```

O EditUp.dev dispara via `child_process.exec()` no terminal do usuário, usando o comando correto do Claude Code CLI:

```bash
# Se existe sessão prévia do dev neste diretório:
claude --continue -p "prompt completo" --model claude-opus-4-6 --dangerously-skip-permissions

# Se não existe sessão prévia:
claude -p "prompt completo" --model claude-opus-4-6 --dangerously-skip-permissions
```

**Flags explicadas:**
- `--continue` (`-c`): retoma a sessão mais recente do dev naquele diretório. Toda a história de mensagens, arquivos lidos, e decisões anteriores são restaurados. As edições do EditUp.dev ficam no histórico da sessão do dev.
- `-p`: modo headless — executa o prompt e sai sem interface interativa.
- `--model claude-opus-4-6`: força o uso do Opus 4.6 independente da configuração do dev.
- `--dangerously-skip-permissions`: pula confirmações de permissão que travariam a execução não-interativa.

O Claude Code recebe o prompt com todo o contexto da sessão existente, entende a arquitetura de styling, e aplica a mudança no lugar certo.

### Verificação pós-aplicação

Após o hot reload, o agente relê `getComputedStyle()` do elemento e compara com o "ESTADO VISUAL FINAL ESPERADO" do snapshot. Se houver divergência significativa (threshold configurável, ex: diferença > 2px em dimensões ou diferença > 5 em valor de cor RGB), o EditUp.dev pode reenviar um prompt corretivo automático ou mostrar o diff ao usuário. Máximo 2 tentativas de correção automática.

---

## Tópico 2: Fluxo do usuário

### Instalação (uma vez)

1. O usuário instala o EditUp.dev via `npm install -g editup-editor` (ou download direto do site).
2. Nenhuma extensão de browser é necessária.
3. Nenhuma dependência de styling (como Tailwind) é necessária — o EditUp.dev funciona com qualquer projeto.
4. **Requisito: Claude Code CLI instalado** (`npm install -g @anthropic-ai/claude-code`) com plano que inclua acesso ao Opus (Max ou API).

### Uso diário

```
1. Abre o projeto normalmente
   $ cd meu-projeto && npm run dev
   → Dev server sobe em localhost:3000

2. Inicia o EditUp.dev
   $ editup init
   → "Detectei dev server em localhost:3000 (Next.js / Vite)"
   → Verificando Claude Code...

   CENÁRIO A — Sessão existe com Opus 4.6:
   → "✓ Claude Code: sessão ativa com Opus 4.6"
   → "Proxy EditUp.dev em localhost:9200"
   → "Abrindo browser..."

   CENÁRIO B — Sessão existe com modelo errado:
   → "⚠️ Claude Code: sessão ativa com Sonnet 4.6"
   → "O EditUp.dev requer Opus 4.6 para garantir edições precisas."
   → "No seu terminal do Claude Code:"
   → "  1. Digite /model e selecione claude-opus-4-6"
   → "  2. Confirme com Enter"
   → "[Verificar novamente]  [Sair]"

   CENÁRIO C — Claude Code não instalado:
   → "✗ Claude Code CLI não encontrado."
   → "Instale com: npm install -g @anthropic-ai/claude-code"
   → "[Verificar novamente]  [Sair]"

   CENÁRIO D — Sem sessão mas Claude Code instalado:
   → "Nenhuma sessão Claude Code encontrada para este projeto."
   → "O EditUp.dev abrirá uma nova sessão com Opus 4.6."
   → "Proxy EditUp.dev em localhost:9200"
   → "Abrindo browser..."

3. Entra no modo edição
   → Pressiona Ctrl+Shift+O (ou clica no ícone flutuante do EditUp.dev)
   → Elementos ganham highlight ao passar o mouse
   → Tooltip mostra tag + componente: "button · HeroButton"

4. Seleciona um elemento
   → Clica no botão "Comprar Agora"
   → Painel do EditUp.dev abre (overlay no browser, lado direito)
   → Barra de camadas no topo:
     span "Comprar Agora" → button ← selecionado → div → section

5. Edita visualmente
   → Seção "Cores": muda background #ffffff → #000000 (preview instantâneo)
   → Seção "Espaçamento": padding horizontal 16px → 24px (preview instantâneo)
   → Seção "Bordas": adiciona box-shadow via preset (preview instantâneo)
   → Vê o resultado ao vivo no browser a cada mudança

6. Aplica
   → Clica "Aplicar com Claude Code"
   → Indicador "Gerando prompt..." → "Enviando..." → "Aplicando..."
   → Claude Code retoma a sessão (--continue) com Opus 4.6
   → Hot reload atualiza o browser (~3-5 segundos)
   → Verificação automática: ✓ Visual confere

7. Continua editando ou sai
   → Pode editar outro elemento imediatamente (volta ao passo 3)
   → Ctrl+Shift+O para sair do modo edição
   → Ctrl+C no terminal encerra o EditUp.dev e o proxy
```

### Detecção automática de porta

O EditUp.dev escaneia portas comuns: 3000, 3001, 4200, 5173, 5174, 8080, 8000, 19006 (Expo Web). Se não encontrar:

```
$ editup init
→ Não encontrei um dev server ativo. Em qual porta está rodando? _
```

Ou: `editup init --port 4200`.

### Frameworks suportados no MVP

| Framework | Bundler | Detecção | Status |
|-----------|---------|----------|--------|
| React (Vite) | Vite | `vite` em package.json | ✅ Funciona |
| Next.js | Webpack/Turbopack | `next` em package.json | ✅ Funciona |
| Vue.js (Vite) | Vite | `vue` em package.json | ✅ Funciona |
| Nuxt | Vite | `nuxt` em package.json | ✅ Funciona |
| Expo Web | Metro | `expo` em package.json | ✅ Funciona (modo web) |
| JS/HTML vanilla | Qualquer | Fallback | ✅ Funciona |
| Expo iOS/Android | Metro | — | ❌ Sem DOM, não funciona |

---

## Tópico 3: Ferramentas de edição e sistema de camadas

### Sistema de camadas

Quando o usuário clica num elemento, o agente percorre o DOM de dentro pra fora e envia a árvore de ancestrais para o app Tauri. O painel mostra uma barra horizontal de chips clicáveis:

```
span "Comprar" → button ← selecionado → div.cta → section.hero
```

Cada chip mostra:
- Tag HTML: `button`, `div`, `section`
- Nome do componente (se source map disponível): `HeroButton`, `Layout`
- Highlight visual no browser ao hover sobre o chip

O dev clica em qualquer chip para mudar a seleção. O painel de propriedades atualiza instantaneamente.

### Ferramentas de edição

O editor mostra **valores CSS reais** em todos os controles. Os painéis são organizados em seções colapsáveis, inspiradas no Properties Panel do FlutterFlow:

**Seção: Espaçamento**

[IMAGEM: Box model interativo com 4 inputs de margin e 4 de padding]

- Box model visual interativo: retângulo central (elemento) com áreas de margin (externo) e padding (interno)
- Cada lado tem campo numérico editável diretamente (em px)
- Toggle para sincronizar lados (editar todos de uma vez)
- Slider de gap (para containers flex/grid)

**Seção: Cores**

[IMAGEM: Color picker com swatch da cor atual + campo hex + paleta]

- Três sub-seções: Background, Text Color, Border Color
- Cada uma mostra: swatch da cor atual, campo hex editável
- Color picker livre com eyedropper
- Slider de opacidade separado

**Seção: Tipografia**

[IMAGEM: Dropdown de font-size, seletor de weight, botões de alinhamento]

- Font size: slider + campo numérico (em px)
- Font weight: seletor visual (100 a 900)
- Text align: 4 botões com ícones (left, center, right, justify)
- Line height: slider + campo numérico (em px ou multiplicador)
- Letter spacing: slider + campo numérico
- Text transform: botões (normal, uppercase, lowercase, capitalize)
- Text decoration: botões (none, underline, line-through)

**Seção: Bordas e Sombras**

[IMAGEM: Slider de border-radius, presets de box-shadow]

- Border radius: slider visual com preview em tempo real (0px a 50%+)
- Border width: slider (0 a 8px)
- Border style: dropdown (solid, dashed, dotted, none)
- Border color: color picker
- Box shadow: presets visuais (none, sm, md, lg, xl) como cards clicáveis com preview
- Box shadow customizado: inputs de offset-x, offset-y, blur, spread, color

**Seção: Layout**

[IMAGEM: Toggle de display, botões visuais de flex direction e align]

- Display: toggle segmentado (block, flex, grid, inline, hidden)
- Flex controls (aparecem quando display=flex): direction, justify, align, wrap, gap
- Grid controls (aparecem quando display=grid): columns, gap
- Width/Height: campos numéricos + unidade (px, %, vh, vw, auto)
- Overflow: dropdown (visible, hidden, scroll, auto)
- Position: dropdown (static, relative, absolute, fixed, sticky)

**Seção: Efeitos**

[IMAGEM: Toggle de hover state, slider de opacidade, dropdown de transition]

- Toggle "Editando hover state": quando ativo, edições são prefixadas como hover styles no prompt
- Opacidade: slider (0 a 100%)
- Transition: dropdown de duration (0 a 1000ms)
- Transition easing: dropdown (ease, ease-in, ease-out, ease-in-out, linear)
- Cursor: dropdown visual com ícones
- Transform: sliders para rotate (0-360°) e scale (0.1x-3x)

### Como funciona tecnicamente

1. Agente no browser lê `getComputedStyle(element)` → extrai ~30 propriedades relevantes (não as 300+ que existem — apenas as que o editor mostra)
2. Envia via WebSocket para o app Tauri
3. Editor React renderiza os controles com valores pré-preenchidos
4. Cada mudança do usuário: Tauri → WS → agente → `element.style.propriedade = valor` → preview instantâneo
5. App Tauri armazena estado ANTES (leitura inicial) e DEPOIS (última edição)
6. "Aplicar" calcula o diff e gera o prompt

---

## Tópico 4: Gateway de pagamento e licenciamento

### Provedor

**Lemon Squeezy**: gerencia licenças nativamente (license keys com ativação/desativação por máquina), suporta subscription e one-time payment, lida com tax/VAT automaticamente, API simples. Custo: 5% + $0.50 por transação.

### Fluxo de verificação

```
editup init
  → Lê license key de ~/.editup/license
  → Se não existe → "Insira sua key ou crie conta em editup.dev"
  → Se existe → Verifica contra API (HTTPS)
  → Válida → Salva timestamp → Inicia
  → Inválida → "Licença expirada. Renove em editup.dev"
```

Verificação periódica a cada 24h. Grace period de 7 dias offline (timestamp criptografado com hardware ID). Máximo 2 máquinas por licença (rate limiting do Lemon Squeezy).

### Precificação

| Plano | Preço | Inclui |
|-------|-------|--------|
| Free | $0 | 5 edições/dia, 1 projeto, sem source map |
| Pro | $19/mês | Ilimitado, source map adapters, suporte |
| Lifetime | $199 | Tudo do Pro, para sempre, updates por 1 ano |

---

## Tópico 5: Segurança

### Zero código sai da máquina

- Proxy HTTP: localhost → localhost (127.0.0.1, nunca 0.0.0.0)
- Script injetado: roda no browser do usuário, contexto localhost
- Source map parsing: local
- Geração do prompt: local
- Execução do prompt: via stdin do processo local (`claude "..."`)
- **O EditUp.dev não tem servidor que recebe, armazena, ou processa código do usuário**

### WebSocket seguro

- Token de sessão UUID v4 gerado no `editup init`
- Script injetado usa o token para conectar via WS
- Conexões sem token são rejeitadas

### Zero telemetria de código

O que transita pela rede: apenas a license key (HTTPS) para verificação.

O que NÃO transita: código fonte, nomes de arquivos, conteúdo de prompts, source maps, estrutura DOM, valores CSS.

Analytics de uso (edições/sessão, painéis mais usados): 100% opt-in, sem dados de código.

### Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Script injetado manipulado | Validação de origem via token de sessão |
| Proxy acessível na rede local | Bind explícito em 127.0.0.1 |
| License key em plaintext | Criptografia com hardware ID |
| Prompt contém info do código | Execução local, mesmo risco do Claude Code manual |

---

## Tópico 6: Mercado

### Concorrentes diretos

**Inspector** — o mais próximo. Editor visual que conecta com Claude Code, Codex e Cursor. Edita texto, move elementos em apps React/Next/Vite. Só macOS, funciona como browser separado.

Gaps vs EditUp.dev: só macOS (EditUp.dev: cross-platform), browser separado (EditUp.dev: browser do dev), foco em mover/texto (EditUp.dev: editor completo de propriedades CSS), não tem verificação pós-aplicação.

**Cursor Design Mode** — feature dentro do Cursor. Ajustes visuais no browser + agent aplica no código. Lock-in no Cursor. Reviews reportam: confunde estados, cria componentes duplicados, não entende design systems.

Gaps vs EditUp.dev: lock-in (EditUp.dev: AI-agnostic), sem editor estruturado de propriedades, sem sistema de camadas.

### Concorrentes adjacentes

**Pencil.dev** — canvas vetorial dentro do IDE, gera código a partir de designs novos via MCP. Fluxo oposto: design → código. EditUp.dev faz código existente → edição visual → AI aplica.

**Tempo** — IDE visual browser-based, gera apps React completas. Plataforma fechada que substitui o workflow. EditUp.dev complementa qualquer workflow.

**CSS Pro / Inspecta / UI Inspector** — extensões de browser que editam CSS e exportam código/prompts. Desconectadas do codebase, sem integração automática com AI, requer copiar/colar manual.

### Posicionamento

O EditUp.dev é a única ferramenta que: opera no browser do dev (sem app separado), funciona com qualquer sistema de styling (não apenas Tailwind), lê valores CSS reais via getComputedStyle, gera prompts com snapshot visual absoluto, integra diretamente com AI coding tools, e verifica o resultado automaticamente.

### Demanda

Sinais: CSS Pro adicionou "Copy prompt for LLM", Inspector tem tração, VS Code 1.110 adicionou browser integration para AI agents, Cursor adicionou Design Mode. O espaço de edição visual + AI está sendo validado por múltiplos players.

Risco: Cursor, VS Code e IDEs podem absorver essa funcionalidade. Vantagem do EditUp.dev: AI-agnostic, framework-agnostic, style-agnostic.

---

## Tópico 7: Landing page e validação

### Landing page

**Headline:** "Edit your frontend visually. AI applies it to your code."

**Sub-headline:** "EditUp.dev reads your live site, lets you edit any element with visual controls, and sends precise instructions to your AI coding tool. No extensions. Any framework. Any CSS approach."

**GIF/Vídeo de 15 segundos** (mockado):
1. Dev roda `editup init` no terminal
2. Browser abre com o projeto
3. Dev clica num botão, painel abre mostrando valores CSS reais
4. Muda a cor via color picker, vê preview ao vivo
5. Clica "Aplicar", hot reload mostra resultado
6. Verificação: ✓ match

**Waitlist** (Tally embed, 2 perguntas):
1. "Qual AI coding tool você usa?" (Claude Code / Cursor / Copilot / Windsurf / Outro)
2. "Como você lida com ajustes visuais no frontend hoje?" (campo aberto)

### Distribuição

Reddit: r/webdev, r/reactjs, r/nextjs, r/vuejs, r/ClaudeAI, r/SideProject
Twitter/X: threads com GIF, #vibecoding, #devtools
Hacker News: "Show HN: Visual editor for localhost that sends changes to Claude Code"
Product Hunt: para o lançamento da waitlist

### Métricas de validação

| Métrica | Threshold "vai" | Threshold "reavalia" |
|---------|-----------------|---------------------|
| Signups (2-3 semanas) | 100+ | <50 |
| Respostas indicando dor real | 20+ | <10 |
| DMs/emails perguntando quando lança | 5+ | 0 |
| Engajamento em posts | Perguntas substantivas | Silêncio |

Timeline: sinal positivo → PoC (proxy+DOM) em 1-2 semanas → MVP em 4-6 semanas → primeiros pagantes.

---

## Tópico 8: Construção visual do editor

### Layout do editor

O editor aparece como painel lateral overlay no browser (lado direito) quando o dev seleciona um elemento. Três áreas:

**Área 1 — Barra de camadas (topo)**

[IMAGEM: Breadcrumb horizontal mostrando hierarquia: section > div > button > span, cada item clicável]

Chips clicáveis mostrando: tag HTML, nome do componente (se disponível), highlight visual no browser ao hover.

**Área 2 — Painel de propriedades (corpo)**

[IMAGEM: Seções colapsáveis para Espaçamento, Cores, Tipografia, Bordas, Layout, Efeitos]

Todas as seções descritas no Tópico 3, com controles mostrando **valores CSS reais** (não classes Tailwind ou nomes de classes). Exemplos:
- Background mostra `#ffffff` com color picker, não `bg-white`
- Padding mostra `16px` com slider, não `p-4`
- Font-size mostra `16px` com slider, não `text-base`

**Área 3 — Barra de ações (rodapé)**

[IMAGEM: Indicador "3 propriedades alteradas" + botão Resetar + botão Aplicar]

- Contador de propriedades alteradas
- Botão "Resetar" (desfaz preview, volta ao estado original)
- Botão "Aplicar com Claude Code" (primário, destaque visual)

### Interação no browser

[IMAGEM: Hover com outline azul e tooltip "button · HeroButton"]

- Hover: outline azul semi-transparente + tooltip com tag e componente
- Seleção: outline sólido + handles de resize nos cantos
- Preview: mudanças visuais instantâneas a cada interação no editor

[IMAGEM: Antes/depois — split view mostrando a mudança em tempo real]

### Responsividade

Toggle de breakpoint no topo do painel: `base | sm | md | lg | xl | 2xl`. Ao selecionar um breakpoint, o viewport do browser redimensiona para simular. Edições nesse modo geram instrução no prompt para que a AI aplique a mudança apenas naquele breakpoint (ex: "aplique esta mudança apenas para viewport ≥ 768px").

### O que NÃO vai no MVP

- Sem drag-and-drop de elementos (muda estrutura JSX — complexidade alta)
- Sem edição de texto inline (mapping bidirecional complexo)
- Sem criação de novos elementos (apenas edição de existentes)
- Sem animações CSS complexas (@keyframes)
- Sem edição de pseudo-elementos (::before, ::after)

Funcionalidades para v2/v3, adicionadas incrementalmente.

---

## Tópico 9: Integração com o Claude Code CLI

### Requisitos do usuário

Para usar o EditUp.dev, o dev precisa ter:
- Claude Code CLI instalado (`npm install -g @anthropic-ai/claude-code`)
- Plano que inclua acesso ao Opus 4.6 (Max5 a $100/mês, Max20 a $200/mês, ou API com créditos)
- Nota: o plano Pro ($20/mês) tem acesso limitado ao Opus — pode não ser suficiente para uso intensivo com o EditUp.dev

### Verificação no `editup init`

O EditUp.dev executa uma sequência de verificações antes de iniciar:

```
1. Claude Code CLI está instalado?
   → Verifica: which claude (Unix) ou where claude (Windows)
   → Se não: mostra erro com link de instalação, bloqueia

2. Existe sessão do Claude Code para este diretório?
   → Lê: ~/.claude/projects/[hash-do-diretório]/
   → Procura a sessão mais recente no index

3. Qual modelo está configurado na sessão?
   → Lê metadados da sessão (arquivos JSONL)
   → Extrai o campo de modelo usado

4. O modelo é Opus 4.6?
   → Se sim: prossegue normalmente
   → Se não: mostra aviso na UI do EditUp.dev com instruções
```

### Cenários de verificação e ações

**Sessão existe + Opus 4.6:** o EditUp.dev prossegue. Ao aplicar edições, usa `claude --continue -p "prompt" --model claude-opus-4-6 --dangerously-skip-permissions`. O `--continue` conecta à sessão existente, preservando todo o contexto. O `--model claude-opus-4-6` garante Opus mesmo que a sessão original usasse outro modelo.

**Sessão existe + outro modelo (Sonnet/Haiku):** o EditUp.dev mostra na interface:

```
┌──────────────────────────────────────────────────┐
│  ⚠️  Modelo incorreto detectado                  │
│                                                    │
│  Sua sessão do Claude Code está usando             │
│  Sonnet 4.6. O EditUp.dev requer Opus 4.6               │
│  para garantir que as edições visuais              │
│  sejam aplicadas com precisão.                     │
│                                                    │
│  No seu terminal do Claude Code:                   │
│  → Digite /model                                   │
│  → Selecione claude-opus-4-6                       │
│                                                    │
│  [Verificar novamente]    [Sair]                   │
└──────────────────────────────────────────────────┘
```

O EditUp.dev bloqueia o botão "Aplicar" até que o modelo seja verificado como Opus 4.6. Isso evita edições com modelos menos capazes que poderiam aplicar incorretamente.

**Sem sessão + Claude Code instalado:** o EditUp.dev informa que abrirá uma sessão nova e usa `claude -p "prompt" --model claude-opus-4-6 --dangerously-skip-permissions` (sem `--continue`). Essa primeira execução cria uma sessão que será reutilizada nas edições seguintes via `--continue`.

**Claude Code não instalado:** o EditUp.dev mostra erro e bloqueia:

```
┌──────────────────────────────────────────────────┐
│  ✗ Claude Code CLI não encontrado                 │
│                                                    │
│  O EditUp.dev utiliza o Claude Code para aplicar as     │
│  edições visuais no seu código. Instale com:       │
│                                                    │
│  npm install -g @anthropic-ai/claude-code           │
│                                                    │
│  Após instalar, autentique com:                    │
│  claude login                                       │
│                                                    │
│  [Verificar novamente]    [Sair]                   │
└──────────────────────────────────────────────────┘
```

### Como o EditUp.dev se comunica com o Claude Code

O EditUp.dev usa `child_process.exec()` do Node.js (dentro do Tauri) para executar comandos no terminal do sistema operacional. O fluxo para cada "Aplicar":

```javascript
// Pseudocódigo do módulo de execução
async function applyEdit(snapshot, hasExistingSession) {
  const prompt = generatePrompt(snapshot);
  const baseCmd = 'claude';
  const flags = [
    '-p', `"${prompt}"`,
    '--model', 'claude-opus-4-6',
    '--dangerously-skip-permissions',
    '--output-format', 'json'
  ];

  if (hasExistingSession) {
    flags.unshift('--continue');
  }

  const result = await exec(`${baseCmd} ${flags.join(' ')}`);
  return parseResult(result);
}
```

O `--output-format json` permite ao EditUp.dev parsear a resposta do Claude Code e verificar se a edição foi bem-sucedida antes mesmo do hot reload.

### Continuidade de sessão

Quando o EditUp.dev usa `--continue`, as edições ficam registradas na sessão do dev. Isso significa que:
- Se o dev voltar ao Claude Code interativo, ele pode ver todas as edições que o EditUp.dev fez
- Se o dev pedir "reverte a última mudança", o Claude Code sabe do que se trata
- O contexto acumulado (arquivos lidos, decisões de arquitetura) é preservado entre edições do EditUp.dev
- O consumo de tokens é otimizado porque o Claude Code não relê o codebase inteiro a cada edição

### Nível de esforço (effort level)

O Claude Code tem configurações de effort level (low/medium/high) que controlam quanto raciocínio a AI dedica a cada tarefa. A partir de março de 2026, o padrão para Opus 4.6 é medium.

Limitação: não existe flag CLI para forçar effort level `high` em modo headless (`-p`). O nível de esforço é uma configuração da sessão interativa.

Solução adotada: o EditUp.dev compensa isso de duas formas:
1. O prompt inclui instrução explícita de máxima atenção: "Execute esta tarefa com máximo nível de detalhe. Analise cuidadosamente a arquitetura de styling do projeto antes de fazer qualquer alteração."
2. O loop de verificação pós-aplicação (relê getComputedStyle, compara, corrige) garante que o resultado visual seja preciso independente do effort level.

Na prática, para edições CSS pontuais (que é o caso do EditUp.dev), a diferença entre medium e high é mínima — o Opus 4.6 já é capaz de executar corretamente. O loop de verificação é a garantia real.

### Otimização de custo: batch de edições

Cada "Aplicar" dispara uma chamada ao Claude Code. Para devs fazendo muitas edições rápidas, isso pode consumir tokens rapidamente.

Opção futura (v2): botão "Aplicar tudo" que acumula múltiplas edições numa sessão e envia num único prompt batch:

```
EDITUP BATCH — 5 edições

Edição 1: Botão "Comprar" (Hero.tsx:47)
  background-color: #ffffff → #000000
  color: → #ffffff

Edição 2: Título "Bem-vindo" (Hero.tsx:12)
  font-size: 32px → 40px
  
Edição 3: Card de produto (ProductCard.tsx:8)
  border-radius: 4px → 12px
  box-shadow: none → 0 4px 6px rgba(0,0,0,0.1)

[...etc]

Aplique todas as edições acima respeitando a arquitetura
de styling do projeto. Para cada edição, identifique o
elemento e aplique a mudança no local correto.
```

Isso reduz chamadas de 5 para 1, otimizando tanto tokens quanto tempo.

### Conflito de sessão: Claude Code ativo no terminal

Se o dev tem o Claude Code aberto e ativo no terminal (processando uma tarefa), e o EditUp.dev tenta disparar `--continue -p`, pode haver conflito de lock de sessão.

Mitigação: antes de disparar, o EditUp.dev verifica se existe um processo `claude` ativo via `ps aux | grep claude` (Unix) ou equivalente. Se houver:

```
┌──────────────────────────────────────────────────┐
│  ⏳ Claude Code em uso                            │
│                                                    │
│  Há uma sessão ativa do Claude Code no             │
│  terminal. Aguarde a conclusão da tarefa           │
│  atual antes de aplicar edições.                   │
│                                                    │
│  [Tentar novamente]    [Cancelar]                  │
└──────────────────────────────────────────────────┘
```

---

## Análise de compatibilidade e limitações conhecidas

### Problemas resolvidos pela arquitetura visual-first

| Cenário | Por que funciona |
|---------|-----------------|
| Estilos em arquivo CSS separado | getComputedStyle lê o resultado final; AI edita o arquivo CSS |
| Styled-components / Emotion | getComputedStyle lê o resultado; AI edita o styled component |
| Design system tokens (Chakra, MUI) | getComputedStyle resolve tokens; AI edita props ou theme |
| CSS Modules (hashes no DOM) | getComputedStyle ignora hashes; AI edita o .module.css |
| Variáveis CSS | getComputedStyle resolve variáveis; AI edita o var ou valor |
| Conflitos de especificidade | EditUp.dev não adiciona classes; AI aplica no lugar certo |
| Projetos sem Tailwind | Tailwind não é requisito; editor usa valores CSS puros |
| Projetos com Tailwind | AI detecta e usa classes Tailwind para aplicar |
| Projetos híbridos | AI entende a arquitetura e decide a melhor abordagem |
| Multi-framework | Prompt inclui framework detectado; AI adapta |

### Limitações conhecidas

| Limitação | Impacto | Mitigação |
|-----------|---------|-----------|
| Estilos condicionais (ternários, clsx) | AI pode editar apenas o estado renderizado | Hint no prompt: "preserve lógica condicional" |
| Expo iOS/Android (sem DOM) | Não funciona | Declarar: só Expo Web |
| Proxy vs OAuth/CORS/Service Workers | Pode quebrar em minoria de projetos | Fallback: extensão opcional |
| Fidelidade pixel-perfect | AI pode arredondar valores | Loop de verificação corrige |
| Hover/focus/active states | Só edita estado visível | Toggle de estados (v2) |
| Effort level não forçável via CLI | Medium em vez de High | Prompt instrui máxima atenção + loop de verificação |
| Custo de tokens por edição | Cada "Aplicar" consome tokens do plano do dev | --continue reduz releitura; batch (v2) otimiza |
| Conflito de sessão ativa | Claude Code pode travar se 2 processos simultaneos | Detecção de processo ativo + aviso ao dev |
| Plano Pro tem Opus limitado | Dev pode não ter acesso suficiente ao Opus | Documentação clara: requer Max5+ ou API |

---

## Resumo de decisões técnicas consolidadas

1. **Visual-first, style-agnostic** — lê via getComputedStyle, não depende de nenhum framework CSS
2. **Proxy local** — zero extensões, zero atrito
3. **Framework-agnostic** — detecta Next, React, Vue, Nuxt, Expo Web, JS vanilla
4. **Adaptadores de source map** — Vite + Webpack/Turbopack; genérico como fallback
5. **Editor CSS puro** — mostra valores absolutos (px, hex), não classes
6. **Snapshot comparativo** — diff ANTES → DEPOIS em valores CSS absolutos
7. **AI decide a implementação** — o EditUp.dev diz O QUE mudar, a AI decide COMO
8. **Verificação pós-aplicação** — relê getComputedStyle e compara com snapshot
9. **Loop de correção** — até 2 reenvios automáticos se houver divergência
10. **Claude Code CLI com `--continue`** — retoma sessão existente do dev, preserva contexto
11. **Opus 4.6 obrigatório** — verificação no `editup init`, bloqueia se modelo incorreto
12. **Flags corretas** — `claude --continue -p "prompt" --model claude-opus-4-6 --dangerously-skip-permissions`
13. **Verificação de Claude Code ativo** — detecta conflito de sessão antes de disparar
14. **Batch de edições** (v2) — acumula múltiplas edições num único prompt para otimizar tokens
15. **Lemon Squeezy para licenciamento** — license keys, grace period offline
16. **Zero dados transitam pela rede** — tudo local exceto verificação de licença
