# Task plan — change-info-streamer-bot

## Goal

Deliver a single self-contained `change-info-streamer-bot.html` that works directly from `file://` with Streamer.bot's built-in WebSocket server, plus a verified native import for one `STREAM INFO | API` C# Action.

## Status

Implementation, build, and isolated Streamer.bot validation are complete. The only checks intentionally outside automation are real Twitch/YouTube account mutations and clicking the Import dialog in the user's production application.

## Phase

5 of 5 — handoff and verification complete.

## Phases

1. **Contracts and import validation** — complete
   - Confirmed the WebSocket calls, CodeEvent shape, authentication flow, and C# method signatures.
   - Generated the documented `SBAE + gzip + base64` native package shape and decoded it again for integrity checks.
2. **Single-file UI** — complete
   - Strict TypeScript, Vite, bundled Streamer.bot client, CSS/assets/import embedded in one HTML.
3. **Action implementation** — complete
   - One C# command router for state, Twitch category search, and platform updates.
4. **Build and integration verification** — complete
   - Build, inspect external-dependency-free output, type checks, and live Streamer.bot tests where account state permits.
5. **Handoff** — complete
   - Copy root artifacts, update README and durable findings.

## Key decisions

| Decision | Reason |
| --- | --- |
| Single HTML from Vite | Required for direct double-click use without a local server. |
| One Action with CodeEvent replies | `DoAction` acknowledges dispatch only; per-request replies avoid conflict between open pages. |
| Native export format | The import uses the same `SBAE` gzip/base64 envelope and 1.0.7 action schema as official examples; its bytecode was separately compiled by an isolated real instance. |

## Known risks

- No Twitch/YouTube account was connected to the isolated test instance, so live/offline data and mutating platform calls remain owner-account acceptance checks.
- The isolated test deliberately did not automate clicking the Import dialog: it validates the exact decoded payload and compiled Action, while keeping the user's production application untouched.
