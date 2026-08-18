# Progress — change-info-streamer-bot

## 2026-08-19

### Compact UI, modal repair, and Action-driven presets

- **Status:** complete
- Redesigned the screen for an OBS dock: denser header and cards, responsive one-column layout, compact template/preset panels, and reduced-motion support.
- Replaced the hand-authored interface/platform/category artwork with bundled Lucide and Simple Icons SVG assets. Brand and stroke icons now use separate presentation rules.
- Fixed the modal-close regression: only a click on the backdrop itself closes a modal; input clicks remain inside it. Focus and text selection survive a state re-render.
- Moved template editing to the main screen and added `%subtitle%` syntax highlighting. An empty subtitle stays visibly marked as `%subtitle%`; a supplied subtitle is highlighted separately in the previews.
- Bumped the API Action to version 2. It now persists templates/subtitle in Streamer.bot global variables, accepts `saveTemplates`, and supports `applyPreset` so the user's existing per-game Actions can set globals and call the one API Action.
- Added an automatically discovered `PRESET | ...` button strip for user-created preset Actions in `STREAM INFO`.
- Kept the YouTube Studio dashboard available even without an active broadcast; the watch link remains disabled until there is a live broadcast.

| Check | Result | Notes |
| --- | --- | --- |
| Strict TypeScript | pass | `npm run check` |
| UI action tests | pass | 6 Vitest tests; every HTML action is invoked with a mocked Streamer.bot client and no real stream data. |
| Production dependency audit | pass | `npm audit --omit=dev` reports 0 vulnerabilities. |
| Single-file build | pass | Rebuilt root and `dist` HTML plus the API v2 Import string. |
| External JS/CSS inspection | pass | Built HTML contains no external script or stylesheet dependency. |
| Updated API v2 production import | pending owner acceptance | The generated package is structurally verified; it still needs the user's one-time Import click in the real Streamer.bot instance. |

### SVG icon rendering repair

- **Status:** complete
- Reported reproduction: bundled Lucide icons were visibly cropped or degraded in the OBS dock.
- Root cause: the icon decorator replaced the entire opening `<svg>` tag and discarded each OSS asset's `viewBox` (as well as its other rendering attributes).
- Fix: retain the source SVG attributes and replace only accessibility/class metadata. CSS remains responsible for the displayed size and icon colour.
- Added a regression test that asserts both UI and brand SVGs retain their original `viewBox`.

## 2026-08-18

### Import compatibility repair

- **Status:** complete
- Reported reproduction: Streamer.bot 1.0.7 rejected the generated import while the dialog stated that both the current and required versions were 1.0.7.
- Root cause: the generated payload set `minimumVersion` to the exact exporter version at both the package and metadata levels.
- Fix: set the compatibility floor to 1.0.6 while retaining `exportedFrom: 1.0.7`; current 1.0.7 therefore passes the importer guard and the Action code is unchanged.
- Added `scripts/verify-import.mjs`, invoked by the normal build, to reject an `SBAE` package whose compatibility floor is equal to or higher than its exporter version.

| Check | Result | Notes |
| --- | --- | --- |
| Reproduction assertion | pass | The prior package correctly failed the new guard because both values were 1.0.7. |
| Rebuilt Import package | pass | `SBAE`, one `STREAM INFO | API` C# Action, and metadata/root minimum 1.0.6 verified. |
| Full build | pass | Import generation, verification, strict TypeScript, and single-file Vite build succeeded. |

## 2026-08-17

### Implementation and validation

- **Status:** complete
- Inspected the empty workspace and the applicable project-planning and frontend-design guidance.
- Consulted the official Streamer.bot docs for import/export and C# Action execution.
- Kept the existing Streamer.bot installation unchanged and used an isolated 1.0.7 instance on port 18080.
- Added the one-Action C# command router, strict TypeScript DOM UI, local YouTube category SVGs, templates, forms, status effects, local settings, Vite single-file build, and build-generated native Import package.
- Built `dist/change-info-streamer-bot.html`, root `change-info-streamer-bot.html`, and root `streamerbot-import.txt`.

## Verification log

| Check | Result | Notes |
| --- | --- | --- |
| Workspace baseline | pass | Empty workspace; no existing implementation to preserve. |
| Official import format | pass | Documented as a UUEncoded export produced by Streamer.bot. |
| C# API model fields | pass | Inspected the locally installed 1.0.7 interface assembly. |
| Production dependency audit | pass | No production dependency vulnerabilities. |
| C# Action compile and `getState` response | pass | Isolated Streamer.bot 1.0.7 compiled the current action and returned a correlated `Custom.CodeEvent`. |
| WebSocket authentication | pass | Wrong password rejected; correct password reached `GetActions` and `DoAction`. |
| Unavailable YouTube response | pass | `updateYouTube` returns the expected typed “Стрим YouTube должен быть запущен” error. |
| Import package integrity | pass | `SBAE` header, gzip decode, one Action/one C# sub-action, and source byte parity verified. |
| Direct `file://` render | pass | Headless Chrome rendered the built file without a local HTTP server or external JS/CSS resources. |
| Live Twitch/YouTube mutations | not run | Deliberately excluded: no owner accounts were touched. |
