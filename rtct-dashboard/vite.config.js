import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true, // <- required so dist/assets/manifest.json exists
    outDir: "dist",
    assetsDir: "assets",
  },
  base: "/", // good for Ingress
});
