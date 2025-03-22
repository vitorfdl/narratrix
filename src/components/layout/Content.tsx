import Characters from "@/pages/characters/Characters";
import ChatPage from "@/pages/chat/ChatPage";
import InferenceTemplatePage from "@/pages/formatTemplates/FormatTemplatePage";
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
      {activeSection === "lorebooks" && <Lorebooks />}
      {activeSection === "settings" && <Settings />}
    </div>
  );
};

// Placeholder components
const Lorebooks = () => <div>Lorebooks Content</div>;

export default Content;
