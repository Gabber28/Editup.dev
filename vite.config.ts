import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@bridge": path.resolve(__dirname, "ai-bridge"),
      "@verify": path.resolve(__dirname, "verification"),
      "@injected": path.resolve(__dirname, "injected"),
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
