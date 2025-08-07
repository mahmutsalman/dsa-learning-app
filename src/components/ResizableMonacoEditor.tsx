import { useState, useCallback } from 'react';
import { ResizableBox } from 'react-resizable';
import { MonacoEditor, MonacoEditorProps } from './MonacoEditor';
import { useLocalStorage } from '../hooks/useLocalStorage';
import 'react-resizable/css/styles.css';

export interface ResizableMonacoEditorProps extends Omit<MonacoEditorProps, 'className'> {
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onHeightChange?: (height: number) => void;
  className?: string;
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
  ...monacoProps
}: ResizableMonacoEditorProps) {
  // Use localStorage to persist height, fallback to initialHeight
  const [storedHeight, setStoredHeight] = useLocalStorage('monaco-editor-height', initialHeight);
  const [height, setHeight] = useState(storedHeight);

  const handleResize = useCallback((e: any, { size }: { size: { height: number; width: number } }) => {
    setHeight(size.height);
    setStoredHeight(size.height);
    onHeightChange?.(size.height);
  }, [onHeightChange, setStoredHeight]);

  return (
    <div className={`resizable-monaco-container ${className}`}>
      <ResizableBox
        width={Infinity}
        height={height}
        minConstraints={[Infinity, minHeight]}
        maxConstraints={[Infinity, maxHeight]}
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