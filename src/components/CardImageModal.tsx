import { useEffect, useCallback, useState } from 'react';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { CardImage } from '../types';

interface CardImageModalProps {
  isOpen: boolean;
  images: CardImage[];
  imageDataUrls: Map<string, string>;
  currentImageId: string | null;
  onClose: () => void;
  onNavigate?: (imageId: string) => void;
}

export function CardImageModal({
  isOpen,
  images,
  imageDataUrls,
  currentImageId,
  onClose,
  onNavigate
}: CardImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Update current index when currentImageId changes
  useEffect(() => {
    if (currentImageId) {
      const index = images.findIndex(img => img.id === currentImageId);
      if (index !== -1) {
        setCurrentIndex(index);
      }
    }
  }, [currentImageId, images]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        navigatePrevious();
        break;
      case 'ArrowRight':
        navigateNext();
        break;
    }
  }, [isOpen, currentIndex, images.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const navigatePrevious = useCallback(() => {
    if (images.length === 0) return;

    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    setCurrentIndex(newIndex);

    if (onNavigate) {
      onNavigate(images[newIndex].id);
    }
  }, [currentIndex, images, onNavigate]);

  const navigateNext = useCallback(() => {
    if (images.length === 0) return;

    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);

    if (onNavigate) {
      onNavigate(images[newIndex].id);
    }
  }, [currentIndex, images, onNavigate]);

  if (!isOpen || images.length === 0 || currentIndex >= images.length) {
    return null;
  }

  const currentImage = images[currentIndex];
  const imageUrl = imageDataUrls.get(currentImage.id);

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Modal Content */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gray-900 bg-opacity-75 text-white p-3 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-3">
            {/* Image Counter */}
            <span className="text-sm font-medium">
              {currentIndex + 1} of {images.length}
            </span>

            {/* Caption */}
            {currentImage.caption && (
              <span className="text-sm text-gray-300 truncate max-w-md">
                {currentImage.caption}
              </span>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
            title="Close (ESC)"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Image Container */}
        <div className="relative bg-black flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={currentImage.caption || 'Card image'}
              className="max-w-full max-h-[calc(90vh-8rem)] object-contain"
            />
          ) : (
            <div className="flex items-center justify-center w-96 h-96 bg-gray-800 text-gray-400">
              <span>Loading image...</span>
            </div>
          )}

          {/* Navigation Buttons */}
          {images.length > 1 && (
            <>
              {/* Previous Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigatePrevious();
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-gray-900 bg-opacity-75 text-white rounded-lg hover:bg-opacity-90 transition-all"
                title="Previous (←)"
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </button>

              {/* Next Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigateNext();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gray-900 bg-opacity-75 text-white rounded-lg hover:bg-opacity-90 transition-all"
                title="Next (→)"
              >
                <ChevronRightIcon className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Footer with Thumbnails */}
        {images.length > 1 && (
          <div className="bg-gray-900 bg-opacity-75 p-3 rounded-b-lg">
            <div className="flex gap-2 justify-center overflow-x-auto max-w-full">
              {images.map((image, index) => {
                const thumbUrl = imageDataUrls.get(image.id);
                return (
                  <button
                    key={image.id}
                    onClick={() => {
                      setCurrentIndex(index);
                      if (onNavigate) {
                        onNavigate(image.id);
                      }
                    }}
                    className={`
                      flex-shrink-0 w-12 h-12 rounded overflow-hidden border-2 transition-all
                      ${index === currentIndex
                        ? 'border-primary-500 opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-80'
                      }
                    `}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-700" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}