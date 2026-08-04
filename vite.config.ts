import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // `motion` is the animation runtime behind every ported component
        // (design-plan.md §4). Splitting it and React out of the app chunk
        // does not shrink the first visit, but it means editing a page does
        // not invalidate ~150 KB of vendor code in everyone's cache.
        manualChunks: {
          react: ["react", "react-dom"],
          motion: ["motion", "motion/react"],
        },
      },
    },
  },
  server: {
    // Replit's preview is a proxied iframe on a different origin.
    allowedHosts: true,
  },
});
