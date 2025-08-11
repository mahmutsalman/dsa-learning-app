import { useWorkspaceContext } from './WorkspaceContext';
import ResizableProblemDescriptionPanel from '../ResizableProblemDescriptionPanel';
import { Problem } from '../../types';

interface WorkspaceProblemPanelProps {
  problem: Problem | null;
  onDescriptionUpdate?: (problemId: string, newDescription: string) => Promise<boolean>;
}

export default function WorkspaceProblemPanel({ problem, onDescriptionUpdate }: WorkspaceProblemPanelProps) {
  const { state, actions } = useWorkspaceContext();

  const handleToggle = () => {
    actions.togglePanel('problemPanel');
  };

  return (
    <ResizableProblemDescriptionPanel
      isCollapsed={state.layout.isCollapsed.problemPanel}
      onToggle={handleToggle}
      problem={problem}
      useWorkspace={true}
      onDescriptionUpdate={onDescriptionUpdate}
    />
  );
}