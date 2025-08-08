import { useRef, useEffect } from 'react';

export interface FallbackTextEditorProps {
  value: string;
  theme: 'light' | 'dark';
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder?: string;
  className?: string;
}

export function FallbackTextEditor({
  value,
  theme,
  onChange,
  onSave,
  placeholder = 'Write your notes here...',
  className = ''
}: FallbackTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle Ctrl+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };

    if (textareaRef.current) {
      textareaRef.current.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (textareaRef.current) {
        textareaRef.current.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [onSave]);

  return (
    <div className={`h-full w-full ${className}`}>
      <div className="h-full relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full h-full p-4 resize-none border-0 outline-none
            ${theme === 'dark' 
              ? 'bg-gray-800 text-gray-100 placeholder-gray-400' 
              : 'bg-white text-gray-900 placeholder-gray-500'
            }
            font-sans text-sm leading-relaxed
            focus:ring-0 focus:outline-none
            text-wrap-responsive
            min-w-0
          `}
          style={{
            minHeight: '100%',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            wordWrap: 'break-word',
            overflowWrap: 'anywhere',
            whiteSpace: 'pre-wrap'
          }}
        />
        
        {/* Simple formatting indicator */}
        <div className={`
          absolute bottom-2 right-2 text-xs 
          ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}
        `}>
          Plain Text Mode
        </div>
      </div>
    </div>
  );
}