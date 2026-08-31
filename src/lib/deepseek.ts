import type { DeepSeekModel, ThinkingParam } from './types';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type DeepSeekChatRequest = {
  apiKey: string;
  model: DeepSeekModel;
  messages: ChatMessage[];
  temperature: number;
  max_tokens: number;
  thinking?: ThinkingParam;
};

export type DeepSeekChatResponse = any;

export type DeepSeekUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [k: string]: unknown;
};

export type DeepSeekExtracted = {
  content: string;
  reasoningContent?: string;
  finishReason?: string;
  usage?: DeepSeekUsage;
};

export type DeepSeekStreamDelta = {
  contentDelta?: string;
  reasoningDelta?: string;
  finishReason?: string;
};

export async function callDeepSeekChat(req: DeepSeekChatRequest): Promise<DeepSeekChatResponse> {
  const resp = await fetch('/api/deepseek/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: req.apiKey,
      model: req.model,
      messages: req.messages,
      stream: false,
      temperature: req.temperature,
      max_tokens: req.max_tokens,
      thinking: req.thinking
    })
  });

  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    // 如果上游返回不是 JSON，保留为 null
  }

  if (!resp.ok) {
    const upstreamMsg =
      (data && (data.error?.message || data.message || data.error?.type)) || `请求失败（HTTP ${resp.status}）`;
    const err: any = new Error(upstreamMsg);
    err.status = resp.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function buildDeepSeekRequestBody(req: DeepSeekChatRequest, stream: boolean) {
  return {
    apiKey: req.apiKey,
    model: req.model,
    messages: req.messages,
    stream,
    temperature: req.temperature,
    max_tokens: req.max_tokens,
    thinking: req.thinking
  };
}

export function extractDeepSeekContent(resp: any): DeepSeekExtracted {
  const choice = resp?.choices?.[0];
  const msg = choice?.message;
  const content = msg?.content;
  const reasoningContent = msg?.reasoning_content;
  const finishReason = choice?.finish_reason ?? choice?.finishReason;
  const usage = resp?.usage;
  if (typeof content !== 'string') {
    console.error('[deepseek] unexpected response shape:', resp);
    throw new Error('返回结构异常：无法找到 choices[0].message.content');
  }
  return {
    content,
    reasoningContent: typeof reasoningContent === 'string' ? reasoningContent : undefined,
    finishReason: typeof finishReason === 'string' ? finishReason : undefined,
    usage: usage && typeof usage === 'object' ? (usage as DeepSeekUsage) : undefined
  };
}

export function extractDeepSeekStreamDelta(eventJson: any): DeepSeekStreamDelta {
  const choice = eventJson?.choices?.[0];
  const delta = choice?.delta ?? choice?.message ?? {};
  const contentDelta = typeof delta?.content === 'string' ? delta.content : undefined;
  const reasoningDelta = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : undefined;
  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : undefined;
  return { contentDelta, reasoningDelta, finishReason };
}
