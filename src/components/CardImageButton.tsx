import { useState, useCallback } from 'react';
import { PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';

interface CardImageButtonProps {
  onImagePaste: (imageData: string) => Promise<void>;
  imageCount: number;
  disabled?: boolean;
  className?: string;
}

export function CardImageButton({
  onImagePaste,
  imageCount,
  disabled = false,
  className = ''
}: CardImageButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClick = useCallback(async () => {
    if (disabled || isProcessing) return;

    try {
      setIsProcessing(true);

      // Try to read from clipboard
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        try {
          const clipboardItems = await navigator.clipboard.read();

          for (const item of clipboardItems) {
            // Check for image types
            const imageTypes = item.types.filter(type => type.startsWith('image/'));

            if (imageTypes.length > 0) {
              const blob = await item.getType(imageTypes[0]);

              // Convert blob to base64
              const reader = new FileReader();
              reader.onload = async (event) => {
                const base64Data = event.target?.result as string;
                await onImagePaste(base64Data);
              };
              reader.readAsDataURL(blob);

              return; // Exit after processing first image
            }
          }

          // No image found in clipboard
          alert('No image found in clipboard. Please copy an image first.');
        } catch (error) {
          console.error('Failed to read clipboard:', error);

          // Fallback: Show instructions for manual paste
          alert('Please copy an image and then click this button again.\n\nAlternatively, you can paste directly in the notes editor.');
        }
      } else {
        // Clipboard API not supported
        alert('Clipboard access is not supported in this browser.\n\nPlease paste images directly in the notes editor.');
      }
    } catch (error) {
      console.error('Error handling image paste:', error);
      alert('Failed to paste image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [disabled, isProcessing, onImagePaste]);

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isProcessing}
      className={`
        inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg
        transition-all duration-200 ease-in-out
        ${disabled || isProcessing
          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
          : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:shadow-sm'
        }
        ${className}
      `}
      title={disabled ? 'Select a card to add images' : 'Paste image from clipboard'}
    >
      <div className="relative">
        <PhotoIcon className="h-4 w-4" />
        {imageCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-primary-500 text-white text-[10px] rounded-full px-1 min-w-[16px] h-4 flex items-center justify-center font-medium">
            {imageCount}
          </span>
        )}
      </div>

      {isProcessing ? (
        <>
          <div className="ml-2 animate-spin rounded-full h-3 w-3 border border-current border-t-transparent" />
          <span className="ml-1">Processing...</span>
        </>
      ) : (
        <>
          <PlusIcon className="ml-1 h-3 w-3" />
          <span className="ml-1">Add Image</span>
        </>
      )}
    </button>
  );
}