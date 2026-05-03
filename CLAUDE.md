# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Feishu Claude Gateway is a small TypeScript/Node.js service that receives Feishu/Lark WebSocket message events, maps each chat/user to a Claude Code workspace session, runs the local `claude` CLI, and streams responses back by updating Feishu interactive cards.

## Commands

- `npm install` — install dependencies.
- `npm run dev` — run the gateway from `src/index.ts` with `tsx`.
- `npm run build` — compile TypeScript into `dist/`; run before PM2 production restarts.
- `npm start` — run the compiled `dist/index.js` entrypoint.
- `npm run lint` — run ESLint over `src/`.
- `npm run format` — format TypeScript sources with Prettier.
- There is currently no test script in `package.json`; use `npm run build` and `npm run lint` as the baseline verification commands.

## Runtime and deployment

- Required Feishu credentials are read from `.env`: `FEISHU_APP_ID` and `FEISHU_APP_SECRET`.
- Optional runtime settings include `FEISHU_ENCRYPT_KEY`, `FEISHU_VERIFICATION_TOKEN`, `WORKSPACE_ROOT`, `DEFAULT_WORKSPACE`, `CLAUDE_BIN`, `ADMIN_HOST`, `ADMIN_PORT`, and `LOG_LEVEL`.
- The gateway uses Feishu WebSocket events, so it does not require a public HTTP callback URL.
- The local admin UI is served at `/admin` on `ADMIN_HOST:ADMIN_PORT` (default `127.0.0.1:3001`) and writes editable settings to `.env`; restart the process for Feishu/WebSocket config changes to apply.
- Production uses `ecosystem.config.cjs` with PM2. Build first, then `pm2 start ecosystem.config.cjs`; use `pm2 logs feishu-claude-gateway` and `pm2 restart feishu-claude-gateway --update-env` for operations.

## Architecture

- [src/index.ts](src/index.ts) is the composition root: it loads config, starts the local admin server, initializes the Feishu SDK client and WebSocket client, fetches bot identity for group mention filtering, and wires message events into `Gateway`.
- [src/config/index.ts](src/config/index.ts) owns environment loading and path validation. `DEFAULT_WORKSPACE` must stay under `WORKSPACE_ROOT`.
- [src/config/editable-config.ts](src/config/editable-config.ts) is only for the admin UI’s editable `.env` fields; keep it in sync when adding admin-editable settings.
- [src/feishu/event-handler.ts](src/feishu/event-handler.ts) converts Feishu `im.message.receive_v1` events into internal `IncomingMessage` objects. It accepts `text` and `post` messages, ignores unmentioned group messages, strips Feishu mention/link markup, and passes plain text onward.
- [src/gateway.ts](src/gateway.ts) contains the chat command and run orchestration logic. It handles `/help`, `/status`, `/use`, `/new`, and `/stop`, prevents concurrent runs per chat/user session, sends the initial card, and rate-limits streaming card updates.
- [src/runner/claude-runner.ts](src/runner/claude-runner.ts) is the boundary to Claude Code. It spawns `claude -p --output-format stream-json --verbose --include-partial-messages`, optionally resumes with `--resume`, parses newline-delimited JSON stream events, forwards text/tool updates, and returns the session id/model.
- [src/session/session-registry.ts](src/session/session-registry.ts) stores in-memory per-chat/user workspace, Claude session id, and active abort controller. State is not persisted across process restarts.
- [src/session/workspace-registry.ts](src/session/workspace-registry.ts) resolves `/use` inputs against `WORKSPACE_ROOT` and rejects paths outside that root.
- [src/feishu/card-builder.ts](src/feishu/card-builder.ts) builds Feishu interactive card JSON and truncates long response content before updates.
- [src/feishu/message-sender.ts](src/feishu/message-sender.ts) wraps Feishu message, card, image, and file send/update APIs.
- [src/admin/server.ts](src/admin/server.ts) is a local-only HTTP server for viewing/editing config and testing Claude/Feishu connectivity.

## Notes for changes

- This is an ESM NodeNext TypeScript project; source imports include `.js` extensions even when importing `.ts` files.
- Keep workspace path checks strict when changing session or `/use` behavior; Claude runs with `cwd` set to the selected workspace.
- Feishu card updates are intentionally throttled through [src/utils/rate-limiter.ts](src/utils/rate-limiter.ts) to avoid excessive patch calls while Claude streams output.
- If you change Claude stream parsing, preserve support for both top-level events and nested `event` payloads; current code reads `session_id`, assistant text blocks, `content_block_delta` text deltas, and `tool_use` blocks.
