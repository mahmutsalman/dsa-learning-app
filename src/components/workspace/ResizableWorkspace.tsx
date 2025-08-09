import React, { useRef, useCallback } from 'react';
import { useWorkspaceContext } from './WorkspaceContext';
import ResizeHandle from './ResizeHandle';
import WorkspacePanel from './WorkspacePanel';

export interface ResizableWorkspaceProps {
  header: React.ReactNode;
  problemPanel: React.ReactNode;
  codeEditor: React.ReactNode;
  notesEditor: React.ReactNode;
  className?: string;
  onLayoutChange?: (layout: any) => void;
}

export default function ResizableWorkspace({
  header,
  problemPanel,
  codeEditor,
  notesEditor,
  className = '',
}: ResizableWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const { state, actions } = useWorkspaceContext();
  
  const { dimensions, layout, constraints } = state;

  // Create resize handles
  const verticalHandle = {
    id: 'vertical-main',
    type: 'vertical' as const,
    position: dimensions.problemPanelWidth,
    panels: {
      before: 'problemPanel',
      after: 'mainContent',
    },
    constraints: {
      min: constraints.minProblemWidth,
      max: constraints.maxProblemWidth,
    },
  };

  const horizontalHandle = {
    id: 'horizontal-main',
    type: 'horizontal' as const,
    position: dimensions.codeEditorHeight,
    panels: {
      before: 'codeEditor',
      after: 'notesEditor',
    },
    constraints: {
      min: constraints.minCodeHeight,
      max: constraints.maxCodeHeight,
    },
  };

  // Handle resize events
  const handleResizeStart = useCallback((handle: any, event: React.MouseEvent) => {
    event.preventDefault();
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startPosition = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    actions.startResize(handle, startPosition);

    // Add global mouse event listeners
    const handleMouseMove = (e: MouseEvent) => {
      const currentPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const delta = {
        x: currentPosition.x - startPosition.x,
        y: currentPosition.y - startPosition.y,
      };

      actions.updateResize(delta);
    };

    const handleMouseUp = () => {
      actions.endResize();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [actions]);

  // Grid layout styles - now includes header row
  const gridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${dimensions.problemPanelWidth}px 1fr`,
    gridTemplateRows: '64px 1fr', // Fixed header height + content area
    height: '100%',
    width: '100%',
    position: 'relative',
  };

  // Content grid styles for the editors area
  const contentGridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: `${dimensions.codeEditorHeight}px 1fr`,
    height: '100%',
    width: '100%',
  };

  // Calculate actual notes editor height
  const notesEditorHeight = dimensions.totalHeight - dimensions.codeEditorHeight - 100; // Account for header

  return (
    <div
      ref={workspaceRef}
      className={`unified-workspace ${className}`}
      style={gridStyles}
    >
        {/* Header - spans full width */}
        <div
          className="workspace-header"
          style={{
            gridColumn: '1 / -1',
            gridRow: '1',
            height: '64px',
            borderBottom: '1px solid var(--workspace-border-color)',
          }}
        >
          {header}
        </div>

        {/* Problem Description Panel */}
        <WorkspacePanel
          id="problemPanel"
          className="workspace-panel-problem"
          style={{
            gridColumn: '1',
            gridRow: '2',
            width: dimensions.problemPanelWidth,
            height: '100%',
            minWidth: layout.isCollapsed.problemPanel ? dimensions.problemPanelWidth : constraints.minProblemWidth,
          }}
        >
          {problemPanel}
        </WorkspacePanel>

        {/* Vertical Resize Handle */}
        {!layout.isCollapsed.problemPanel && (
          <ResizeHandle
            handle={verticalHandle}
            onResizeStart={handleResizeStart}
            style={{
              gridColumn: '2',
              gridRow: '2',
              marginLeft: -2,
              zIndex: 10,
            }}
          />
        )}

        {/* Content Area - contains code and notes editors */}
        <div
          className="workspace-content-area"
          style={{
            gridColumn: '2',
            gridRow: '2',
            ...contentGridStyles,
          }}
        >
          {/* Code Editor */}
          <WorkspacePanel
            id="codeEditor"
            className="workspace-panel-code"
            style={{
              gridColumn: '1',
              gridRow: '1',
              height: dimensions.codeEditorHeight,
              minHeight: constraints.minCodeHeight,
            }}
          >
            {codeEditor}
          </WorkspacePanel>

          {/* Horizontal Resize Handle */}
          {!layout.isCollapsed.notesEditor && (
            <ResizeHandle
              handle={horizontalHandle}
              onResizeStart={handleResizeStart}
              style={{
                gridColumn: '1',
                gridRow: '1',
                marginTop: dimensions.codeEditorHeight - 2,
                zIndex: 10,
              }}
            />
          )}

          {/* Notes Editor */}
          {!layout.isCollapsed.notesEditor && (
            <WorkspacePanel
              id="notesEditor"
              className="workspace-panel-notes"
              style={{
                gridColumn: '1',
                gridRow: '2',
                height: Math.max(notesEditorHeight, constraints.minNotesHeight),
                minHeight: constraints.minNotesHeight,
              }}
            >
              {notesEditor}
            </WorkspacePanel>
          )}
        </div>
      </div>
  );
}