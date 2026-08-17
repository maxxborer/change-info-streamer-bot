import { copyFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const project = resolve(import.meta.dirname, "..");
const built = resolve(project, "dist/index.html");
const distribution = resolve(project, "dist/change-info-streamer-bot.html");
renameSync(built, distribution);
copyFileSync(distribution, resolve(project, "change-info-streamer-bot.html"));
copyFileSync(resolve(project, "streamerbot/import.txt"), resolve(project, "streamerbot-import.txt"));
