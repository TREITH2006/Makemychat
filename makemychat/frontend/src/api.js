/**
 * API client for MakeMyChat FastAPI backend.
 */

function resolveApiUrl(path, customBackendUrl = '') {
  const trimmedBase = (customBackendUrl || '').trim().replace(/\/+$/, '');
  if (!trimmedBase) {
    return path;
  }
  return `${trimmedBase}${path}`;
}

export async function fetchHealth(customBackendUrl = '') {
  const url = resolveApiUrl('/api/health', customBackendUrl);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchConfig(customBackendUrl = '') {
  const url = resolveApiUrl('/api/config', customBackendUrl);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Config fetch failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function discoverRtxPc(customBackendUrl = '') {
  const url = resolveApiUrl('/api/discover', customBackendUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Discovery failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function updateBackendConfig(
  { baseUrl, apiKey, model },
  customBackendUrl = ''
) {
  const url = resolveApiUrl('/api/config', customBackendUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      base_url: baseUrl,
      api_key: apiKey,
      model,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save backend config (HTTP ${response.status})`);
  }
  return response.json();
}

export async function sendChatMessage({
  message,
  history = [],
  systemPrompt = '',
  temperature = 0.7,
  stream = false,
  onStreamDelta = null,
  signal = undefined,
  customBackendUrl = '',
}) {
  const url = resolveApiUrl('/api/chat', customBackendUrl);

  const cleanHistory = history
    .filter(
      (msg) =>
        msg &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0 &&
        !msg.isError
    )
    .slice(-24)
    .map((msg) => ({
      role: msg.role,
      content: msg.content.slice(0, 16000),
    }));

  const bodyPayload = {
    message: message.trim(),
    history: cleanHistory,
    temperature: Number(temperature) || 0.7,
    stream: Boolean(stream),
  };

  if (systemPrompt && systemPrompt.trim()) {
    bodyPayload.system_prompt = systemPrompt.trim();
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: stream ? 'text/event-stream, application/json' : 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      const abortErr = new Error('Generation stopped by user.');
      abortErr.isAborted = true;
      throw abortErr;
    }
    const netErr = new Error(
      'Cannot reach the MakeMyChat FastAPI backend on http://127.0.0.1:8000. Make sure the backend terminal is running.'
    );
    netErr.retryable = true;
    throw netErr;
  }

  if (!response.ok) {
    let errorDetail = `Backend error (HTTP ${response.status})`;
    let retryable = response.status >= 500 || response.status === 429;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail =
          typeof errJson.detail === 'string'
            ? errJson.detail
            : JSON.stringify(errJson.detail);
      }
      if (typeof errJson?.retryable === 'boolean') {
        retryable = errJson.retryable;
      }
    } catch {
      // Fallback
    }
    const apiErr = new Error(errorDetail);
    apiErr.status = response.status;
    apiErr.retryable = retryable;
    throw apiErr;
  }

  const contentType = response.headers.get('content-type') || '';
  if (stream && contentType.includes('text/event-stream') && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedReply = '';
    let detectedModel = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            continue;
          }

          if (parsed.type === 'error') {
            const streamErr = new Error(parsed.detail || 'Error during response stream.');
            streamErr.retryable = parsed.retryable !== false;
            throw streamErr;
          }

          if (parsed.type === 'delta' && typeof parsed.delta === 'string') {
            accumulatedReply += parsed.delta;
            if (parsed.model) detectedModel = parsed.model;
            if (typeof onStreamDelta === 'function') {
              onStreamDelta(accumulatedReply, detectedModel);
            }
          } else if (parsed.type === 'done' && parsed.model) {
            detectedModel = parsed.model;
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        const abortErr = new Error('Generation stopped by user.');
        abortErr.isAborted = true;
        abortErr.partialReply = accumulatedReply;
        throw abortErr;
      }
      throw err;
    }

    return {
      reply: accumulatedReply,
      model: detectedModel || 'ollama/qwen3.5:4b',
      finish_reason: 'stop',
    };
  }

  const data = await response.json();
  return {
    reply: data.reply || '',
    model: data.model || 'ollama/qwen3.5:4b',
    finish_reason: data.finish_reason || 'stop',
    usage: data.usage || null,
  };
}
