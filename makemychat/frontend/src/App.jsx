import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatArea from './components/ChatArea';
import Composer from './components/Composer';
import SettingsModal from './components/SettingsModal';
import { useTheme } from './hooks/useTheme';
import { useChat } from './hooks/useChat';
import { loadSettings, saveSettings } from './utils/storage';

export default function App() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 900 : true
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const resolvedTheme = useTheme(settings.theme);

  const {
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
  } = useChat(settings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const handleUpdateSettings = (nextSettings) => {
    setSettings(nextSettings);
  };

  const handleToggleQuickTheme = () => {
    const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setSettings((prev) => ({ ...prev, theme: nextTheme }));
  };

  const handleCloseMobileSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      setIsSidebarOpen(false);
    }
  };

  const activeMessages = activeConversation ? activeConversation.messages : [];
  const activeTitle = activeConversation ? activeConversation.title : 'MakeMyChat';

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onCloseMobileSidebar={handleCloseMobileSidebar}
        onNewChat={createNewChat}
        onSelectConversation={selectConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onClearAll={clearAllConversations}
        onOpenSettings={() => setIsSettingsOpen(true)}
        backendStatus={backendStatus}
      />

      <div className="main-workspace">
        <Header
          activeTitle={activeTitle}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onNewChat={createNewChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          resolvedTheme={resolvedTheme}
          onToggleQuickTheme={handleToggleQuickTheme}
          backendStatus={backendStatus}
        />

        <ChatArea
          messages={activeMessages}
          isGenerating={isGenerating}
          streamingContent={streamingContent}
          errorState={errorState}
          backendStatus={backendStatus}
          onSelectPrompt={(prompt) => sendMessage(prompt)}
          onRetry={retryLastFailed}
          onDismissError={dismissError}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onAutoDiscover={triggerAutoDiscover}
          onQuickConnect={quickConnectRtxIp}
        />

        <Composer
          onSendMessage={sendMessage}
          onStopGeneration={stopGeneration}
          isGenerating={isGenerating}
          maxMessageLength={backendStatus.maxMessageLength}
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        backendStatus={backendStatus}
        onRefreshStatus={refreshBackendStatus}
        onAutoDiscover={triggerAutoDiscover}
        onClearAllHistory={clearAllConversations}
        conversationCount={conversations.length}
      />
    </div>
  );
}
