import React from 'react';
import {
  Cpu,
  Moon,
  PanelLeftOpen,
  Plus,
  Settings,
  Sun,
} from 'lucide-react';

export default function Header({
  activeTitle,
  isSidebarOpen,
  onToggleSidebar,
  onNewChat,
  onOpenSettings,
  resolvedTheme,
  onToggleQuickTheme,
  backendStatus,
}) {
  const statusColorClass =
    backendStatus.checking || backendStatus.discovering
      ? 'status-dot-checking'
      : backendStatus.aiProviderReachable
      ? 'status-dot-connected'
      : backendStatus.backendRunning
      ? 'status-dot-warning'
      : 'status-dot-error';

  return (
    <header className="app-header">
      <div className="header-left">
        {!isSidebarOpen && (
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleSidebar}
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <PanelLeftOpen size={19} />
          </button>
        )}

        <button
          type="button"
          className="icon-btn mobile-menu-btn"
          onClick={onToggleSidebar}
          title="Toggle navigation menu"
          aria-label="Toggle navigation menu"
        >
          <PanelLeftOpen size={19} />
        </button>

        <div className="header-title-group">
          <h1 className="header-title">
            {activeTitle || 'MakeMyChat'}
          </h1>
        </div>
      </div>

      <div className="header-right">
        <button
          type="button"
          className="model-badge-btn"
          onClick={onOpenSettings}
          title={backendStatus.aiProviderMessage || 'Click to view connection and model settings'}
        >
          <span className={`status-dot ${statusColorClass}`} />
          <Cpu size={14} className="model-badge-icon" />
          <span className="model-badge-name">{backendStatus.model}</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onNewChat}
          title="New Chat"
          aria-label="Start new chat"
        >
          <Plus size={18} />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onToggleQuickTheme}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle color theme"
        >
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Open settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
