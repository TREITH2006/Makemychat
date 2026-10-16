import React, { useState } from 'react';
import { Bot, Check, Copy, User } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

function formatTime(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function MessageBubble({ message, isStreaming = false }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  if (isUser) {
    return (
      <div className="message-row message-row-user">
        <div className="message-user-card">
          <div className="message-user-content">{message.content}</div>
          <div className="message-user-meta">
            {message.createdAt && (
              <span className="message-time">{formatTime(message.createdAt)}</span>
            )}
            <button
              type="button"
              className="msg-action-btn"
              onClick={handleCopy}
              title="Copy prompt"
              aria-label="Copy prompt"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>
        <div className="message-avatar avatar-user" aria-hidden="true">
          <User size={16} />
        </div>
      </div>
    );
  }

  return (
    <div className="message-row message-row-assistant">
      <div className="message-avatar avatar-assistant" aria-hidden="true">
        <Bot size={17} />
      </div>

      <div className="message-assistant-card">
        <div className="message-assistant-header">
          <span className="assistant-name">MakeMyChat AI</span>
          {message.model && (
            <span className="assistant-model-tag">{message.model}</span>
          )}
          {message.createdAt && (
            <span className="message-time">{formatTime(message.createdAt)}</span>
          )}
        </div>

        <div className="message-assistant-body">
          <MarkdownRenderer content={message.content} />
          {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
        </div>

        {!isStreaming && (
          <div className="message-assistant-footer">
            <button
              type="button"
              className={`copy-response-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopy}
              aria-label="Copy AI response"
            >
              {copied ? (
                <>
                  <Check size={14} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy response</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
