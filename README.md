# Feishu Claude Gateway

Small Feishu-to-Claude Code remote I/O gateway.

## Scope

- Feishu text/post message receiving
- Interactive card streaming updates
- Per-chat/user workspace session mapping
- Native `claude` CLI execution in the selected workspace
- `/help`, `/status`, `/use`, `/new`, `/stop`

Claude Code continues to own project context, skills, MCP, settings, and session files inside each workspace.

## Development

```bash
cp .env.example .env
npm install
npm run dev
```

## Production

Build before starting or restarting the production process:

```bash
npm run build
```

Start with PM2:

```bash
pm2 start ecosystem.config.cjs
```

If the process is already running, restart it with:

```bash
pm2 restart feishu-claude-gateway --update-env
```

Watch realtime logs:

```bash
pm2 logs feishu-claude-gateway
```

Common management commands:

```bash
pm2 status feishu-claude-gateway
pm2 stop feishu-claude-gateway
```

## Environment

See `.env.example`.
