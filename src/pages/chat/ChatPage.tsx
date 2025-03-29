import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/ProfileContext";
import { useChatActions, useChatList, useCurrentChatId } from "@/hooks/chatStore";
import { ChatTab, CreateChatParams } from "@/schema/chat-schema";
import { useLocalChatTabs } from "@/utils/local-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatTabs } from "./ChatTabs";
import { GridLayout } from "./components/GridLayout";

export default function Chat() {
  // Get the current profile ID - replace this with your actual method of getting the profile ID
  const { currentProfile } = useProfile();
  const profileId = currentProfile!.id;

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);

  // Use memoized version of openTabIds state
  const [openTabIds, setOpenTabIds] = useLocalChatTabs(profileId);

  // Get chat data from the store
  const chatList = useChatList();
  const selectedChatID = useCurrentChatId();

  // Get chat actions from the store
  const { setSelectedChatById, createChat } = useChatActions();

  useEffect(() => {
    // Early return if we already have a selected chat or no tabs
    if (selectedChatID || openTabIds.length === 0) {
      setIsLoading(false);
      return;
    }

    // Otherwise, select the first tab
    setSelectedChatById(openTabIds[0]);
    setIsLoading(false);
  }, [selectedChatID, openTabIds]);

  // Memoize tabs to prevent unnecessary recalculations
  const tabs = useMemo(() => {
    if (chatList.length === 0 || openTabIds.length === 0) {
      return [];
    }

    return openTabIds
      .map((tabId) => {
        const chat = chatList.find((chat) => chat.id === tabId);
        if (chat) {
          return {
            id: chat.id,
            name: chat.name,
          };
        }
        return null;
      })
      .filter(Boolean) as ChatTab[];
  }, [openTabIds, chatList]);

  // Handle creating a new chat with useCallback
  const handleNewChat = useCallback(async () => {
    try {
      const newChatData: CreateChatParams = {
        profile_id: profileId,
        name: `New Chat ${chatList.length + 1}`,
        participants: [],
        user_character_settings: [],
      };

      const newChat = await createChat(newChatData);

      // Batch these updates together
      const updatedTabs = [...openTabIds, newChat.id];
      setOpenTabIds(updatedTabs);
      setSelectedChatById(newChat.id);
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  }, [profileId, chatList.length, createChat, setOpenTabIds, setSelectedChatById, openTabIds]);

  // Handle changing the active tab with useCallback
  const handleTabChange = useCallback(
    (tabId: string) => {
      setSelectedChatById(tabId);
    },
    [setSelectedChatById],
  );

  // Handle closing a tab with useCallback
  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const newOpenTabIds = openTabIds.filter((id) => id !== tabId);

      // If we closed the selected tab, select the last remaining tab
      if (selectedChatID === tabId && newOpenTabIds.length > 0) {
        setSelectedChatById(newOpenTabIds[newOpenTabIds.length - 1]);
      }

      setOpenTabIds(newOpenTabIds);
    },
    [selectedChatID, setOpenTabIds, setSelectedChatById, openTabIds],
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-6 w-24 bg-muted rounded mb-4" />
          <div className="h-10 w-40 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {tabs.length > 0 ? (
        <>
          <ChatTabs
            tabs={tabs}
            activeTab={selectedChatID || ""}
            onTabChange={handleTabChange}
            onNewChat={handleNewChat}
            onCloseTab={handleCloseTab}
          />
          <div className="flex-1">{selectedChatID && <GridLayout tabId={selectedChatID} />}</div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-muted-foreground">No active chat. Create a new one to get started.</p>
            <Button onClick={handleNewChat}>Create New Chat</Button>
          </div>
        </div>
      )}
    </div>
  );
}
