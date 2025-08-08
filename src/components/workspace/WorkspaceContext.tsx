import { createContext, useContext } from 'react';

export enum LayoutMode {
  STANDARD = 'standard',
  WIDE_CODE = 'wide-code',
  FOCUS_PROBLEM = 'focus-problem',
  FULLSCREEN_CODE = 'fullscreen-code'
}

export interface ResizeHandle {
  id: string;
  type: 'vertical' | 'horizontal';
  position: number;
  panels: {
    before: string;
    after: string;
  };
  constraints: {
    min: number;
    max: number;
  };
}

export interface WorkspaceDimensions {
  problemPanelWidth: number;
  codeEditorHeight: number;
  totalWidth: number;
  totalHeight: number;
}

export interface WorkspaceConstraints {
  minProblemWidth: number;
  maxProblemWidth: number;
  minCodeHeight: number;
  maxCodeHeight: number;
  minNotesHeight: number;
}

export interface WorkspaceLayout {
  mode: LayoutMode;
  isCollapsed: {
    problemPanel: boolean;
    notesEditor: boolean;
  };
}

export interface WorkspaceState {
  dimensions: WorkspaceDimensions;
  constraints: WorkspaceConstraints;
  layout: WorkspaceLayout;
  activeResize: {
    handle: ResizeHandle | null;
    startPosition: { x: number; y: number } | null;
    startDimensions: WorkspaceDimensions | null;
  };
}

export interface WorkspaceActions {
  updateDimensions: (dimensions: Partial<WorkspaceDimensions>) => void;
  updateConstraints: (constraints: Partial<WorkspaceConstraints>) => void;
  togglePanel: (panel: 'problemPanel' | 'notesEditor') => void;
  setLayoutMode: (mode: LayoutMode) => void;
  startResize: (handle: ResizeHandle, startPosition: { x: number; y: number }) => void;
  updateResize: (delta: { x: number; y: number }) => void;
  endResize: () => void;
  resetLayout: () => void;
}

export interface WorkspaceContextValue {
  state: WorkspaceState;
  actions: WorkspaceActions;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceProvider');
  }
  return context;
}