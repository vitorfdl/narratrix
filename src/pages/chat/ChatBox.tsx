import { Button } from "@/components/ui/button";
import type { Chat } from "@/schema/chat-schema";
import { ChatTab } from "@/schema/chat-schema";
import { FC } from "react";
import { ChatTabs } from "./ChatTabs";
import { ChatMenuDropdown } from "./components/ChatMenuDropdown";
import { GridLayout } from "./components/GridLayout";

interface ChatboxProps {
  tabs: ChatTab[];
  allChats: Chat[];
  profileId: string;
  selectedChatID: string | null;
  openTabIds: string[];
  handleTabChange: (tabId: string) => void;
  handleNewChat: () => void;
  handleCloseTab: (tabId: string) => void;
  handleRenameRequest: (tabId: string) => void;
  handleDuplicateRequest: (tabId: string) => void;
  handleDeleteRequest: (tabId: string) => void;
}

export const Chatbox: FC<ChatboxProps> = ({
  tabs,
  allChats,
  profileId,
  selectedChatID,
  openTabIds,
  handleTabChange,
  handleNewChat,
  handleCloseTab,
  handleRenameRequest,
  handleDuplicateRequest,
  handleDeleteRequest,
}) => {
  if (tabs.length > 0) {
    return (
      <>
        <ChatTabs
          tabs={tabs}
          allChats={allChats}
          profileId={profileId}
          activeTab={selectedChatID || ""}
          onTabChange={handleTabChange}
          onNewChat={handleNewChat}
          onCloseTab={handleCloseTab}
          onRenameRequest={handleRenameRequest}
          onDuplicateRequest={handleDuplicateRequest}
          onDeleteRequest={handleDeleteRequest}
        />
        <div className="flex-1 overflow-hidden">{selectedChatID && <GridLayout tabId={selectedChatID} />}</div>
      </>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <p className="mb-4 text-muted-foreground">No active chat. Create a new one to get started.</p>
        {allChats.length > 0 ? (
          <ChatMenuDropdown
            profileId={profileId}
            allChats={allChats}
            openChatIds={openTabIds}
            onSelectChat={handleTabChange}
            onCreateChat={handleNewChat}
            onRenameRequest={handleRenameRequest}
            onDuplicateRequest={handleDuplicateRequest}
            onDeleteRequest={handleDeleteRequest}
          >
            <Button>Create New Chat</Button>
          </ChatMenuDropdown>
        ) : (
          <Button onClick={handleNewChat}>Create New Chat</Button>
        )}
      </div>
    </div>
  );
};
