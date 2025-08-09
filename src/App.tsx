import React, { useEffect } from "react";
import { InferenceServiceProvider } from "@/providers/inferenceChatProvider";
import Content from "./components/layout/Content";
import Sidebar from "./components/layout/Sidebar";
import { Toaster } from "./components/ui/sonner";
import { useCurrentProfile, useInitializeProfiles, useIsAuthenticated, useProfileSynchronization } from "./hooks/ProfileStore";
import { initializeTheme } from "./hooks/ThemeContext";
import ProfilePicker from "./pages/profileLogin/ProfilePage";
import { checkForUpdates } from "./services/updater";

const AppContent: React.FC = () => {
  const currentProfile = useCurrentProfile();
  const isAuthenticated = useIsAuthenticated();

  // Initialize profile synchronization
  useProfileSynchronization();

  // Show Profile Picker if no profile is logged in
  if (!currentProfile || !isAuthenticated) {
    return <ProfilePicker />;
  }

  // Otherwise show the main app UI
  return (
    <div className="flex h-screen select-none text-base">
      <InferenceServiceProvider>
        <Sidebar />
        <Content />
      </InferenceServiceProvider>
    </div>
  );
};

const App: React.FC = () => {
  // Initialize profiles on app startup
  useInitializeProfiles();

  useEffect(() => {
    // Initialize theme system
    initializeTheme();

    // Check for updates
    checkForUpdates();
  }, []);

  return (
    <>
      <AppContent />
      <Toaster richColors closeButton position="bottom-right" />
    </>
  );
};

export default App;
