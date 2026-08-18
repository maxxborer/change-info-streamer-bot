# Findings — change-info-streamer-bot

## Requirements captured

- No HTTP server, launcher, CDN, OAuth flow in HTML, database, or wizard.
- Open a self-contained HTML directly; it connects by default to `ws://127.0.0.1:8080/`.
- Require exactly one Streamer.bot Action: `STREAM INFO | API` in group `STREAM INFO`.
- Action commands: `getState`, `searchTwitchCategories`, `updateTwitch`, `updateYouTube`.
- Use C# `Custom.CodeEvent` replies with a caller-generated `requestId` and a 15-second UI timeout.

## Research findings

- Streamer.bot's official import/export documentation states that imports are UUEncoded strings and that exported Actions retain groups, sub-actions, and C# code.
- The official C# Execute Code reference confirms that custom C# runs as an Action sub-action and can be precompiled.
- The working directory was empty at discovery; there are no existing project files or uncommitted user changes to preserve.
- A local portable Streamer.bot 1.0.7 install and its official update archive were found under the user's OBS project. The production copy remained unchanged; validation used an isolated copy on port 18080.
- The installed `YouTubeBroadcastInfo` model exposes `Id`, `Title`, `CategoryId`, `CategoryName`, `Tags`, and `Status`; `YouTubeUserInfo` exposes account name, login, and ID.
- `@streamerbot/client` 2.0.1 supports the default `ws://127.0.0.1:8080/` connection, automatic reconnect, `GetActions`, `DoAction`, and `Custom.CodeEvent` subscriptions.
- Direct dependencies have no audit findings. Vite is a build-only dependency, but its initial version had a development-server advisory; it is pinned to the patched 6.4.3 release.
- An official import decodes to the `SBAE` header followed by gzip-compressed JSON. The generated package has that envelope, one Action in `STREAM INFO`, one C# sub-action (`type: 99999`), and byte-for-byte source parity with `streamerbot/action.cs`.
- The isolated Streamer.bot 1.0.7 instance compiled the current C# source, accepted correct WebSocket authentication while rejecting a wrong password, and returned a correlated `Custom.CodeEvent` for `getState`.
- Opening the built HTML directly through `file://` in a clean headless Chrome profile rendered the UI and reached the local Streamer.bot WebSocket without a web server or external JS/CSS loads. The connection was read-only during this check.
- Streamer.bot 1.0.7 rejects an import whose metadata declares `minimumVersion: "1.0.7"`, despite reporting its own version as 1.0.7. The generated Import now declares 1.0.6 as its compatibility floor and keeps `exportedFrom: "1.0.7"`; a build-time decoder guards that invariant.
- `CPH.GetGlobalVar` and `CPH.SetGlobalVar` provide persistent Streamer.bot storage suitable for template and preset values. The Action API now uses them behind `getState`, `saveTemplates`, and `applyPreset`; HTML never receives Twitch credentials.
- UI behavior is covered by Vitest and JSDOM with a mocked `@streamerbot/client`. These tests exercise all HTML commands without a connection to Streamer.bot or a mutation of Twitch/YouTube data.

## Resources

- https://docs.streamer.bot/guide/core/import-export
- https://docs.streamer.bot/api
- https://docs.streamer.bot/api/sub-actions/core/csharp/execute-csharp-code
- https://docs.streamer.bot/api/websocket/events/custom/code-event
- https://docs.streamer.bot/api/csharp/methods/core/globals/get-global-var
- https://docs.streamer.bot/api/csharp/methods/core/globals/set-global-var

## Decisions

| Decision | Rationale |
| --- | --- |
| Use project-local planning notes | Scope is large and native import validation must survive a handoff. |
| Generate Import from source at build time | Keeps the embedded string, `streamerbot/import.txt`, and root `streamerbot-import.txt` synchronized with the tested C# source. |
| Subscribe to `Custom.CodeEvent` | This is the documented WebSocket event produced by `CPH.TriggerCodeEvent`. |
