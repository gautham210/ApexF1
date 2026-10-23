import { companionPwa } from "./pwa-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    companionPwa(),
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      autoCodeSplitting: true,
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  preview: { proxy: { "/api": { target: "http://127.0.0.1:8000", ws: true } } },
  build: {
    target: "es2022",
  },
});
