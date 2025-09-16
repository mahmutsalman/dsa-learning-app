import { ReactNode, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAppLayout } from '../contexts/AppLayoutContext';
import { useStats } from '../contexts/StatsContext';
import Sidebar from './Sidebar';
import Header from './Header';
import AudioInputWatcher from './AudioInputWatcher';

interface ResizableLayoutProps {
  children: ReactNode;
  isDark: boolean;
  onToggleDarkMode: () => void;
}

export default function ResizableLayout({ children, isDark, onToggleDarkMode }: ResizableLayoutProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  
  // Use contexts
  const { state, actions } = useAppLayout();
  const { sidebar } = state;
  const { showStats, toggleStats } = useStats();
  
  // Calculate actual sidebar size based on collapsed state
  const actualSidebarSize = sidebar.isCollapsed ? sidebar.collapsedSize : sidebar.size;
  
  // Handle sidebar resize
  const handleSidebarResize = useCallback((sizes: number[]) => {
    const [newSidebarSize] = sizes;
    
    // Only update if not collapsed and within bounds
    if (!sidebar.isCollapsed && newSidebarSize >= sidebar.minSize && newSidebarSize <= sidebar.maxSize) {
      actions.setSidebarSize(newSidebarSize);
    }
  }, [sidebar.isCollapsed, sidebar.minSize, sidebar.maxSize, actions]);
  
  // Handle sidebar collapse/expand
  const handleSidebarToggle = useCallback(() => {
    actions.toggleSidebar();
  }, [actions]);
  
  // Handle resize start/end for performance
  const handleResizeStart = useCallback(() => {
    document.body.classList.add('resizing');
  }, []);
  
  const handleResizeEnd = useCallback(() => {
    document.body.classList.remove('resizing');
  }, []);

  return (
    <div ref={layoutRef} className="h-screen bg-white dark:bg-gray-800 flex flex-col">
      <PanelGroup 
        direction="horizontal" 
        onLayout={handleSidebarResize}
        className="flex-1"
      >
        {/* Sidebar Panel */}
        <Panel
          id="sidebar"
          order={1}
          defaultSize={actualSidebarSize}
          minSize={sidebar.isCollapsed ? sidebar.collapsedSize : sidebar.minSize}
          maxSize={sidebar.isCollapsed ? sidebar.collapsedSize : sidebar.maxSize}
          collapsible={false} // We handle collapse manually
          className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
        >
          <Sidebar 
            isCollapsed={sidebar.isCollapsed} 
            onToggle={handleSidebarToggle}
            isResizable={true}
          />
        </Panel>
        
        {/* Resize Handle */}
        <PanelResizeHandle 
          className="app-resize-handle"
          onDragging={(isDragging) => {
            if (isDragging) {
              handleResizeStart();
            } else {
              handleResizeEnd();
            }
          }}
          disabled={sidebar.isCollapsed}
        >
          <div className="app-resize-handle-inner" />
        </PanelResizeHandle>
        
        {/* Main Content Panel */}
        <Panel
          id="main-content"
          order={2}
          minSize={60} // Minimum space for main content
          className="flex flex-col bg-white dark:bg-gray-800"
        >
          <Header 
            isDark={isDark} 
            onToggleDarkMode={onToggleDarkMode}
            showStats={showStats}
            onToggleStatsView={toggleStats}
          />
          <AudioInputWatcher />
          <main className="flex-1 overflow-hidden bg-white dark:bg-gray-800">
            {children}
          </main>
        </Panel>
      </PanelGroup>
    </div>
  );
}
