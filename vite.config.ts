import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      input: {
        "change-info-streamer-bot": fileURLToPath(new URL("./src/index.html", import.meta.url)),
      },
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
