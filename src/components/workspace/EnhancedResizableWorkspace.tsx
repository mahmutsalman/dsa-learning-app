import React, { useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useEnhancedWorkspaceLayout, useEnhancedWorkspaceResize } from './EnhancedWorkspaceContext';
import '../../styles/workspace.css';

export interface EnhancedResizableWorkspaceProps {
  header: React.ReactNode;
  problemPanel: React.ReactNode;
  codeEditor: React.ReactNode;
  notesEditor: React.ReactNode;
  className?: string;
  onLayoutChange?: (layout: any) => void;
}

// Default panel sizes based on text editor design
const DEFAULT_SIDEBAR_SIZE = 25; // 25% for problem panel
const MIN_SIDEBAR_SIZE = 15;      // 15% minimum
const MAX_SIDEBAR_SIZE = 40;      // 40% maximum
const MIN_EDITOR_SIZE = 50;       // 50% minimum for editors container
const DEFAULT_CODE_SIZE = 50;     // 50% for code editor
const MIN_PANEL_SIZE = 20;        // 20% minimum for individual editors

export default function EnhancedResizableWorkspace({
  header,
  problemPanel,
  codeEditor,
  notesEditor,
  className = '',
  onLayoutChange,
}: EnhancedResizableWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  
  // Enhanced workspace context
  const { layout, updateLayout } = useEnhancedWorkspaceLayout();
  const { setResizing } = useEnhancedWorkspaceResize();
  
  // Fallback to localStorage for backward compatibility
  const [sidebarSize, setSidebarSize] = useLocalStorage('enhanced-workspace-sidebar-size', DEFAULT_SIDEBAR_SIZE);
  const [codeSize, setCodeSize] = useLocalStorage('enhanced-workspace-code-size', DEFAULT_CODE_SIZE);

  // Use context values if available, otherwise fallback to localStorage
  const currentSidebarSize = layout?.sidebarSize ?? sidebarSize;
  const currentCodeSize = layout?.codeSize ?? codeSize;

  // Layout change handlers with context integration
  const handleHorizontalResize = useCallback((sizes: number[]) => {
    const [newSidebarSize] = sizes;
    
    // Update context if available
    if (layout) {
      updateLayout({
        sidebarSize: newSidebarSize,
        editorsSize: 100 - newSidebarSize,
      });
    } else {
      // Fallback to localStorage
      setSidebarSize(newSidebarSize);
    }
    
    // Trigger layout change callback
    onLayoutChange?.({
      type: 'horizontal',
      sidebarSize: newSidebarSize,
      editorsSize: 100 - newSidebarSize,
    });

    // Trigger window resize event for Monaco Editor
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }, [layout, updateLayout, setSidebarSize, onLayoutChange]);

  const handleVerticalResize = useCallback((sizes: number[]) => {
    const [newCodeSize] = sizes;
    
    // Update context if available
    if (layout) {
      updateLayout({
        codeSize: newCodeSize,
        notesSize: 100 - newCodeSize,
      });
    } else {
      // Fallback to localStorage
      setCodeSize(newCodeSize);
    }
    
    // Trigger layout change callback
    onLayoutChange?.({
      type: 'vertical',
      codeSize: newCodeSize,
      notesSize: 100 - newCodeSize,
    });

    // Trigger window resize event for Monaco Editor
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }, [layout, updateLayout, setCodeSize, onLayoutChange]);

  // Resize start handler
  const handleResizeStart = useCallback(() => {
    setResizing?.(true);
  }, [setResizing]);

  // Resize end handler  
  const handleResizeEnd = useCallback(() => {
    setResizing?.(false);
  }, [setResizing]);

  return (
    <div
      ref={workspaceRef}
      className={`enhanced-workspace-container ${className}`}
    >
      {/* Fixed Header Section */}
      <div className="enhanced-content-header">
        <div className="enhanced-workspace-header">
          {header}
        </div>
      </div>

      {/* Flexible Content Area with Resizable Panels */}
      <div className="enhanced-workspace-content">
        <PanelGroup 
          direction="horizontal" 
          onLayout={handleHorizontalResize}
          className="enhanced-panel-group"
        >
          {/* Problem Description Panel (Sidebar) */}
          <Panel 
            defaultSize={currentSidebarSize} 
            minSize={MIN_SIDEBAR_SIZE} 
            maxSize={MAX_SIDEBAR_SIZE}
            className="enhanced-panel-sidebar"
            onResize={handleResizeStart}
          >
            <div className="enhanced-problem-panel">
              {problemPanel}
            </div>
          </Panel>

          {/* Horizontal Resize Handle */}
          <PanelResizeHandle 
            className="enhanced-panel-resize-handle-horizontal"
            onDragging={handleResizeStart}
          >
            <div className="enhanced-resize-handle-indicator">
              <div className="enhanced-resize-dots-vertical">
                <div className="enhanced-resize-dot"></div>
                <div className="enhanced-resize-dot"></div>
                <div className="enhanced-resize-dot"></div>
              </div>
            </div>
          </PanelResizeHandle>

          {/* Editors Container Panel */}
          <Panel 
            defaultSize={100 - currentSidebarSize} 
            minSize={MIN_EDITOR_SIZE}
            className="enhanced-panel-editors"
          >
            <PanelGroup 
              direction="vertical" 
              onLayout={handleVerticalResize}
              className="enhanced-panel-group"
            >
              {/* Code Editor Panel */}
              <Panel 
                defaultSize={currentCodeSize} 
                minSize={MIN_PANEL_SIZE}
                className="enhanced-panel-code"
                onResize={handleResizeStart}
              >
                <div className="enhanced-editor-container">
                  <div className="enhanced-editor-content">
                    {codeEditor}
                  </div>
                </div>
              </Panel>

              {/* Vertical Resize Handle */}
              <PanelResizeHandle 
                className="enhanced-panel-resize-handle-vertical"
                onDragging={handleResizeStart}
              >
                <div className="enhanced-resize-handle-indicator">
                  <div className="enhanced-resize-dots-horizontal">
                    <div className="enhanced-resize-dot"></div>
                    <div className="enhanced-resize-dot"></div>
                    <div className="enhanced-resize-dot"></div>
                  </div>
                </div>
              </PanelResizeHandle>

              {/* Notes Editor Panel */}
              <Panel 
                defaultSize={100 - currentCodeSize} 
                minSize={MIN_PANEL_SIZE}
                className="enhanced-panel-notes"
              >
                <div className="enhanced-editor-container">
                  <div className="enhanced-editor-content">
                    {notesEditor}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

// Additional styled components for enhanced visual feedback
export const EnhancedPanelContent: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`enhanced-flexible-content ${className}`}>
    {children}
  </div>
);

export const EnhancedPanelHeader: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`enhanced-content-header ${className}`}>
    {children}
  </div>
);

export const EnhancedPanelMain: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`enhanced-content-main ${className}`}>
    {children}
  </div>
);

export const EnhancedPanelFooter: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`enhanced-content-footer ${className}`}>
    {children}
  </div>
);