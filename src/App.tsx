import React, { useEffect } from "react";
import Content from "./components/layout/Content";
import Sidebar from "./components/layout/Sidebar";
import { Toaster } from "./components/ui/sonner";
import { ProfileProvider, useProfile } from "./hooks/ProfileContext";
import { ThemeProvider } from "./hooks/ThemeContext";
import ProfilePicker from "./pages/profileLogin/ProfilePage";
import { InferenceProvider } from "./providers/InferenceProvider";
import { checkForUpdates } from "./services/updater";

const AppContent: React.FC = () => {
  const { currentProfile, isAuthenticated } = useProfile();
  const [activeSection, setActiveSection] = React.useState<string>("models");

  // Show Profile Picker if no profile is logged in
  if (!currentProfile || !isAuthenticated) {
    return <ProfilePicker />;
  }

  // Otherwise show the main app UI
  return (
    <div className="flex h-screen select-none text-base">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      <Content activeSection={activeSection} />
    </div>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    checkForUpdates();
  }, []);

  return (
    <ThemeProvider>
      <ProfileProvider>
        <InferenceProvider>
          <AppContent />
          <Toaster richColors closeButton position="bottom-right" />
        </InferenceProvider>
      </ProfileProvider>
    </ThemeProvider>
  );
};

export default App;
