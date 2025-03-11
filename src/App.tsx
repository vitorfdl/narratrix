import React from 'react';
import Sidebar from './components/layout/Sidebar';
import Content from './components/layout/Content';
import ProfilePicker from './pages/ProfilePicker/Profile';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { Toaster } from './components/ui/sonner';

const AppContent: React.FC = () => {
  const { currentProfileId, isAuthenticated } = useProfile();
  const [activeSection, setActiveSection] = React.useState<string>('models');

  // Show Profile Picker if no profile is logged in
  if (!currentProfileId || !isAuthenticated) {
    return <ProfilePicker />;
  }

  // Otherwise show the main app UI
  return (
    <div className="flex h-screen select-none text-sm">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      <Content activeSection={activeSection} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <AppContent />
        <Toaster position="top-right" />
      </ProfileProvider>
    </ThemeProvider>
  );
};

export default App;
