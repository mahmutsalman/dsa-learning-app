import React from 'react';

interface WorkspacePanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function WorkspacePanel({
  id,
  children,
  className = '',
  style = {},
}: WorkspacePanelProps) {
  const baseClassName = 'workspace-panel';
  
  return (
    <div
      id={`workspace-panel-${id}`}
      className={`${baseClassName} ${className}`}
      style={style}
      data-panel-id={id}
    >
      <div className="workspace-panel-content">
        {children}
      </div>
    </div>
  );
}