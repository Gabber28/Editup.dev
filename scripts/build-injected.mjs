import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const entry = resolve(root, "injected/agent.ts");
const outFile = resolve(root, "injected/dist/agent.js");

mkdirSync(dirname(outFile), { recursive: true });

await build({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  target: "es2022",
  outfile: outFile,
  minify: true,
  legalComments: "none",
  platform: "browser",
  sourcemap: false,
  banner: {
    js: "// EditUp agent bundle — runs in the user's browser via injected proxy",
  },
});

process.stdout.write(`built ${outFile}\n`);
