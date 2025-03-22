import { cn } from "@/lib/utils";
import { ChatTab } from "@/schema/chat";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ChatTabs } from "./ChatTabs";
import { GridLayout } from "./components/GridLayout";

export default function Chat() {
  const [tabs, setTabs] = useState<ChatTab[]>([
    { id: "default", name: "New Chat", isActive: true, gridItems: [] },
    { id: "default2", name: "Other Chat", isActive: false, gridItems: [] },
  ]);
  const [activeTab, setActiveTab] = useState("default");

  const handleNewChat = () => {
    const newTab = {
      id: uuidv4(),
      name: `Chat ${tabs.length + 1}`,
      isActive: true,
      gridItems: [],
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    // If we're closing the active tab, switch to the last remaining tab
    if (activeTab === tabId && newTabs.length > 0) {
      setActiveTab(newTabs[newTabs.length - 1].id);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <ChatTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onNewChat={handleNewChat}
        onCloseTab={handleCloseTab}
      />
      <div className="flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn("h-full w-full", activeTab === tab.id ? "block" : "hidden")}
          >
            <GridLayout key={tab.id} tabId={tab.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
