import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
        project: "./tsconfig.json",
      },
      globals: {
        // browser
        window: "readonly",
        document: "readonly",
        location: "readonly",
        navigator: "readonly",
        sessionStorage: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        console: "readonly",
        WebSocket: "readonly",
        MessageEvent: "readonly",
        CustomEvent: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        HTMLStyleElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLButtonElement: "readonly",
        SVGElement: "readonly",
        Node: "readonly",
        NodeList: "readonly",
        DOMException: "readonly",
        CSSRule: "readonly",
        CSSRuleList: "readonly",
        CSSStyleRule: "readonly",
        CSSStyleSheet: "readonly",
        CSSGroupingRule: "readonly",
        getComputedStyle: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        ResizeObserver: "readonly",
        MutationObserver: "readonly",
        PointerEvent: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        Event: "readonly",
        EventTarget: "readonly",
        AbortController: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        crypto: "readonly",
        performance: "readonly",
        // shared timers
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        queueMicrotask: "readonly",
        structuredClone: "readonly",
        // node (tests, scripts)
        NodeJS: "readonly",
        process: "readonly",
        Buffer: "readonly",
        global: "readonly",
        globalThis: "readonly",
        __dirname: "readonly",
        require: "readonly",
        module: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "error",

      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='exec']",
          message:
            "Use spawn() with shell:false instead of exec() for security",
        },
        {
          selector:
            "Literal[value=/--dangerously-skip-permissions/], TemplateElement[value.raw=/--dangerously-skip-permissions/]",
          message:
            "--dangerously-skip-permissions is forbidden in this codebase",
        },
        {
          selector: "Literal[value='0.0.0.0']",
          message: "Servers must bind to 127.0.0.1 only, never 0.0.0.0",
        },
      ],

      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  prettierConfig,
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "src-tauri/target/**",
      "landing/**",
      "**/*.config.js",
    ],
  },
];
