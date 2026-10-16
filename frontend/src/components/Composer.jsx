import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';

export default function Composer({
  onSendMessage,
  onStopGeneration,
  isGenerating,
  maxMessageLength = 16000,
}) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${nextHeight}px`;
  }, [input]);

  const trimmed = input.trim();
  const isOverLimit = input.length > maxMessageLength;
  const canSend = trimmed.length > 0 && !isGenerating && !isOverLimit;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!canSend) return;
    const textToSend = input;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(textToSend);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSubmit();
      }
    }
  };

  return (
    <footer className="composer-container">
      <div className="composer-inner">
        <form className="composer-box" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask MakeMyChat anything... (Enter to send, Shift+Enter for new line)"
            className="composer-textarea"
            aria-label="Message input"
          />

          <div className="composer-actions">
            {input.length > maxMessageLength * 0.8 && (
              <span
                className={`char-counter ${isOverLimit ? 'over-limit' : ''}`}
                title="Character count"
              >
                {input.length.toLocaleString()} / {maxMessageLength.toLocaleString()}
              </span>
            )}

            {isGenerating ? (
              <button
                type="button"
                className="stop-btn"
                onClick={onStopGeneration}
                title="Stop generating response"
                aria-label="Stop generating response"
              >
                <Square size={14} fill="currentColor" />
                <span>Stop Generating</span>
              </button>
            ) : (
              <button
                type="submit"
                className="send-btn"
                disabled={!canSend}
                title={canSend ? 'Send message (Enter)' : 'Enter a message to send'}
                aria-label="Send message"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </form>

        <div className="composer-footnote">
          <span>
            MakeMyChat &middot; Enter to send &middot; Shift+Enter for newline &middot; Connected via LiteLLM / Ollama
          </span>
        </div>
      </div>
    </footer>
  );
}
