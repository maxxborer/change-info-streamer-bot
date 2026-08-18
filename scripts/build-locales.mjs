import { copyFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const dist = resolve(project, "dist");
const locales = ["ru", "en", "es", "zh"];
const viteCli = resolve(project, "node_modules", "vite", "bin", "vite.js");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const locale of locales) {
  execFileSync(process.execPath, [viteCli, "build"], {
    cwd: project,
    env: { ...process.env, STREAM_INFO_LOCALE: locale },
    stdio: "inherit",
  });
  renameSync(resolve(dist, "index.html"), resolve(dist, `change-info-streamer-bot.${locale}.html`));
}

copyFileSync(resolve(dist, "change-info-streamer-bot.ru.html"), resolve(project, "change-info-streamer-bot.html"));
