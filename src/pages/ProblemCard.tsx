import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { 
  ArrowLeftIcon, 
  ArrowRightIcon, 
  PlayIcon, 
  StopIcon,
  MicrophoneIcon
} from '@heroicons/react/24/outline';
import { Problem, Card } from '../types';

export default function ProblemCard() {
  const { problemId, cardId } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timerState, setTimerState] = useState({ isRunning: false, elapsedTime: 0 });
  const [recordingState, setRecordingState] = useState({ isRecording: false });

  useEffect(() => {
    if (problemId) {
      loadProblem();
    }
  }, [problemId]);

  useEffect(() => {
    if (cardId && cards.length > 0) {
      const card = cards.find(c => c.id === cardId);
      setCurrentCard(card || cards[0]);
    } else if (cards.length > 0) {
      setCurrentCard(cards[0]);
    }
  }, [cardId, cards]);

  const loadProblem = async () => {
    try {
      setLoading(true);
      const [problemResult, cardsResult] = await Promise.all([
        invoke<Problem>('get_problem_by_id', { id: problemId }),
        invoke<Card[]>('get_cards_for_problem', { problemId })
      ]);
      
      setProblem(problemResult);
      setCards(cardsResult);
      
      // If no cards exist, create the first one
      if (cardsResult.length === 0) {
        await createNewCard();
      }
      
      setError(null);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load problem:', err);
    } finally {
      setLoading(false);
    }
  };

  const createNewCard = async () => {
    if (!problemId) return;
    
    try {
      const newCard = await invoke<Card>('create_card', {
        request: {
          problem_id: problemId,
          language: 'javascript',
          parent_card_id: null
        }
      });
      
      setCards(prev => [...prev, newCard]);
      setCurrentCard(newCard);
      navigate(`/problem/${problemId}/card/${newCard.id}`);
    } catch (err) {
      console.error('Failed to create card:', err);
    }
  };

  const navigateToCard = (direction: 'prev' | 'next') => {
    if (!currentCard) return;
    
    const currentIndex = cards.findIndex(c => c.id === currentCard.id);
    let targetIndex: number;
    
    if (direction === 'prev') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : cards.length - 1;
    } else {
      targetIndex = currentIndex < cards.length - 1 ? currentIndex + 1 : 0;
    }
    
    if (targetIndex === cards.length && direction === 'next') {
      // Create new card
      createNewCard();
      return;
    }
    
    const targetCard = cards[targetIndex];
    setCurrentCard(targetCard);
    navigate(`/problem/${problemId}/card/${targetCard.id}`);
  };

  const toggleTimer = async () => {
    try {
      if (!currentCard) return;
      
      if (timerState.isRunning) {
        await invoke('stop_timer_session');
        setTimerState({ isRunning: false, elapsedTime: 0 });
      } else {
        await invoke('start_timer_session', { cardId: currentCard.id });
        setTimerState({ isRunning: true, elapsedTime: 0 });
        // Start timer update interval
        setInterval(updateTimer, 1000);
      }
    } catch (err) {
      console.error('Timer error:', err);
    }
  };

  const updateTimer = async () => {
    try {
      const state = await invoke<{isRunning: boolean; elapsedTime: number}>('get_timer_state');
      setTimerState(state);
    } catch (err) {
      console.error('Failed to update timer:', err);
    }
  };

  const toggleRecording = async () => {
    try {
      if (recordingState.isRecording) {
        await invoke('stop_recording');
        setRecordingState({ isRecording: false });
      } else {
        await invoke('start_recording');
        setRecordingState({ isRecording: true });
      }
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading problem: {error}</p>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {problem.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Card {currentCard?.card_number || 1} of {cards.length}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            {/* Card Navigation */}
            <button
              onClick={() => navigateToCard('prev')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              disabled={cards.length <= 1}
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            
            <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
              {currentCard?.card_number || 1} / {cards.length}
            </span>
            
            <button
              onClick={() => navigateToCard('next')}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>

            {/* Timer */}
            <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <button
                onClick={toggleTimer}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {timerState.isRunning ? (
                  <StopIcon className="h-4 w-4 text-red-500" />
                ) : (
                  <PlayIcon className="h-4 w-4 text-green-500" />
                )}
              </button>
              <span className="text-sm font-mono">
                {Math.floor(timerState.elapsedTime / 60)}:
                {(timerState.elapsedTime % 60).toString().padStart(2, '0')}
              </span>
            </div>

            {/* Recording */}
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                recordingState.isRecording
                  ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MicrophoneIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Problem Description */}
        <div className="w-1/3 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Problem Description
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {problem.description}
              </p>
            </div>
            
            {problem.leetcode_url && (
              <div className="mt-6">
                <a
                  href={problem.leetcode_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
                >
                  View on LeetCode →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Editor and Notes */}
        <div className="flex-1 flex flex-col">
          {/* Code Editor Placeholder */}
          <div className="flex-1 bg-gray-50 dark:bg-gray-900">
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Monaco Editor will be integrated here
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Code: {currentCard?.code || 'No code yet'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes Section Placeholder */}
          <div className="h-1/3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  QuillJS Rich Text Editor will be integrated here
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Notes: {currentCard?.notes || 'No notes yet'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}