import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works under GitHub Pages' /<repo>/ subpath
  // (and any other static host) without hard-coding the repo name.
  base: "./",
  plugins: [react()],
  // PGlite ships its own wasm; keep it out of dep pre-bundling.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  server: { port: 8040 },
});
