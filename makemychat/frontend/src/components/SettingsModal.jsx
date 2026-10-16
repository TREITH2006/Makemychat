import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Monitor,
  Moon,
  Radar,
  RefreshCw,
  Save,
  Server,
  ShieldAlert,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { updateBackendConfig } from '../api';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  backendStatus,
  onRefreshStatus,
  onAutoDiscover,
  onClearAllHistory,
  conversationCount,
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState(backendStatus.baseUrl || 'http://localhost:4000/v1');
  const [modelInput, setModelInput] = useState(backendStatus.model || 'ollama/qwen3.5:4b');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setConfirmClear(false);
      setSaveFeedback('');
      return;
    }
    setBaseUrlInput(backendStatus.baseUrl || 'http://localhost:4000/v1');
    setModelInput(backendStatus.model || 'ollama/qwen3.5:4b');
    setApiKeyInput('');

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, backendStatus.baseUrl, backendStatus.model]);

  if (!isOpen) return null;

  const setTheme = (theme) => {
    onUpdateSettings({ ...settings, theme });
  };

  const handleSaveBackendConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setSaveFeedback('');
    try {
      await updateBackendConfig(
        {
          baseUrl: baseUrlInput.trim(),
          apiKey: apiKeyInput.trim() || undefined,
          model: modelInput.trim(),
        },
        settings.customBackendUrl
      );
      setApiKeyInput('');
      setSaveFeedback('Saved to backend/.env and tested connection.');
      await onRefreshStatus();
    } catch (err) {
      setSaveFeedback(err.message || 'Could not save settings to backend.');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="settings-modal-title" className="modal-title">
            MakeMyChat Settings &amp; RTX Connection
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Theme Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>
            <div className="theme-selector-grid">
              <button
                type="button"
                className={`theme-option-btn ${settings.theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                <Sun size={17} />
                <span>Light</span>
              </button>
              <button
                type="button"
                className={`theme-option-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                <Moon size={17} />
                <span>Dark</span>
              </button>
              <button
                type="button"
                className={`theme-option-btn ${settings.theme === 'system' ? 'active' : ''}`}
                onClick={() => setTheme('system')}
              >
                <Monitor size={17} />
                <span>System</span>
              </button>
            </div>
          </section>

          {/* AI Provider & Backend Status Section */}
          <section className="settings-section">
            <div className="settings-section-header-row">
              <div>
                <h3 className="settings-section-title">RTX PC &amp; LiteLLM Connection</h3>
                <p className="settings-section-desc">
                  Pre-configured with your API key (<code>sk-L1GxiYsyRuDOK-7nUs0j8g</code>) and model (<code>ollama/qwen3.5:4b</code>).
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={onAutoDiscover}
                  disabled={backendStatus.discovering}
                >
                  <Radar size={14} className={backendStatus.discovering ? 'spin' : ''} />
                  <span>Auto-Find RTX PC</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={onRefreshStatus}
                  disabled={backendStatus.checking}
                >
                  <RefreshCw size={14} className={backendStatus.checking ? 'spin' : ''} />
                  <span>Test</span>
                </button>
              </div>
            </div>

            <div className="status-cards-grid">
              <div className="status-info-card">
                <div className="status-card-top">
                  <Server size={15} className="status-card-icon" />
                  <span className="status-card-label">FastAPI Backend</span>
                </div>
                <div className="status-card-value">
                  {backendStatus.backendRunning ? (
                    <span className="badge-ok">
                      <CheckCircle2 size={14} /> Online
                    </span>
                  ) : (
                    <span className="badge-err">
                      <ShieldAlert size={14} /> Unreachable
                    </span>
                  )}
                </div>
              </div>

              <div className="status-info-card">
                <div className="status-card-top">
                  <Cpu size={15} className="status-card-icon" />
                  <span className="status-card-label">AI Server Status</span>
                </div>
                <div className="status-card-value">
                  {backendStatus.aiProviderReachable ? (
                    <span className="badge-ok">
                      <CheckCircle2 size={14} /> Connected
                    </span>
                  ) : (
                    <span className="badge-warn">
                      <ShieldAlert size={14} /> {backendStatus.aiProviderStatus}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <form className="config-details-box" onSubmit={handleSaveBackendConfig}>
              <div className="settings-field">
                <label htmlFor="litellm-base-url" className="settings-label">
                  RTX PC URL or IP (<code>OPENAI_BASE_URL</code>)
                </label>
                <input
                  id="litellm-base-url"
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="e.g. 192.168.1.5 or http://192.168.1.5:4000/v1"
                  className="settings-input"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="litellm-api-key" className="settings-label">
                  LiteLLM API Key (<code>OPENAI_API_KEY</code>)
                </label>
                <input
                  id="litellm-api-key"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Pre-loaded: sk-L1GxiYsyRuDOK-7nUs0j8g (leave blank to keep)"
                  className="settings-input"
                  autoComplete="off"
                />
              </div>

              <div className="settings-field">
                <label htmlFor="litellm-model" className="settings-label">
                  Model Identifier (<code>AI_MODEL</code>)
                </label>
                <input
                  id="litellm-model"
                  type="text"
                  value={modelInput}
                  onChange={(e) => setModelInput(e.target.value)}
                  placeholder="ollama/qwen3.5:4b"
                  className="settings-input"
                />
              </div>

              <div className="settings-section-header-row">
                <span className="settings-hint">{saveFeedback || backendStatus.aiProviderMessage}</span>
                <button
                  type="submit"
                  className="retry-btn"
                  disabled={savingConfig || !backendStatus.backendRunning}
                >
                  <Save size={14} />
                  <span>{savingConfig ? 'Saving...' : 'Save & Connect'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Chat Preferences */}
          <section className="settings-section">
            <h3 className="settings-section-title">Generation Preferences</h3>

            <label className="settings-toggle-row">
              <div className="settings-toggle-info">
                <span className="settings-label">Stream AI responses</span>
                <span className="settings-hint">
                  Display tokens live as Qwen generates them.
                </span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings.streamResponses)}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    streamResponses: e.target.checked,
                  })
                }
                className="settings-checkbox"
              />
            </label>

            <div className="settings-field">
              <div className="settings-field-header">
                <label htmlFor="temp-slider" className="settings-label">
                  Temperature
                </label>
                <span className="settings-value-badge">
                  {Number(settings.temperature ?? 0.7).toFixed(1)}
                </span>
              </div>
              <input
                id="temp-slider"
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={settings.temperature ?? 0.7}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="settings-range"
              />
            </div>
          </section>

          {/* Conversation Data Section */}
          <section className="settings-section settings-section-last">
            <h3 className="settings-section-title">Conversation History</h3>
            {!confirmClear ? (
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => setConfirmClear(true)}
                disabled={conversationCount === 0}
              >
                <Trash2 size={15} />
                <span>Clear All Conversation History ({conversationCount})</span>
              </button>
            ) : (
              <div className="clear-confirm-inline">
                <span>Delete all saved chats?</span>
                <div className="clear-confirm-buttons">
                  <button
                    type="button"
                    className="btn-danger-sm"
                    onClick={() => {
                      onClearAllHistory();
                      setConfirmClear(false);
                    }}
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => setConfirmClear(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
