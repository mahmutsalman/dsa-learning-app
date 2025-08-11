import EnhancedProblemDescriptionPanel from '../EnhancedProblemDescriptionPanel';
import { Problem } from '../../types';

interface EnhancedWorkspaceProblemPanelProps {
  problem: Problem | null;
  onDescriptionUpdate?: (problemId: string, newDescription: string) => Promise<boolean>;
}

export default function EnhancedWorkspaceProblemPanel({ 
  problem, 
  onDescriptionUpdate 
}: EnhancedWorkspaceProblemPanelProps) {
  return (
    <EnhancedProblemDescriptionPanel
      problem={problem}
      onDescriptionUpdate={onDescriptionUpdate}
    />
  );
}