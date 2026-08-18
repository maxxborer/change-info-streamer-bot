import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

const requestedLocale = process.env.STREAM_INFO_LOCALE ?? "ru";
const locale = ["ru", "en", "es", "zh"].includes(requestedLocale) ? requestedLocale : "ru";

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [
    viteSingleFile(),
    {
      name: "stream-info-locale",
      transformIndexHtml(html) {
        return html.replace('<html lang="ru">', `<html lang="${locale}" data-stream-info-locale="${locale}">`);
      },
    },
  ],
  define: {
    __STREAM_INFO_LOCALE__: JSON.stringify(locale),
  },
  build: {
    outDir: "../dist",
    emptyOutDir: false,
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
