import { useUIStore } from "@/hooks/UIStore";
import AgentPage from "@/pages/agents/AgentPage";
import Characters from "@/pages/characters/CharactersPage";
import ChatPage from "@/pages/chat/ChatPage";
import LorebooksPage from "@/pages/lorebooks/LorebooksPage";
import Models from "@/pages/models/ModelsPage";
import Settings from "@/pages/settings/SettingsPage";

interface ContentProps {
  // Remove prop: activeSection
  // activeSection: string;
}

const Content: React.FC<ContentProps> = (/* Remove prop */) => {
  // Use the store
  const activeSection = useUIStore((state) => state.activeSection);

  return (
    <div className="flex-1 p-0 bg-content text-foreground overflow-auto  custom-scrollbar">
      {/* {activeSection === 'models' && <Models />} */}
      {activeSection === "models" && <Models />}
      {activeSection === "chat" && <ChatPage />}
      {activeSection === "characters" && <Characters />}
      {activeSection === "lorebooks" && <LorebooksPage />}
      {activeSection === "settings" && <Settings />}
      {activeSection === "agents" && <AgentPage />}
    </div>
  );
};

export default Content;
