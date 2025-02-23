import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Content from './components/layout/Content';
import { ThemeProvider } from './contexts/ThemeContext';

const App: React.FC = () => {
  console.log('App rendered');
  const [activeSection, setActiveSection] = useState<string>('models');

  return (
    <ThemeProvider>
      <div className="flex h-screen select-none text-sm">
        <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
        <Content activeSection={activeSection} />
      </div>
    </ThemeProvider>
  );
};

export default App;
