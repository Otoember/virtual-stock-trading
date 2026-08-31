export type SSEDataHandler = (data: string) => void;

export async function readSSEStream(params: {
  response: Response;
  onData: SSEDataHandler;
  onDone?: () => void;
}): Promise<void> {
  const { response, onData, onDone } = params;
  if (!response.body) throw new Error('响应不支持流式读取（response.body 为空）');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 以 \n 分行；每行以 data: 开头
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '');
        buffer = buffer.slice(idx + 1);

        if (!line) continue;
        if (line.startsWith('data:')) {
          const data = line.slice(5).trimStart();
          onData(data);
          if (data === '[DONE]') {
            onDone?.();
            return;
          }
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

