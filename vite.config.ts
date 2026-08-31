import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

type ThinkingParam = { type: 'enabled' | 'disabled' };

async function readJsonBody(req: IncomingMessage): Promise<any> {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += String(chunk);
      if (data.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function deepseekProxyPlugin(): Plugin {
  const route = '/api/deepseek/chat';
  const handler = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (err?: any) => void
  ) => {
    try {
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: { message: 'Method Not Allowed' } });
        return;
      }

      const body = await readJsonBody(req);
      const apiKey = String(body?.apiKey ?? '').trim();
      if (!apiKey) {
        sendJson(res, 400, { error: { message: '缺少 apiKey（仅在内存中使用，不会落盘）' } });
        return;
      }

      const model = String(body?.model ?? 'deepseek-chat');
      const messages = body?.messages;
      const stream = Boolean(body?.stream ?? false);
      const temperature = Number.isFinite(body?.temperature) ? body.temperature : 0.7;
      const max_tokens = Number.isFinite(body?.max_tokens) ? body.max_tokens : 3000;
      const thinking = body?.thinking as ThinkingParam | undefined;

      if (!Array.isArray(messages) || messages.length < 1) {
        sendJson(res, 400, { error: { message: 'messages 必须为数组' } });
        return;
      }
      const forwardBody: any = {
        model,
        messages,
        stream,
        temperature,
        max_tokens
      };
      if (thinking && (thinking.type === 'enabled' || thinking.type === 'disabled')) {
        forwardBody.thinking = thinking;
      }

      const controller = new AbortController();
      req.on('close', () => controller.abort());

      const upstream = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(forwardBody),
        signal: controller.signal
      });

      const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

      // stream=true: 直接转发 SSE，避免在后端聚合导致“像被截断”
      if (stream && upstream.ok && upstream.body) {
        res.statusCode = upstream.status;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const nodeStream = Readable.fromWeb(upstream.body as any);
        nodeStream.on('error', (e) => {
          console.error('[deepseek-proxy] upstream stream error:', e);
          if (!res.headersSent) {
            sendJson(res, 502, { error: { message: '网络/代理错误：请检查网络后重试' } });
          } else {
            try {
              res.end();
            } catch {
              // ignore
            }
          }
        });
        nodeStream.pipe(res);
        return;
      }

      // 非流式：读取全文原样返回
      const text = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', contentType);
      res.end(text);
    } catch (err) {
      // 不要打印 apiKey；这里只打印错误对象/堆栈
      console.error('[deepseek-proxy] error:', err);
      sendJson(res, 502, { error: { message: '网络/代理错误：请检查网络后重试' } });
    }
  };

  return {
    name: 'deepseek-proxy',
    configureServer(server) {
      server.middlewares.use(route, handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(route, handler);
    }
  };
}

export default defineConfig({
  plugins: [react(), deepseekProxyPlugin()],
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 4173
  }
});
