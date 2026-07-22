import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Standalone TanStack Start config — no @lovable.dev/vite-tanstack-config wrapper.
// nitro() with no explicit preset uses Vercel's zero-config framework detection
// when deployed there (per Vercel's TanStack Start docs). For other hosts, pass
// e.g. nitro({ preset: "node-server" }) or nitro({ preset: "bun" }).
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      // Keeps the custom SSR error-wrapper entry at src/server.ts.
      server: { entry: "server" },
    }),
    nitro(),
    viteReact(),
  ],
});
