// Database analysis utilities
import { invoke } from '@tauri-apps/api/core';
import { Card, Problem } from '../types';

export interface DatabaseStats {
  problem_count: number;
  total_cards: number;
  main_cards: number;
  child_cards: number;
}

export interface CardHierarchy {
  card_id: string;
  problem_id: string;
  problem_title: string;
  card_number: number;
  parent_card_id: string | null;
  child_count: number;
}

export interface CardCountPerProblem {
  problem_id: string;
  problem_title: string;
  total_cards: number;
  main_cards: number;
  child_cards: number;
}

// Helper function to analyze cards client-side
export function analyzeCards(cards: Card[]): {
  mainCards: Card[];
  childCards: Card[];
  cardsByParent: Map<string, Card[]>;
} {
  const mainCards = cards.filter(card => !card.parent_card_id);
  const childCards = cards.filter(card => card.parent_card_id);
  
  const cardsByParent = new Map<string, Card[]>();
  
  // Group child cards by their parent
  childCards.forEach(card => {
    const parentId = card.parent_card_id!;
    if (!cardsByParent.has(parentId)) {
      cardsByParent.set(parentId, []);
    }
    cardsByParent.get(parentId)!.push(card);
  });
  
  // Sort child cards by card_number within each parent group
  cardsByParent.forEach(children => {
    children.sort((a, b) => a.card_number - b.card_number);
  });
  
  return { mainCards, childCards, cardsByParent };
}

// Get all cards for the same problem (for pagination)
export function getSiblingCards(currentCard: Card, allCards: Card[]): Card[] {
  return allCards
    .filter(card => card.problem_id === currentCard.problem_id)
    .sort((a, b) => a.card_number - b.card_number);
}

// Generate a database report
export async function generateDatabaseReport(): Promise<string> {
  try {
    const problems = await invoke<Problem[]>('get_problems');
    
    let report = '# Database Analysis Report\n\n';
    report += `**Total Problems**: ${problems.length}\n\n`;
    
    for (const problem of problems) {
      try {
        const cards = await invoke<Card[]>('get_cards_for_problem', { 
          problemId: problem.id 
        });
        
        const { mainCards, childCards, cardsByParent } = analyzeCards(cards);
        
        report += `## ${problem.title}\n`;
        report += `- **Problem ID**: ${problem.id}\n`;
        report += `- **Total Cards**: ${cards.length}\n`;
        report += `- **Main Cards**: ${mainCards.length}\n`;
        report += `- **Child Cards**: ${childCards.length}\n\n`;
        
        if (mainCards.length > 0) {
          report += `### Main Cards:\n`;
          mainCards.forEach(card => {
            const childCount = cardsByParent.get(card.id)?.length || 0;
            report += `- **Card ${card.card_number}** (${card.id}): ${childCount} children\n`;
          });
          report += '\n';
        }
        
        if (childCards.length > 0) {
          report += `### Child Cards:\n`;
          cardsByParent.forEach((children, parentId) => {
            const parentCard = cards.find(c => c.id === parentId);
            report += `- **Parent Card ${parentCard?.card_number || '?'}** (${parentId}):\n`;
            children.forEach(child => {
              report += `  - Child Card ${child.card_number} (${child.id})\n`;
            });
          });
          report += '\n';
        }
        
        report += '---\n\n';
        
      } catch (cardError) {
        report += `- **Error loading cards**: ${cardError}\n\n`;
      }
    }
    
    return report;
    
  } catch (error) {
    return `Error generating report: ${error}`;
  }
}

// Log database analysis to console
export async function logDatabaseAnalysis(): Promise<void> {
  const report = await generateDatabaseReport();
  console.log(report);
}