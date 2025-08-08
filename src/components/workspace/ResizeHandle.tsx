import React from 'react';
import { ResizeHandle as ResizeHandleType } from './WorkspaceContext';

interface ResizeHandleProps {
  handle: ResizeHandleType;
  onResizeStart: (handle: ResizeHandleType, event: React.MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function ResizeHandle({
  handle,
  onResizeStart,
  className = '',
  style = {},
}: ResizeHandleProps) {
  const handleMouseDown = (event: React.MouseEvent) => {
    onResizeStart(handle, event);
  };

  const isVertical = handle.type === 'vertical';
  
  const baseClassName = isVertical 
    ? 'workspace-resize-handle workspace-resize-handle-vertical' 
    : 'workspace-resize-handle workspace-resize-handle-horizontal';

  const defaultStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 10,
    ...(isVertical ? {
      width: '4px',
      height: '100%',
      cursor: 'col-resize',
      left: '0px',
    } : {
      width: '100%',
      height: '4px',
      cursor: 'row-resize',
      top: '0px',
    }),
    ...style,
  };

  return (
    <div
      className={`${baseClassName} ${className}`}
      style={defaultStyle}
      onMouseDown={handleMouseDown}
    >
      {/* Visual indicator */}
      <div className="resize-handle-indicator">
        {isVertical ? (
          // Vertical dots indicator
          <div className="resize-handle-dots-vertical">
            <div className="resize-handle-dot" />
            <div className="resize-handle-dot" />
            <div className="resize-handle-dot" />
          </div>
        ) : (
          // Horizontal dots indicator  
          <div className="resize-handle-dots-horizontal">
            <div className="resize-handle-dot" />
            <div className="resize-handle-dot" />
            <div className="resize-handle-dot" />
          </div>
        )}
      </div>
    </div>
  );
}