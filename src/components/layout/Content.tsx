import Characters from "@/pages/characters/CharactersPage";
import ChatPage from "@/pages/chat/ChatPage";
import InferenceTemplatePage from "@/pages/formatTemplates/FormatTemplatePage";
import LorebooksPage from "@/pages/lorebooks/LorebooksPage";
import Models from "@/pages/models/ModelsPage";
import Settings from "@/pages/settings/SettingsPage";

interface ContentProps {
  activeSection: string;
}

const Content: React.FC<ContentProps> = ({ activeSection }) => {
  return (
    <div className="flex-1 p-0 bg-content text-foreground overflow-auto  custom-scrollbar">
      {/* {activeSection === 'models' && <Models />} */}
      {activeSection === "models" && <Models />}
      {activeSection === "inference" && <InferenceTemplatePage />}
      {activeSection === "chat" && <ChatPage />}
      {activeSection === "characters" && <Characters />}
      {activeSection === "lorebooks" && <LorebooksPage />}
      {activeSection === "settings" && <Settings />}
    </div>
  );
};

export default Content;
