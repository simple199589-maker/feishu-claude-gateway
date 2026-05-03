import http from 'node:http';
import { spawn } from 'node:child_process';
import * as lark from '@larksuiteoapi/node-sdk';
import type { AppConfig } from '../config/index.js';
import { readEditableConfig, writeEditableConfig, type EditableConfig } from '../config/editable-config.js';
import type { Logger } from '../utils/logger.js';

export function startAdminServer(config: AppConfig, logger: Logger): http.Server {
  const server = http.createServer(async (req, res) => {
    try {
      if (!isLocal(req.socket.remoteAddress)) {
        send(res, 403, 'Forbidden');
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (req.method === 'GET' && url.pathname === '/') {
        redirect(res, '/admin');
        return;
      }

      if (req.method === 'GET' && url.pathname === '/admin') {
        sendHtml(res, renderAdmin(await readEditableConfig()));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/config') {
        sendJson(res, await readEditableConfig());
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/config') {
        const body = await readJson<EditableConfig>(req);
        await writeEditableConfig(normalizeConfig(body));
        sendJson(res, { ok: true, message: 'Saved. Restart the gateway to apply Feishu/WebSocket changes.' });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/test/claude') {
        sendJson(res, await testClaude());
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/test/feishu') {
        sendJson(res, await testFeishu());
        return;
      }

      send(res, 404, 'Not found');
    } catch (err) {
      logger.error({ err }, 'Admin request failed');
      sendJson(res, { ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
    }
  });

  server.listen(config.adminPort, config.adminHost, () => {
    logger.info({ host: config.adminHost, port: config.adminPort }, 'Local admin UI started');
  });

  return server;
}

function isLocal(address?: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function normalizeConfig(body: Partial<EditableConfig>): EditableConfig {
  return {
    FEISHU_APP_ID: body.FEISHU_APP_ID || '',
    FEISHU_APP_SECRET: body.FEISHU_APP_SECRET || '',
    WORKSPACE_ROOT: body.WORKSPACE_ROOT || '/home/simple/work',
    DEFAULT_WORKSPACE: body.DEFAULT_WORKSPACE || '/home/simple/work',
    CLAUDE_BIN: body.CLAUDE_BIN || 'claude',
    LOG_LEVEL: body.LOG_LEVEL || 'info',
    ADMIN_HOST: body.ADMIN_HOST || '127.0.0.1',
    ADMIN_PORT: body.ADMIN_PORT || '3001',
  };
}

async function testClaude(): Promise<Record<string, unknown>> {
  const cfg = await readEditableConfig();
  return new Promise(resolve => {
    const child = spawn(cfg.CLAUDE_BIN, ['--version'], { cwd: cfg.DEFAULT_WORKSPACE });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.on('error', err => resolve({ ok: false, error: err.message }));
  });
}

async function testFeishu(): Promise<Record<string, unknown>> {
  const cfg = await readEditableConfig();
  const client = new lark.Client({
    appId: cfg.FEISHU_APP_ID,
    appSecret: cfg.FEISHU_APP_SECRET,
    disableTokenCache: true,
  });
  const botInfo = await client.request({ method: 'GET', url: '/open-apis/bot/v3/info' }) as {
    bot?: { open_id?: string; app_name?: string };
  };
  return { ok: true, bot: botInfo.bot };
}

function renderAdmin(config: EditableConfig): string {
  const fields: Array<keyof EditableConfig> = [
    'FEISHU_APP_ID',
    'FEISHU_APP_SECRET',
    'WORKSPACE_ROOT',
    'DEFAULT_WORKSPACE',
    'CLAUDE_BIN',
    'LOG_LEVEL',
    'ADMIN_HOST',
    'ADMIN_PORT',
  ];

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Feishu Claude Gateway Admin</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7fb;
      --panel: #ffffff;
      --panel-soft: #f9fafc;
      --text: #172033;
      --muted: #667085;
      --border: #e4e7ec;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --success: #16a34a;
      --shadow: 0 20px 60px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 32rem),
        linear-gradient(180deg, #ffffff 0%, var(--bg) 42%);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .shell { max-width: 1040px; margin: 0 auto; padding: 40px 24px; }
    .hero { display: flex; justify-content: space-between; gap: 24px; align-items: flex-end; margin-bottom: 24px; }
    .eyebrow { color: var(--primary); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
    h1 { margin: 8px 0 10px; font-size: 36px; line-height: 1.1; letter-spacing: -0.03em; }
    .hint { color: var(--muted); margin: 0; font-size: 15px; }
    .badge { border: 1px solid #bbf7d0; background: #f0fdf4; color: #15803d; border-radius: 999px; padding: 8px 12px; font-size: 13px; font-weight: 650; white-space: nowrap; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr); gap: 20px; align-items: start; }
    .card { background: rgba(255, 255, 255, .86); backdrop-filter: blur(12px); border: 1px solid var(--border); border-radius: 24px; box-shadow: var(--shadow); }
    form.card { padding: 22px; }
    .side { padding: 20px; }
    .field { margin-bottom: 16px; }
    label { display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 800; letter-spacing: .04em; color: #344054; margin-bottom: 7px; }
    .input-wrap { position: relative; }
    input {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 13px;
      background: var(--panel-soft);
      color: var(--text);
      padding: 12px 14px;
      font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      outline: none;
      transition: border-color .15s, box-shadow .15s, background .15s;
    }
    input:focus { border-color: rgba(37, 99, 235, .6); background: #fff; box-shadow: 0 0 0 4px rgba(37, 99, 235, .12); }
    .secret input { padding-right: 52px; }
    .eye {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 34px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      margin: 0;
      padding: 0;
      font-size: 17px;
    }
    .eye:hover { background: #eef2ff; color: var(--primary); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
    button {
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 750;
      cursor: pointer;
      transition: transform .12s, background .12s, border-color .12s;
    }
    button:hover { transform: translateY(-1px); }
    .primary { background: var(--primary); color: #fff; }
    .primary:hover { background: var(--primary-hover); }
    .secondary { background: #fff; border-color: var(--border); color: #344054; }
    .secondary:hover { border-color: #c7d2fe; background: #f8faff; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    pre {
      min-height: 160px;
      margin: 0;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: #0b1020;
      color: #d1e7ff;
      padding: 14px;
      white-space: pre-wrap;
      overflow: auto;
      font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .note { color: var(--muted); font-size: 13px; line-height: 1.7; margin-top: 14px; }
    code { background: #eef2ff; color: #3730a3; border-radius: 6px; padding: 2px 5px; }
    @media (max-width: 820px) {
      .hero { display: block; }
      .badge { display: inline-flex; margin-top: 14px; }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <div>
        <div class="eyebrow">Local Admin</div>
        <h1>Feishu Claude Gateway</h1>
        <p class="hint">配置飞书、工作区和 Claude Code 路径。保存会写入 <code>.env</code>，重启后生效。</p>
      </div>
      <div class="badge">127.0.0.1 only</div>
    </section>

    <section class="grid">
      <form id="form" class="card">
        ${fields.map(key => renderField(key, config[key])).join('')}
        <div class="actions">
          <button class="primary" type="submit">Save config</button>
          <button class="secondary" type="button" id="testClaude">Test Claude</button>
          <button class="secondary" type="button" id="testFeishu">Test Feishu</button>
        </div>
      </form>

      <aside class="card side">
        <h2>Result</h2>
        <pre id="result">Ready</pre>
        <p class="note">Secret 字段默认隐藏，点击眼睛可展开查看。Feishu/WebSocket 配置保存后需要重启当前进程。</p>
      </aside>
    </section>
  </main>

  <script>
    const result = document.querySelector('#result');
    const form = document.querySelector('#form');
    document.querySelectorAll('[data-toggle-secret]').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.querySelector('#' + button.dataset.toggleSecret);
        const shown = input.type === 'text';
        input.type = shown ? 'password' : 'text';
        button.textContent = shown ? '👁' : '🙈';
        button.setAttribute('aria-label', shown ? 'Show secret' : 'Hide secret');
      });
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      result.textContent = 'Saving...';
      const body = Object.fromEntries(new FormData(form).entries());
      const res = await fetch('/api/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      result.textContent = JSON.stringify(await res.json(), null, 2);
    });
    document.querySelector('#testClaude').onclick = async () => {
      result.textContent = 'Testing Claude...';
      const res = await fetch('/api/test/claude', { method: 'POST' });
      result.textContent = JSON.stringify(await res.json(), null, 2);
    };
    document.querySelector('#testFeishu').onclick = async () => {
      result.textContent = 'Testing Feishu...';
      const res = await fetch('/api/test/feishu', { method: 'POST' });
      result.textContent = JSON.stringify(await res.json(), null, 2);
    };
  </script>
</body>
</html>`;
}

function renderField(key: keyof EditableConfig, value: string): string {
  const secret = key.includes('SECRET');
  const id = `field-${key}`;
  return `<div class="field ${secret ? 'secret' : ''}">
    <label for="${id}"><span>${key}</span></label>
    <div class="input-wrap">
      <input id="${id}" name="${key}" value="${escapeHtml(value)}" type="${secret ? 'password' : 'text'}" autocomplete="off" />
      ${secret ? `<button class="eye" type="button" data-toggle-secret="${id}" aria-label="Show secret">👁</button>` : ''}
    </div>
  </div>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

function redirect(res: http.ServerResponse, location: string): void {
  res.writeHead(302, { location });
  res.end();
}

function sendHtml(res: http.ServerResponse, html: string): void {
  send(res, 200, html, 'text/html; charset=utf-8');
}

function sendJson(res: http.ServerResponse, body: unknown, status = 200): void {
  send(res, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

function send(res: http.ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8'): void {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}
