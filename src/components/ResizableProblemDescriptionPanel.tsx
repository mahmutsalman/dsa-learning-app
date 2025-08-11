import { useState, useCallback, useEffect, useRef } from 'react';
import { ResizableBox } from 'react-resizable';
import ProblemDescriptionPanel from './ProblemDescriptionPanel';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useWorkspaceContext } from './workspace/WorkspaceContext';
import { Problem } from '../types';
import 'react-resizable/css/styles.css';

export interface ResizableProblemDescriptionPanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  problem: Problem | null;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
  useWorkspace?: boolean; // Flag to enable workspace integration
  onDescriptionUpdate?: (problemId: string, newDescription: string) => Promise<boolean>;
}

const DEFAULT_WIDTH = 320; // w-80 equivalent
const COLLAPSED_WIDTH = 48; // w-12 equivalent
const MIN_WIDTH = 200;
const MAX_WIDTH = window.innerWidth * 0.4; // 40% of viewport width

export default function ResizableProblemDescriptionPanel({
  isCollapsed,
  onToggle,
  problem,
  initialWidth = DEFAULT_WIDTH,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
  onWidthChange,
  className = '',
  useWorkspace = false,
  onDescriptionUpdate
}: ResizableProblemDescriptionPanelProps) {
  // Workspace integration
  const workspaceContext = useWorkspace ? (() => {
    try {
      return useWorkspaceContext();
    } catch {
      return null;
    }
  })() : null;

  // Use localStorage to persist width, fallback to initialWidth
  const [storedWidth, setStoredWidth] = useLocalStorage('problem-panel-width', initialWidth);
  const [width, setWidth] = useState(isCollapsed ? COLLAPSED_WIDTH : storedWidth);
  const [dynamicMaxWidth, setDynamicMaxWidth] = useState(maxWidth);
  const resizableRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic max width based on available viewport space
  const calculateDynamicMaxWidth = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const minMonacoWidth = 400; // Minimum space needed for Monaco Editor + Notes
    const padding = 20; // Some padding buffer
    const availableWidth = viewportWidth - minMonacoWidth - padding;
    
    // Ensure we don't exceed the original maxWidth constraint
    const calculatedMaxWidth = Math.min(availableWidth, maxWidth);
    
    // Ensure maxWidth is always greater than minWidth
    const finalMaxWidth = Math.max(calculatedMaxWidth, minWidth + 50);
    
    setDynamicMaxWidth(finalMaxWidth);
    return finalMaxWidth;
  }, [maxWidth, minWidth]);

  // Update dynamic max width on window resize and component mount
  useEffect(() => {
    calculateDynamicMaxWidth();
    
    const handleResize = () => {
      calculateDynamicMaxWidth();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateDynamicMaxWidth]);

  // Handle collapse/expand state changes
  useEffect(() => {
    if (isCollapsed) {
      setWidth(COLLAPSED_WIDTH);
      onWidthChange?.(COLLAPSED_WIDTH);
    } else {
      // When expanding, restore the stored width (but respect current constraints)
      const targetWidth = Math.min(storedWidth, dynamicMaxWidth);
      setWidth(targetWidth);
      onWidthChange?.(targetWidth);
      
      // Trigger layout recalculation for connected components
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 150);
    }
  }, [isCollapsed, storedWidth, dynamicMaxWidth, onWidthChange]);

  // Constrain current width to new dynamic max width
  useEffect(() => {
    if (!isCollapsed && width > dynamicMaxWidth) {
      const constrainedWidth = dynamicMaxWidth;
      setWidth(constrainedWidth);
      setStoredWidth(constrainedWidth);
      onWidthChange?.(constrainedWidth);
    }
  }, [dynamicMaxWidth, width, onWidthChange, setStoredWidth, isCollapsed]);

  const handleResize = useCallback((_e: any, { size }: { size: { height: number; width: number } }) => {
    if (!isCollapsed) {
      const constrainedWidth = Math.min(size.width, dynamicMaxWidth);
      setWidth(constrainedWidth);
      setStoredWidth(constrainedWidth);
      onWidthChange?.(constrainedWidth);
      
      // Force a small delay to ensure layout has updated, then trigger window resize event
      // This helps Monaco Editor and other components detect the layout change
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 10);
    }
  }, [isCollapsed, onWidthChange, setStoredWidth, dynamicMaxWidth]);

  // If workspace is enabled, use workspace dimensions
  if (useWorkspace && workspaceContext) {
    const workspaceWidth = workspaceContext.state.layout.isCollapsed.problemPanel 
      ? COLLAPSED_WIDTH 
      : workspaceContext.state.dimensions.problemPanelWidth;
    
    return (
      <div ref={resizableRef} className={`resizable-problem-panel-container workspace-integrated ${className}`}>
        <div className="h-full w-full" style={{ width: workspaceWidth }}>
          <ProblemDescriptionPanel
            isCollapsed={workspaceContext.state.layout.isCollapsed.problemPanel}
            onToggle={onToggle}
            problem={problem}
            useWorkspace={true}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        </div>
      </div>
    );
  }

  // Legacy mode: If collapsed, render the panel directly without ResizableBox
  if (isCollapsed) {
    return (
      <div className={`${className}`}>
        <ProblemDescriptionPanel
          isCollapsed={isCollapsed}
          onToggle={onToggle}
          problem={problem}
          useWorkspace={useWorkspace}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </div>
    );
  }

  // Legacy ResizableBox mode for backwards compatibility
  return (
    <div ref={resizableRef} className={`resizable-problem-panel-container ${className}`}>
      <ResizableBox
        width={width}
        height={Infinity}
        minConstraints={[minWidth, Infinity]}
        maxConstraints={[dynamicMaxWidth, Infinity]}
        resizeHandles={['e']} // Only allow east (right) resizing
        onResize={handleResize}
        className="resizable-problem-panel-box"
        handle={
          <div className="resize-handle-right">
            <div className="resize-handle-grip-vertical" />
          </div>
        }
      >
        <div className="h-full w-full">
          <ProblemDescriptionPanel
            isCollapsed={isCollapsed}
            onToggle={onToggle}
            problem={problem}
            useWorkspace={useWorkspace}
            onDescriptionUpdate={onDescriptionUpdate}
          />
        </div>
      </ResizableBox>
    </div>
  );
}