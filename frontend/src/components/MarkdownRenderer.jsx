import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function escapeHtml(raw = '') {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const renderer = new marked.Renderer();

renderer.code = function ({ text, lang }) {
  const safeLang = escapeHtml((lang || 'text').trim().split(/\s+/)[0] || 'code');
  const escapedCode = escapeHtml(text || '');
  const encodedRaw = encodeURIComponent(text || '');

  return `
    <div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-lang-label">${safeLang}</span>
        <button type="button" class="code-copy-btn" data-code="${encodedRaw}" aria-label="Copy code snippet">
          Copy code
        </button>
      </div>
      <pre class="code-block-pre"><code class="language-${safeLang}">${escapedCode}</code></pre>
    </div>
  `;
};

renderer.link = function ({ href, title, text }) {
  const safeHref = href && /^(https?:\/\/|mailto:)/i.test(href) ? escapeHtml(href) : '#';
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
});

function preprocessReasoningBlocks(rawText = '') {
  if (!rawText) return '';

  let processed = rawText.replace(
    /<think>([\s\S]*?)<\/think>/gi,
    (_match, inner) => {
      const trimmed = inner.trim();
      if (!trimmed) return '';
      const innerHtml = marked.parse(trimmed);
      return `<details class="reasoning-details"><summary class="reasoning-summary">Thought process</summary><div class="reasoning-content">${innerHtml}</div></details>\n\n`;
    }
  );

  const openThinkIndex = processed.search(/<think>/i);
  if (openThinkIndex !== -1) {
    const before = processed.slice(0, openThinkIndex);
    const thinkingPart = processed.slice(openThinkIndex + 7).trim();
    const innerHtml = thinkingPart ? marked.parse(thinkingPart) : '<em>Thinking...</em>';
    processed = `${before}\n\n<details class="reasoning-details" open><summary class="reasoning-summary">Thinking...</summary><div class="reasoning-content">${innerHtml}</div></details>`;
  }

  return processed;
}

export default function MarkdownRenderer({ content }) {
  const sanitizedHtml = useMemo(() => {
    const withReasoning = preprocessReasoningBlocks(content || '');
    const rawHtml = marked.parse(withReasoning);
    return DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ['details', 'summary', 'button'],
      ADD_ATTR: ['target', 'rel', 'data-code', 'type', 'open', 'aria-label', 'class'],
    });
  }, [content]);

  const handleContainerClick = async (e) => {
    const copyBtn = e.target.closest('.code-copy-btn');
    if (!copyBtn) return;

    const encoded = copyBtn.getAttribute('data-code');
    if (!encoded) return;

    try {
      const decoded = decodeURIComponent(encoded);
      await navigator.clipboard.writeText(decoded);
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = originalText || 'Copy code';
        copyBtn.classList.remove('copied');
      }, 1800);
    } catch {
      copyBtn.textContent = 'Failed';
    }
  };

  return (
    <div
      className="markdown-body"
      onClick={handleContainerClick}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
