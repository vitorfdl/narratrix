import React, { useEffect } from "react";
import Content from "./components/layout/Content";
import Sidebar from "./components/layout/Sidebar";
import { Toaster } from "./components/ui/sonner";
import { useCurrentProfile, useInitializeProfiles, useIsAuthenticated, useProfileSynchronization } from "./hooks/ProfileStore";
import { initializeTheme } from "./hooks/ThemeContext";
import ProfilePicker from "./pages/profileLogin/ProfilePage";
import { InferenceProvider } from "./providers/InferenceProvider";
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
      <Sidebar />
      <Content />
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
    <InferenceProvider>
      <AppContent />
      <Toaster richColors closeButton position="bottom-right" />
    </InferenceProvider>
  );
};

export default App;
