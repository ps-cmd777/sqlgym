import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // PGlite ships its own wasm; keep it out of dep pre-bundling.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  server: { port: 8040 },
});
