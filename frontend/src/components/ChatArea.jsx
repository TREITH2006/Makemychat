import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  Code2,
  Compass,
  FileText,
  Radar,
  RefreshCw,
  Sparkles,
  Terminal,
  Wifi,
  X,
} from 'lucide-react';
import MessageBubble from './MessageBubble';

const EXAMPLE_PROMPTS = [
  {
    icon: Code2,
    title: 'Write a clean Python utility',
    prompt:
      'Write a clean, well-documented Python script that monitors a directory for new JSON files, validates their schema, and logs summary statistics.',
  },
  {
    icon: Compass,
    title: 'Explain a technical concept',
    prompt:
      'Explain how attention mechanisms in transformer models work using a clear intuition and a compact mathematical breakdown.',
  },
  {
    icon: Terminal,
    title: 'Debug and optimize SQL',
    prompt:
      'Show me 5 practical ways to diagnose and speed up a slow SQL query on a table with 10 million rows, with concrete examples.',
  },
  {
    icon: FileText,
    title: 'Draft a project architecture plan',
    prompt:
      'Design a lightweight, maintainable system architecture for a local desktop productivity tool with offline storage and fast search.',
  },
];

export default function ChatArea({
  messages,
  isGenerating,
  streamingContent,
  errorState,
  backendStatus,
  onSelectPrompt,
  onRetry,
  onDismissError,
  onOpenSettings,
  onAutoDiscover,
  onQuickConnect,
}) {
  const containerRef = useRef(null);
  const bottomAnchorRef = useRef(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [rtxIpInput, setRtxIpInput] = useState('');

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distanceFromBottom > 140);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior, block: 'end' });
      setUserScrolledUp(false);
    }
  };

  useEffect(() => {
    if (!userScrolledUp) {
      scrollToBottom(streamingContent ? 'auto' : 'smooth');
    }
  }, [messages.length, streamingContent, isGenerating, userScrolledUp]);

  const handleIpSubmit = (e) => {
    e.preventDefault();
    if (!rtxIpInput.trim()) return;
    onQuickConnect({
      baseUrl: rtxIpInput.trim(),
      model: 'ollama/qwen3.5:4b',
    });
  };

  const hasMessages = messages && messages.length > 0;

  return (
    <main
      ref={containerRef}
      className="chat-area"
      onScroll={handleScroll}
      aria-live="polite"
    >
      <div className="chat-area-inner">
        {/* Connected Status Pill OR Quick-Connect Bar for RTX PC */}
        {backendStatus.aiProviderReachable ? (
          <div className="connected-bar">
            <div className="connected-bar-left">
              <CheckCircle2 size={16} className="connected-bar-icon" />
              <span>
                Connected to <strong>{backendStatus.model}</strong> at{' '}
                <code>{backendStatus.baseUrl}</code> (API key pre-loaded)
              </span>
            </div>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={onOpenSettings}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="rtx-connect-card" role="status">
            <div className="rtx-connect-top">
              <div className="rtx-connect-title-row">
                <Wifi size={18} className="connection-notice-icon" />
                <div>
                  <strong>Connect Laptop to Your RTX PC (API Key Pre-Loaded)</strong>
                  <p className="rtx-connect-sub">
                    Your key (<code>sk-L1Gxi...0j8g</code>) and model (<code>ollama/qwen3.5:4b</code>) are already pre-configured.
                    {backendStatus.aiProviderMessage ? ` ${backendStatus.aiProviderMessage}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="rtx-connect-actions">
              <button
                type="button"
                className="rtx-discover-btn"
                onClick={onAutoDiscover}
                disabled={backendStatus.discovering || !backendStatus.backendRunning}
              >
                <Radar size={15} className={backendStatus.discovering ? 'spin' : ''} />
                <span>
                  {backendStatus.discovering
                    ? 'Scanning Wi-Fi for RTX PC...'
                    : 'Auto-Find RTX PC on Wi-Fi'}
                </span>
              </button>

              <form className="rtx-ip-form" onSubmit={handleIpSubmit}>
                <input
                  type="text"
                  value={rtxIpInput}
                  onChange={(e) => setRtxIpInput(e.target.value)}
                  placeholder="Or enter RTX PC IP (e.g. 192.168.1.5)"
                  className="rtx-ip-input"
                />
                <button
                  type="submit"
                  className="btn-secondary-sm"
                  disabled={!rtxIpInput.trim() || !backendStatus.backendRunning}
                >
                  Connect RTX IP
                </button>
              </form>
            </div>
          </div>
        )}

        {!hasMessages ? (
          <section className="welcome-screen">
            <div className="welcome-hero">
              <div className="welcome-badge">
                <Sparkles size={15} />
                <span>MakeMyChat &middot; {backendStatus.model}</span>
              </div>
              <h2 className="welcome-heading">What can I help you with?</h2>
              <p className="welcome-subtitle">
                Ask questions, write and debug code, analyze technical topics, or
                brainstorm ideas directly with your Qwen AI model.
              </p>
            </div>

            <div className="example-prompts-grid">
              {EXAMPLE_PROMPTS.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="example-prompt-card"
                    onClick={() => onSelectPrompt(item.prompt)}
                    disabled={isGenerating}
                  >
                    <div className="example-prompt-icon">
                      <IconComponent size={18} />
                    </div>
                    <div className="example-prompt-body">
                      <span className="example-prompt-title">{item.title}</span>
                      <span className="example-prompt-preview">{item.prompt}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="messages-list">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isGenerating && streamingContent && (
              <MessageBubble
                message={{
                  id: 'streaming-temp',
                  role: 'assistant',
                  content: streamingContent,
                  model: backendStatus.model,
                }}
                isStreaming={true}
              />
            )}

            {isGenerating && !streamingContent && (
              <div className="loading-indicator-row" role="status" aria-label="Waiting for AI response">
                <div className="loading-avatar">
                  <Sparkles size={16} />
                </div>
                <div className="loading-bubble">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="loading-text">
                    Generating response from {backendStatus.model}...
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {errorState && (
          <div className="error-banner" role="alert">
            <div className="error-banner-main">
              <AlertCircle size={18} className="error-banner-icon" />
              <div className="error-banner-text">
                <strong>Request failed</strong>
                <p>{errorState.message}</p>
              </div>
            </div>
            <div className="error-banner-actions">
              <button
                type="button"
                className="retry-btn"
                onClick={onRetry}
                disabled={isGenerating}
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
              <button
                type="button"
                className="icon-btn error-dismiss-btn"
                onClick={onDismissError}
                title="Dismiss error"
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div ref={bottomAnchorRef} className="scroll-anchor" />
      </div>

      {userScrolledUp && hasMessages && (
        <button
          type="button"
          className="scroll-bottom-btn"
          onClick={() => scrollToBottom('smooth')}
          title="Scroll to latest message"
          aria-label="Scroll to latest message"
        >
          <ArrowDown size={16} />
          <span>Latest</span>
        </button>
      )}
    </main>
  );
}
