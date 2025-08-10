import { useEnhancedWorkspaceLayout } from './EnhancedWorkspaceContext';
import ResizableProblemDescriptionPanel from '../ResizableProblemDescriptionPanel';

interface EnhancedWorkspaceProblemPanelProps {
  problem: {
    id: string;
    title: string;
    description: string;
    leetcode_url?: string;
  } | null;
  onDescriptionUpdate?: (problemId: string, newDescription: string) => Promise<boolean>;
}

export default function EnhancedWorkspaceProblemPanel({ 
  problem, 
  onDescriptionUpdate 
}: EnhancedWorkspaceProblemPanelProps) {
  // For now, the enhanced workspace doesn't use collapsible panels in the same way
  // The resizing is handled by react-resizable-panels
  // We can add toggle functionality later if needed
  
  const handleToggle = () => {
    // For now, we'll just pass through - the enhanced workspace handles sizing differently
    console.debug('Enhanced workspace panel toggle - handled by react-resizable-panels');
  };

  return (
    <ResizableProblemDescriptionPanel
      isCollapsed={false} // Enhanced workspace doesn't use this collapse system
      onToggle={handleToggle}
      problem={problem}
      useWorkspace={true}
      onDescriptionUpdate={onDescriptionUpdate}
    />
  );
}