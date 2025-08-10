import EnhancedProblemDescriptionPanel from '../EnhancedProblemDescriptionPanel';

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
  return (
    <EnhancedProblemDescriptionPanel
      problem={problem}
      onDescriptionUpdate={onDescriptionUpdate}
    />
  );
}