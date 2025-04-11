import { LiveInspector } from "@/components/liveInspector/LiveInspector";
import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog";
import { EditNameDialog } from "@/components/shared/EditNameDialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useProfile } from "@/hooks/ProfileContext";
import { useChatActions, useChatList, useChatStore, useCurrentChatId } from "@/hooks/chatStore";
import type { Chat } from "@/schema/chat-schema";
import { ChatTab, CreateChatParams } from "@/schema/chat-schema";
import { getChatById, listChats } from "@/services/chat-service";
import { useLocalChatTabs } from "@/utils/local-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChatTabs } from "./ChatTabs";
import { ChatMenuDropdown } from "./components/ChatMenuDropdown";
import { GridLayout } from "./components/GridLayout";

export default function ChatPage() {
  // Get the current profile ID - replace this with your actual method of getting the profile ID
  const { currentProfile } = useProfile();
  const profileId = currentProfile!.id;

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);
  // State for storing all available chats
  const [allChats, setAllChats] = useState<Chat[]>([]);

  // Use memoized version of openTabIds state
  const [openTabIds, setOpenTabIds] = useLocalChatTabs(profileId);

  // Get chat data from the store
  const chatList = useChatList();
  const selectedChatID = useCurrentChatId();

  // Get chat actions from the store
  const { setSelectedChatById, createChat, updateSelectedChat, deleteChat } = useChatActions();

  // State for rename dialog
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [chatToRenameId, setChatToRenameId] = useState<string | null>(null);
  const [newChatName, setNewChatName] = useState("");

  // State for delete confirmation dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [chatToDeleteId, setChatToDeleteId] = useState<string | null>(null);

  // State for Live Inspector Drawer
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Fetch all chats when component mounts
  useEffect(() => {
    const loadAllChats = async () => {
      try {
        const chats = await listChats({ profile_id: profileId });
        setAllChats(chats);
      } catch (error) {
        console.error("Failed to load all chats:", error);
      }
    };

    loadAllChats();
  }, [profileId]);

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

  // Effect for handling keyboard shortcut to toggle Live Inspector
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl + ' or Cmd + '
      if (event.key === "'" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent browser find or other default actions
        setIsInspectorOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup listener on component unmount
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

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

      // Refresh the list of all chats
      const refreshedChats = await listChats({ profile_id: profileId });
      setAllChats(refreshedChats);
    } catch (error) {
      console.error("Failed to create new chat:", error);
      toast.error("Failed to create new chat.");
    }
  }, [profileId, chatList.length, createChat, setOpenTabIds, setSelectedChatById, openTabIds]);

  // Handle changing the active tab with useCallback
  const handleTabChange = useCallback(
    (tabId: string) => {
      // Check if the tab is already in the list of open tabs
      if (!openTabIds.includes(tabId)) {
        // If not, add it to the list of open tabs
        setOpenTabIds([...openTabIds, tabId]);
      }
      // Set the selected chat to the requested tab
      setSelectedChatById(tabId);
    },
    [setSelectedChatById, openTabIds, setOpenTabIds],
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

  // Handle rename request from context menu
  const handleRenameRequest = useCallback(
    (tabId: string) => {
      const chatToRename = allChats.find((chat) => chat.id === tabId);
      if (chatToRename) {
        setChatToRenameId(tabId);
        setNewChatName(chatToRename.name);
        setIsRenameDialogOpen(true);
      }
    },
    [allChats],
  );

  // Handle duplicate request from context menu
  const handleDuplicateRequest = useCallback(
    async (tabId: string) => {
      try {
        const originalChat = await getChatById(tabId);
        if (!originalChat) {
          throw new Error("Original chat not found");
        }

        const duplicateChatData: CreateChatParams = {
          profile_id: originalChat.profile_id,
          name: `${originalChat.name} (Copy)`,
          chat_template_id: originalChat.chat_template_id,
          participants: originalChat.participants || [],
          user_character_id: originalChat.user_character_id,
          user_character_settings: originalChat.user_character_settings || [],
        };

        const newChat = await createChat(duplicateChatData);

        const updatedTabs = [...openTabIds, newChat.id];
        setOpenTabIds(updatedTabs);
        setSelectedChatById(newChat.id);

        // Refresh the list of all chats
        const refreshedChats = await listChats({ profile_id: profileId });
        setAllChats(refreshedChats);
        toast.success(`Chat "${originalChat.name}" duplicated successfully.`);
      } catch (error) {
        console.error("Failed to duplicate chat:", error);
        toast.error("Failed to duplicate chat.");
      }
    },
    [profileId, createChat, openTabIds, setOpenTabIds, setSelectedChatById],
  );

  // Handle delete request from context menu
  const handleDeleteRequest = useCallback((tabId: string) => {
    setChatToDeleteId(tabId);
    setIsDeleteDialogOpen(true);
  }, []);

  // Handle the actual deletion process after confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!chatToDeleteId) {
      return;
    }

    const chatName = allChats.find((c) => c.id === chatToDeleteId)?.name || "Chat";

    try {
      await deleteChat(chatToDeleteId);
      // The deleteChat action in the store handles updating the list and selected chat
      // We just need to update the local `allChats` state and `openTabIds`
      setAllChats((prev) => prev.filter((chat) => chat.id !== chatToDeleteId));
      setOpenTabIds((prev) => prev.filter((id) => id !== chatToDeleteId));

      toast.success(`"${chatName}" deleted successfully.`);
    } catch (error) {
      console.error("Failed to delete chat:", error);
      toast.error(`Failed to delete "${chatName}".`);
    } finally {
      setChatToDeleteId(null);
      setIsDeleteDialogOpen(false);
    }
  }, [chatToDeleteId, deleteChat, allChats, setOpenTabIds]);

  // Handle the actual renaming process
  const handleRenameSubmit = async () => {
    if (!chatToRenameId || !newChatName.trim()) {
      return;
    }

    try {
      // Check if the name hasn't changed
      const originalChat = allChats.find((chat) => chat.id === chatToRenameId);
      if (originalChat && originalChat.name === newChatName.trim()) {
        setIsRenameDialogOpen(false);
        return; // No change needed
      }

      setAllChats((prev) => prev.map((chat) => (chat.id === chatToRenameId ? { ...chat, name: newChatName.trim() } : chat)));
      // Update the name in the zustand store as well if it's the selected chat
      if (selectedChatID === chatToRenameId) {
        useChatStore.setState((state) => ({ selectedChat: { ...state.selectedChat, name: newChatName.trim() } }));
      }

      setIsRenameDialogOpen(false);

      // Persist the change
      await updateSelectedChat({ name: newChatName.trim() });

      // Optionally refetch the specific chat or all chats if needed after update
      // For now, the optimistic update + store update should suffice
      toast.success(`Chat renamed to "${newChatName.trim()}".`);
    } catch (error) {
      console.error("Failed to rename chat:", error);
      toast.error("Failed to rename chat.");
      // Revert optimistic update if the API call fails
      const originalChat = allChats.find((chat) => chat.id === chatToRenameId);
      if (originalChat) {
        setAllChats((prev) => prev.map((chat) => (chat.id === chatToRenameId ? originalChat : chat)));
        if (selectedChatID === chatToRenameId) {
          useChatStore.setState((state) => ({ selectedChat: { ...state.selectedChat, name: originalChat.name } }));
        }
      }
    } finally {
      setChatToRenameId(null);
      setNewChatName("");
    }
  };

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
    <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
      <div className="flex flex-col h-screen">
        {/* Drawer Content for Live Inspector */}
        <SheetContent side="top" className="h-[90vh]">
          <div className="overflow-auto p-4">
            <LiveInspector maxHeight="calc(90vh - 80px)" />
          </div>
        </SheetContent>

        {/* Existing Chat Page Content */}
        {tabs.length > 0 ? (
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
        ) : (
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
        )}

        {/* Rename Dialog */}
        <EditNameDialog
          open={isRenameDialogOpen}
          onOpenChange={setIsRenameDialogOpen}
          initialName={newChatName}
          onSave={handleRenameSubmit}
          title="Rename Chat"
          description="Enter a new name for your chat."
          label="Name"
          placeholder="Chat name"
          saveButtonText="Save changes"
        />

        {/* Delete Confirmation Dialog */}
        <DestructiveConfirmDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          title="Are you absolutely sure?"
          description={
            <>
              This action cannot be undone. This will permanently delete the chat "
              {allChats.find((c) => c.id === chatToDeleteId)?.name || "this chat"}" and all associated messages and chapters.
            </>
          }
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setChatToDeleteId(null);
          }}
          confirmText="Delete"
        />
      </div>
    </Sheet>
  );
}
