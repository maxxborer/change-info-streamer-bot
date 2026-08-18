# Stream Info for Streamer.bot

[Русская версия](README.ru.md)

One self-contained HTML control surface for updating Twitch and YouTube stream metadata from an OBS dock. It connects only to Streamer.bot’s local WebSocket; there is no hosted service, OAuth page, or external UI dependency.

![Russian dashboard showcase](docs/screenshots/dashboard-ru.png)

## What it does

- Updates titles, categories, and tags on Twitch and on an active YouTube broadcast.
- Keeps reusable Twitch and YouTube title templates in Streamer.bot global variables.
- Discovers `PRESET | …` Actions in the `STREAM INFO` group for game presets.
- Opens the correct YouTube Studio destination for both live and non-live states.
- Ships as a single file that can be opened directly with `file://`.
- Builds fully localized HTML in Russian, English, Spanish, and Simplified Chinese.

## Quick start

1. Download and open [change-info-streamer-bot.html](change-info-streamer-bot.html).
2. Make sure Streamer.bot’s built-in WebSocket server is enabled.
3. If prompted, copy [streamerbot-import.txt](streamerbot-import.txt), select **Import** in Streamer.bot, and complete the import.
4. Return to Stream Info and select **Check again**.

The page automatically connects to `ws://127.0.0.1:8080/`. If your WebSocket requires a password, enter it in the compact connection panel or in Settings. Twitch credentials remain inside the Streamer.bot Action and are never embedded in the HTML file.

## Languages and builds

The checked-in `change-info-streamer-bot.html` is the Russian default for direct use. Run the build to create all standalone variants:

```powershell
npm install
npm run build
```

| Language | Generated file |
| --- | --- |
| Russian | `dist/change-info-streamer-bot.ru.html` |
| English | `dist/change-info-streamer-bot.en.html` |
| Spanish | `dist/change-info-streamer-bot.es.html` |
| Simplified Chinese | `dist/change-info-streamer-bot.zh.html` |

For a safe visual tour with sample data, append `?demo=1` to any built HTML file. Demo mode does not connect to Streamer.bot or make platform changes.

![English full-screen editor showcase](docs/screenshots/modal-en.png)

## Templates and presets

Title templates are configured in **Settings**. The first workspace block is **Subtitle**: it saves the subtitle and applies the resulting titles to connected Twitch and an active YouTube broadcast. Each template may contain at most one `%subtitle%` token.

To create a game preset, make an Action in the `STREAM INFO` group named `PRESET | Game name`. Set any of the following persistent global variables, then call `STREAM INFO | API` with `command = applyPreset`:

| Variable | Meaning |
| --- | --- |
| `stream_info.template.twitch` | Twitch title template |
| `stream_info.template.youtube` | YouTube title template |
| `stream_info.template.subtitle` | Subtitle |
| `stream_info.preset.twitchCategoryId` | Twitch category ID |
| `stream_info.preset.youtubeCategoryName` | YouTube category name |
| `stream_info.preset.twitchTagsJson` | Twitch tag JSON array |
| `stream_info.preset.youtubeTagsJson` | YouTube tag JSON array |

An empty variable leaves that field unchanged. YouTube is skipped when no broadcast is running, while Twitch can still be updated.

## Development

```powershell
npm install
npm test
npm run build
```

`npm run build` regenerates the native Streamer.bot import, checks TypeScript, and emits all four single-file HTML variants. `dist/` is a local build directory and is intentionally not committed.

## Security and support

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability. For contribution expectations, see [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Credits

Thank you to [nutty.gg](https://nutty.gg/) for the idea and inspiration behind the focused streamer control-surface direction.

## License

[MIT](LICENSE) © 2026 maxxborer
