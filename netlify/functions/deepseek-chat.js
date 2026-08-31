const UPSTREAM_URL = 'https://api.deepseek.com/v1/chat/completions';

const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 4000;
const UPSTREAM_TIMEOUT_MS = 20_000;

function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

function decodeBody(event) {
  const body = event?.body ?? '';
  if (!body) return Buffer.alloc(0);
  return Buffer.from(body, event?.isBase64Encoded ? 'base64' : 'utf8');
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return json(
        405,
        { error: { message: 'Method Not Allowed' } },
        { Allow: 'POST' }
      );
    }

    const bodyBuf = decodeBody(event);
    if (bodyBuf.length > MAX_BODY_BYTES) {
      return json(413, { error: { message: `Body too large (max ${MAX_BODY_BYTES} bytes)` } });
    }

    let reqJson = {};
    try {
      const raw = bodyBuf.toString('utf8');
      reqJson = raw ? JSON.parse(raw) : {};
    } catch {
      return json(400, { error: { message: 'Invalid JSON body' } });
    }

    const apiKey = asTrimmedString(reqJson.apiKey);
    if (!apiKey) return json(400, { error: { message: 'Missing apiKey' } });

    const model = asTrimmedString(reqJson.model) || 'deepseek-chat';
    if (model.length > 100) return json(400, { error: { message: 'Invalid model' } });

    const temperatureRaw = reqJson.temperature;
    const temperature =
      typeof temperatureRaw === 'number'
        ? temperatureRaw
        : typeof temperatureRaw === 'string'
          ? Number(temperatureRaw)
          : NaN;
    const forwardTemperature = Number.isFinite(temperature) ? temperature : 0.7;

    const messages = reqJson.messages;
    if (!Array.isArray(messages)) return json(400, { error: { message: 'messages must be an array' } });
    if (messages.length < 1) return json(400, { error: { message: 'messages must not be empty' } });
    if (messages.length > MAX_MESSAGES) return json(400, { error: { message: `messages too many (max ${MAX_MESSAGES})` } });

    const streamRequested = Boolean(reqJson.stream);

    const normalizedMessages = [];
    for (const msg of messages) {
      const role = asTrimmedString(msg?.role);
      const content = typeof msg?.content === 'string' ? msg.content : '';
      if (!role || !content) return json(400, { error: { message: 'Each message must have role/content' } });
      if (content.length > MAX_CONTENT_CHARS) {
        return json(400, { error: { message: `Message content too long (max ${MAX_CONTENT_CHARS} chars)` } });
      }
      normalizedMessages.push({ role, content });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('Upstream timeout')), UPSTREAM_TIMEOUT_MS);

    let upstream;
    try {
      upstream = await fetch(UPSTREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: normalizedMessages,
          temperature: forwardTemperature,
          stream: false
        }),
        signal: controller.signal
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        return json(504, { error: { message: `Upstream timeout (${UPSTREAM_TIMEOUT_MS}ms)` } });
      }
      console.error('[netlify deepseek-chat] upstream fetch failed:', err?.name || err);
      return json(502, { error: { message: 'Upstream request failed' } });
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
    const text = await upstream.text();

    if (streamRequested && upstream.ok) {
      let upstreamJson;
      try {
        upstreamJson = JSON.parse(text);
      } catch {
        return json(502, { error: { message: 'Upstream returned non-JSON response' } });
      }

      const choice0 = upstreamJson?.choices?.[0];
      const message0 = choice0?.message;
      const content = message0?.content;
      const reasoningContent = message0?.reasoning_content;
      const finishReason = choice0?.finish_reason ?? choice0?.finishReason;

      if (typeof content !== 'string') {
        return json(502, { error: { message: 'Upstream returned unexpected response shape' } });
      }

      const delta = { content };
      if (typeof reasoningContent === 'string' && reasoningContent) delta.reasoning_content = reasoningContent;

      const sseEventChoice = { delta };
      if (typeof finishReason === 'string' && finishReason) sseEventChoice.finish_reason = finishReason;

      const sseBody = `data: ${JSON.stringify({ choices: [sseEventChoice] })}\n\ndata: [DONE]\n\n`;
      return {
        statusCode: upstream.status,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store'
        },
        body: sseBody
      };
    }

    return {
      statusCode: upstream.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      },
      body: text
    };
  } catch (err) {
    console.error('[netlify deepseek-chat] unexpected error:', err?.name || err);
    return json(500, { error: { message: 'Internal Server Error' } });
  }
}
