import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const dist = resolve(project, "dist");
const locales = ["ru", "en", "es", "zh"];
const rootRelease = readFileSync(resolve(project, "change-info-streamer-bot.html"));

for (const locale of locales) {
  const file = resolve(dist, `change-info-streamer-bot.${locale}.html`);
  const html = readFileSync(file, "utf8");
  if (!html.includes(`data-stream-info-locale="${locale}"`)) throw new Error(`${locale} HTML is missing its locale marker.`);
  if (/<(?:script|link)\b[^>]+(?:src|href)=(?:"|')https?:/i.test(html)) throw new Error(`${locale} HTML has an external web dependency.`);
  if (/<script\b[^>]+\bsrc=/i.test(html)) throw new Error(`${locale} HTML is not self-contained.`);
}

const russianRelease = readFileSync(resolve(dist, "change-info-streamer-bot.ru.html"));
if (!rootRelease.equals(russianRelease)) throw new Error("Root release must be identical to the Russian build.");

console.log("Verified four self-contained localized HTML builds.");
