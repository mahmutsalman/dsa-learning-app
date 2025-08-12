import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
  isDark: boolean;
  onToggleDarkMode: () => void;
}

export default function Layout({ children, isDark, onToggleDarkMode }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div className="flex-1 grid grid-rows-[auto_1fr]">
        <Header 
          isDark={isDark} 
          onToggleDarkMode={onToggleDarkMode}
          showStats={false}
          onToggleStatsView={() => {}}
        />
        <main className="overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}