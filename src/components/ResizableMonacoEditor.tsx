import { useState, useCallback, useEffect, useRef } from 'react';
import { ResizableBox } from 'react-resizable';
import { MonacoEditor, MonacoEditorProps } from './MonacoEditor';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useWorkspaceContext } from './workspace/WorkspaceContext';
import 'react-resizable/css/styles.css';

export interface ResizableMonacoEditorProps extends Omit<MonacoEditorProps, 'className'> {
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onHeightChange?: (height: number) => void;
  className?: string;
  containerRef?: React.RefObject<HTMLElement>;
  siblingMinHeight?: number;
  useWorkspace?: boolean; // Flag to enable workspace integration
  onMount?: (editor: any) => void; // Additional mount callback for workspace integration
}

const DEFAULT_HEIGHT = 400;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = window.innerHeight * 0.8; // 80% of viewport height

export function ResizableMonacoEditor({
  initialHeight = DEFAULT_HEIGHT,
  minHeight = MIN_HEIGHT,
  maxHeight = MAX_HEIGHT,
  onHeightChange,
  className = '',
  containerRef,
  siblingMinHeight = 300,
  useWorkspace = false,
  onMount,
  ...monacoProps
}: ResizableMonacoEditorProps) {
  // Workspace integration
  const workspaceContext = useWorkspace ? (() => {
    try {
      return useWorkspaceContext();
    } catch {
      return null;
    }
  })() : null;

  // Use localStorage to persist height, fallback to initialHeight
  const [storedHeight, setStoredHeight] = useLocalStorage('monaco-editor-height', initialHeight);
  const [height, setHeight] = useState(storedHeight);
  const [dynamicMaxHeight, setDynamicMaxHeight] = useState(maxHeight);
  const resizableRef = useRef<HTMLDivElement>(null);

  // Calculate dynamic max height based on available container space
  const calculateDynamicMaxHeight = useCallback(() => {
    if (containerRef?.current && resizableRef.current) {
      const container = containerRef.current;
      const containerHeight = container.getBoundingClientRect().height;
      
      // Account for header height, padding, and sibling minimum height
      const headerHeight = 80; // Approximate header height
      const padding = 20; // Some padding buffer
      const availableHeight = containerHeight - headerHeight - siblingMinHeight - padding;
      
      // Ensure we don't exceed the original maxHeight constraint
      const calculatedMaxHeight = Math.min(availableHeight, maxHeight);
      
      // Ensure maxHeight is always greater than minHeight
      const finalMaxHeight = Math.max(calculatedMaxHeight, minHeight + 50);
      
      setDynamicMaxHeight(finalMaxHeight);
      return finalMaxHeight;
    }
    return maxHeight;
  }, [containerRef, maxHeight, minHeight, siblingMinHeight]);

  // Update dynamic max height on window resize and component mount
  useEffect(() => {
    calculateDynamicMaxHeight();
    
    const handleResize = () => {
      calculateDynamicMaxHeight();
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateDynamicMaxHeight]);

  // Constrain current height to new dynamic max height
  useEffect(() => {
    if (height > dynamicMaxHeight) {
      const constrainedHeight = dynamicMaxHeight;
      setHeight(constrainedHeight);
      setStoredHeight(constrainedHeight);
      onHeightChange?.(constrainedHeight);
    }
  }, [dynamicMaxHeight, height, onHeightChange, setStoredHeight]);

  const handleResize = useCallback((_e: any, { size }: { size: { height: number; width: number } }) => {
    const constrainedHeight = Math.min(size.height, dynamicMaxHeight);
    setHeight(constrainedHeight);
    setStoredHeight(constrainedHeight);
    onHeightChange?.(constrainedHeight);
  }, [onHeightChange, setStoredHeight, dynamicMaxHeight]);

  // If workspace is enabled, use workspace dimensions and skip ResizableBox
  if (useWorkspace && workspaceContext) {
    const workspaceHeight = workspaceContext.state.dimensions.codeEditorHeight;
    
    return (
      <div ref={resizableRef} className={`resizable-monaco-container workspace-integrated workspace-monaco-responsive ${className}`}>
        <div className="monaco-editor-container" style={{ height: workspaceHeight }}>
          <MonacoEditor
            {...monacoProps}
            className="h-full w-full"
          />
        </div>
      </div>
    );
  }

  // Legacy ResizableBox mode for backwards compatibility
  return (
    <div ref={resizableRef} className={`resizable-monaco-container ${className}`}>
      <ResizableBox
        width={Infinity}
        height={height}
        minConstraints={[Infinity, minHeight]}
        maxConstraints={[Infinity, dynamicMaxHeight]}
        resizeHandles={['s']} // Only allow south (bottom) resizing
        onResize={handleResize}
        className="resizable-monaco-box"
        handle={
          <div className="resize-handle-bottom">
            <div className="resize-handle-grip" />
          </div>
        }
      >
        <div className="h-full w-full">
          <MonacoEditor
            {...monacoProps}
            className="h-full w-full"
          />
        </div>
      </ResizableBox>
    </div>
  );
}