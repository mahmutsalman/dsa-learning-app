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
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header isDark={isDark} onToggleDarkMode={onToggleDarkMode} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}