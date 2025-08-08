import { useWorkspaceContext } from './WorkspaceContext';
import ResizableProblemDescriptionPanel from '../ResizableProblemDescriptionPanel';

interface WorkspaceProblemPanelProps {
  problem: {
    title: string;
    description: string;
    leetcode_url?: string;
  } | null;
}

export default function WorkspaceProblemPanel({ problem }: WorkspaceProblemPanelProps) {
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
    />
  );
}