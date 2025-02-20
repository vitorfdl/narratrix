import Characters from "@/pages/characters/Characters";
import ChatPage from "@/pages/chat/Chat";
import InferenceTemplatePage from "@/pages/inferencetemplate/InferenceTemplate";
import Models from "@/pages/models/Models";
import Settings from "@/pages/settings/Settings";

interface ContentProps {
    activeSection: string;
}

const Content: React.FC<ContentProps> = ({ activeSection }) => {
    return (
        <div className="flex-1 p-0 bg-content text-foreground overflow-auto">
            {activeSection === 'models' && <Models />}
            {activeSection === 'inference' && <InferenceTemplatePage />}
            {activeSection === 'chat' && <ChatPage />}
            {activeSection === 'characters' && <Characters />}
            {activeSection === 'lorebooks' && <Lorebooks />}
            {activeSection === 'settings' && <Settings />}
        </div>
    );
};

// Placeholder components
const Lorebooks = () => <div>Lorebooks Content</div>;

export default Content;
