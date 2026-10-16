import { useCallback, useEffect, useRef, useState } from 'react';
import {
  discoverRtxPc,
  fetchConfig,
  fetchHealth,
  sendChatMessage,
  updateBackendConfig,
} from '../api';
import {
  createId,
  generateConversationTitle,
  loadActiveConversationId,
  loadConversations,
  saveActiveConversationId,
  saveConversations,
} from '../utils/storage';

export function useChat(settings) {
  const [conversations, setConversations] = useState(() => loadConversations());
  const [activeId, setActiveId] = useState(() => {
    const savedId = loadActiveConversationId();
    const loaded = loadConversations();
    if (savedId && loaded.some((c) => c.id === savedId)) {
      return savedId;
    }
    return loaded.length > 0 ? loaded[0].id : null;
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [errorState, setErrorState] = useState(null);

  const [backendStatus, setBackendStatus] = useState({
    checking: true,
    discovering: false,
    backendRunning: false,
    apiKeyConfigured: true,
    aiProviderReachable: false,
    aiProviderStatus: 'checking',
    aiProviderMessage: 'Connecting to RTX PC LiteLLM Server...',
    model: 'ollama/qwen3.5:4b',
    baseUrl: 'http://localhost:4000/v1',
    maxMessageLength: 16000,
  });

  const abortControllerRef = useRef(null);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveConversationId(activeId);
  }, [activeId]);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  const refreshBackendStatus = useCallback(async () => {
    setBackendStatus((prev) => ({ ...prev, checking: true }));
    try {
      const [health, config] = await Promise.all([
        fetchHealth(settings.customBackendUrl),
        fetchConfig(settings.customBackendUrl).catch(() => null),
      ]);

      setBackendStatus({
        checking: false,
        discovering: false,
        backendRunning: Boolean(health.backend_running),
        apiKeyConfigured: Boolean(health.api_key_configured),
        aiProviderReachable: Boolean(health.ai_provider_reachable),
        aiProviderStatus: health.ai_provider_status || 'unknown',
        aiProviderMessage: health.ai_provider_message || '',
        model: health.model || config?.model || 'ollama/qwen3.5:4b',
        baseUrl: health.base_url || config?.base_url || 'http://localhost:4000/v1',
        maxMessageLength: config?.max_message_length || 16000,
      });
    } catch {
      setBackendStatus((prev) => ({
        ...prev,
        checking: false,
        discovering: false,
        backendRunning: false,
        aiProviderReachable: false,
        aiProviderStatus: 'backend_unreachable',
        aiProviderMessage:
          'FastAPI backend is not running yet. Start the backend in VS Code terminal.',
      }));
    }
  }, [settings.customBackendUrl]);

  const triggerAutoDiscover = useCallback(async () => {
    setBackendStatus((prev) => ({
      ...prev,
      discovering: true,
      aiProviderMessage: 'Scanning Wi-Fi / LAN for your RTX PC on port 4000...',
    }));
    try {
      const health = await discoverRtxPc(settings.customBackendUrl);
      setBackendStatus((prev) => ({
        ...prev,
        checking: false,
        discovering: false,
        backendRunning: Boolean(health.backend_running),
        apiKeyConfigured: Boolean(health.api_key_configured),
        aiProviderReachable: Boolean(health.ai_provider_reachable),
        aiProviderStatus: health.ai_provider_status || 'unknown',
        aiProviderMessage: health.ai_provider_message || '',
        model: health.model || prev.model,
        baseUrl: health.base_url || prev.baseUrl,
      }));
      return health;
    } catch {
      await refreshBackendStatus();
      return null;
    }
  }, [settings.customBackendUrl, refreshBackendStatus]);

  const quickConnectRtxIp = useCallback(
    async ({ baseUrl, model, apiKey }) => {
      setBackendStatus((prev) => ({
        ...prev,
        checking: true,
        aiProviderMessage: `Connecting to ${baseUrl}...`,
      }));
      try {
        const health = await updateBackendConfig(
          { baseUrl, model, apiKey },
          settings.customBackendUrl
        );
        setBackendStatus((prev) => ({
          ...prev,
          checking: false,
          backendRunning: Boolean(health.backend_running),
          apiKeyConfigured: Boolean(health.api_key_configured),
          aiProviderReachable: Boolean(health.ai_provider_reachable),
          aiProviderStatus: health.ai_provider_status || 'unknown',
          aiProviderMessage: health.ai_provider_message || '',
          model: health.model || prev.model,
          baseUrl: health.base_url || prev.baseUrl,
        }));
        return health;
      } catch {
        await refreshBackendStatus();
        return null;
      }
    },
    [settings.customBackendUrl, refreshBackendStatus]
  );

  useEffect(() => {
    refreshBackendStatus();
  }, [refreshBackendStatus]);

  const createNewChat = useCallback(() => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setErrorState(null);
    setStreamingContent('');
    setActiveId(null);
  }, [isGenerating]);

  const selectConversation = useCallback(
    (id) => {
      if (id === activeId) return;
      if (isGenerating && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setErrorState(null);
      setStreamingContent('');
      setActiveId(id);
    },
    [activeId, isGenerating]
  );

  const renameConversation = useCallback((id, newTitle) => {
    const trimmed = String(newTitle || '').trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === id
          ? { ...conv, title: trimmed.slice(0, 80), updatedAt: new Date().toISOString() }
          : conv
      )
    );
  }, []);

  const deleteConversation = useCallback(
    (id) => {
      setConversations((prev) => {
        const remaining = prev.filter((conv) => conv.id !== id);
        if (activeId === id) {
          setActiveId(remaining.length > 0 ? remaining[0].id : null);
          setErrorState(null);
        }
        return remaining;
      });
    },
    [activeId]
  );

  const clearAllConversations = useCallback(() => {
    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setConversations([]);
    setActiveId(null);
    setErrorState(null);
    setStreamingContent('');
  }, [isGenerating]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const executePrompt = useCallback(
    async ({ promptText, targetConvId, priorMessages, isRetry = false }) => {
      const trimmedPrompt = String(promptText || '').trim();
      if (!trimmedPrompt || isGenerating) return;

      setErrorState(null);
      setStreamingContent('');
      setIsGenerating(true);

      const nowIso = new Date().toISOString();
      let convId = targetConvId;
      let historyForRequest = priorMessages;

      if (!isRetry) {
        const userMessage = {
          id: createId(),
          role: 'user',
          content: trimmedPrompt,
          createdAt: nowIso,
        };

        if (!convId) {
          convId = createId();
          const newConversation = {
            id: convId,
            title: generateConversationTitle(trimmedPrompt),
            createdAt: nowIso,
            updatedAt: nowIso,
            messages: [userMessage],
          };
          historyForRequest = [];
          setConversations((prev) => [newConversation, ...prev]);
          setActiveId(convId);
        } else {
          setConversations((prev) =>
            prev.map((conv) => {
              if (conv.id !== convId) return conv;
              const isFirstUserMsg = conv.messages.length === 0;
              return {
                ...conv,
                title: isFirstUserMsg
                  ? generateConversationTitle(trimmedPrompt)
                  : conv.title,
                updatedAt: nowIso,
                messages: [...conv.messages, userMessage],
              };
            })
          );
        }
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await sendChatMessage({
          message: trimmedPrompt,
          history: historyForRequest,
          systemPrompt: settings.systemPrompt,
          temperature: settings.temperature,
          stream: Boolean(settings.streamResponses),
          onStreamDelta: (partialText) => {
            setStreamingContent(partialText);
          },
          signal: controller.signal,
          customBackendUrl: settings.customBackendUrl,
        });

        const assistantMessage = {
          id: createId(),
          role: 'assistant',
          content: result.reply,
          model: result.model || backendStatus.model,
          createdAt: new Date().toISOString(),
        };

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === convId
              ? {
                  ...conv,
                  updatedAt: new Date().toISOString(),
                  messages: [...conv.messages, assistantMessage],
                }
              : conv
          )
        );
        setStreamingContent('');

        setBackendStatus((prev) => ({
          ...prev,
          backendRunning: true,
          apiKeyConfigured: true,
          aiProviderReachable: true,
          aiProviderStatus: 'connected',
          aiProviderMessage: `Connected (${result.model || prev.model})`,
        }));
      } catch (err) {
        if (err.isAborted) {
          if (err.partialReply && err.partialReply.trim()) {
            const partialMessage = {
              id: createId(),
              role: 'assistant',
              content: `${err.partialReply}\n\n*(Generation stopped)*`,
              model: backendStatus.model,
              createdAt: new Date().toISOString(),
            };
            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === convId
                  ? {
                      ...conv,
                      updatedAt: new Date().toISOString(),
                      messages: [...conv.messages, partialMessage],
                    }
                  : conv
              )
            );
          }
          setStreamingContent('');
        } else {
          setStreamingContent('');
          setErrorState({
            message: err.message || 'Failed to receive a response from the AI model.',
            retryable: err.retryable !== false,
            lastUserPrompt: trimmedPrompt,
            conversationId: convId,
          });
        }
      } finally {
        abortControllerRef.current = null;
        setIsGenerating(false);
      }
    },
    [
      isGenerating,
      settings.systemPrompt,
      settings.temperature,
      settings.streamResponses,
      settings.customBackendUrl,
      backendStatus.model,
    ]
  );

  const sendMessage = useCallback(
    async (text) => {
      const priorMessages = activeConversation ? activeConversation.messages : [];
      await executePrompt({
        promptText: text,
        targetConvId: activeId,
        priorMessages,
        isRetry: false,
      });
    },
    [activeConversation, activeId, executePrompt]
  );

  const retryLastFailed = useCallback(async () => {
    if (!errorState || isGenerating) return;
    const targetConv = conversations.find((c) => c.id === errorState.conversationId);
    if (!targetConv) return;

    const msgs = targetConv.messages;
    const lastIdx = msgs.length - 1;
    const historyWithoutLastUser =
      lastIdx >= 0 && msgs[lastIdx].role === 'user' ? msgs.slice(0, lastIdx) : msgs;

    await executePrompt({
      promptText: errorState.lastUserPrompt,
      targetConvId: targetConv.id,
      priorMessages: historyWithoutLastUser,
      isRetry: true,
    });
  }, [errorState, isGenerating, conversations, executePrompt]);

  const dismissError = useCallback(() => {
    setErrorState(null);
  }, []);

  return {
    conversations,
    activeId,
    activeConversation,
    isGenerating,
    streamingContent,
    errorState,
    backendStatus,
    createNewChat,
    selectConversation,
    renameConversation,
    deleteConversation,
    clearAllConversations,
    sendMessage,
    stopGeneration,
    retryLastFailed,
    dismissError,
    refreshBackendStatus,
    triggerAutoDiscover,
    quickConnectRtxIp,
  };
}
