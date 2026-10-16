/**
 * Browser localStorage persistence utilities for MakeMyChat.
 */

const STORAGE_KEYS = {
  CONVERSATIONS: 'makemychat_conversations_v1',
  ACTIVE_ID: 'makemychat_active_conversation_id_v1',
  SETTINGS: 'makemychat_settings_v1',
};

export const DEFAULT_SETTINGS = {
  theme: 'system',
  streamResponses: false,
  temperature: 0.7,
  systemPrompt: '',
  customBackendUrl: '',
};

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateConversationTitle(firstMessage = '') {
  const cleaned = String(firstMessage || '')
    .replace(/```[\s\S]*?```/g, '[Code]')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return 'New Conversation';
  }
  if (cleaned.length <= 42) {
    return cleaned;
  }
  const truncated = cleaned.slice(0, 42);
  const lastSpace = truncated.lastIndexOf(' ');
  return `${lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated}...`;
}

export function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        Array.isArray(item.messages)
    );
  } catch {
    return [];
  }
}

export function saveConversations(conversations) {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadActiveConversationId() {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || null;
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
    }
  } catch {
    // Ignore
  }
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...settings })
    );
  } catch {
    // Ignore
  }
}
