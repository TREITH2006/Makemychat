import React, { useState } from 'react';
import {
  Check,
  Edit3,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';

export default function Sidebar({
  conversations,
  activeId,
  isOpen,
  onToggleSidebar,
  onCloseMobileSidebar,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onClearAll,
  onOpenSettings,
  backendStatus,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const filteredConversations = conversations.filter((conv) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    if (conv.title.toLowerCase().includes(q)) return true;
    return conv.messages.some((m) => m.content.toLowerCase().includes(q));
  });

  const startEditing = (e, conv) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
  };

  const commitRename = (e, id) => {
    if (e) e.stopPropagation();
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle('');
  };

  const cancelRename = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
    setEditingTitle('');
  };

  const handleSelect = (id) => {
    onSelectConversation(id);
    onCloseMobileSidebar();
  };

  const handleNewChatClick = () => {
    onNewChat();
    onCloseMobileSidebar();
  };

  const statusColorClass =
    backendStatus.checking || backendStatus.discovering
      ? 'status-dot-checking'
      : backendStatus.aiProviderReachable
      ? 'status-dot-connected'
      : backendStatus.backendRunning
      ? 'status-dot-warning'
      : 'status-dot-error';

  const statusLabel =
    backendStatus.checking || backendStatus.discovering
      ? 'Scanning...'
      : backendStatus.aiProviderReachable
      ? 'AI Connected'
      : !backendStatus.backendRunning
      ? 'Backend Offline'
      : 'Enter RTX IP';

  return (
    <>
      {isOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobileSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-collapsed'}`}
        aria-label="Conversation history and navigation"
      >
        <div className="sidebar-header">
          <div
            className="brand-identity"
            onClick={handleNewChatClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleNewChatClick()}
          >
            <div className="brand-logo" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none" className="brand-logo-svg">
                <rect width="28" height="28" rx="7" fill="currentColor" />
                <path
                  d="M7.5 10.2C7.5 8.98497 8.48497 8 9.7 8H18.3C19.515 8 20.5 8.98497 20.5 10.2V15.8C20.5 17.015 19.515 18 18.3 18H13.2L9.5 20.8V18H9.7C8.48497 18 7.5 17.015 7.5 15.8V10.2Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="11.8" cy="13" r="1.15" fill="white" />
                <circle cx="16.2" cy="13" r="1.15" fill="white" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-name">MakeMyChat</span>
              <span className="brand-tag">RTX AI</span>
            </div>
          </div>

          <button
            type="button"
            className="icon-btn sidebar-collapse-btn"
            onClick={onToggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <div className="sidebar-actions">
          <button
            type="button"
            className="new-chat-btn"
            onClick={handleNewChatClick}
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>

          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="search-input"
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="conversation-list-header">
          <span className="section-label">
            Conversations ({conversations.length})
          </span>
          {conversations.length > 0 && !confirmClearAll && (
            <button
              type="button"
              className="clear-all-link"
              onClick={() => setConfirmClearAll(true)}
              title="Clear all conversations"
            >
              Clear all
            </button>
          )}
        </div>

        {confirmClearAll && (
          <div className="clear-confirm-banner">
            <span>Delete all saved chats?</span>
            <div className="clear-confirm-actions">
              <button
                type="button"
                className="btn-danger-sm"
                onClick={() => {
                  onClearAll();
                  setConfirmClearAll(false);
                }}
              >
                Delete
              </button>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setConfirmClearAll(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="conversation-list" role="list">
          {filteredConversations.length === 0 ? (
            <div className="empty-conversations">
              <MessageSquare size={22} className="empty-conv-icon" />
              <p>
                {searchQuery
                  ? 'No conversations match your search.'
                  : 'No saved conversations yet.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === activeId;
              const isEditing = conv.id === editingId;

              return (
                <div
                  key={conv.id}
                  role="listitem"
                  className={`conversation-item ${isSelected ? 'active' : ''}`}
                  onClick={() => !isEditing && handleSelect(conv.id)}
                >
                  <MessageSquare size={16} className="conv-item-icon" />

                  {isEditing ? (
                    <div
                      className="conv-rename-row"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        className="conv-rename-input"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(e, conv.id);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                        autoFocus
                        maxLength={80}
                        aria-label="Edit conversation title"
                      />
                      <button
                        type="button"
                        className="conv-action-btn save"
                        onClick={(e) => commitRename(e, conv.id)}
                        title="Save title"
                        aria-label="Save title"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className="conv-action-btn"
                        onClick={cancelRename}
                        title="Cancel rename"
                        aria-label="Cancel rename"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="conv-title" title={conv.title}>
                        {conv.title}
                      </span>
                      <div className="conv-item-actions">
                        <button
                          type="button"
                          className="conv-action-btn"
                          onClick={(e) => startEditing(e, conv)}
                          title="Rename conversation"
                          aria-label="Rename conversation"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          className="conv-action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          title="Delete conversation"
                          aria-label="Delete conversation"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-settings-btn"
            onClick={onOpenSettings}
          >
            <div className="sidebar-settings-left">
              <Settings size={17} />
              <span>Settings</span>
            </div>
            <div className="sidebar-status-pill" title={backendStatus.aiProviderMessage}>
              <span className={`status-dot ${statusColorClass}`} />
              <span className="status-pill-text">{statusLabel}</span>
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
