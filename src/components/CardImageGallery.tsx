import { useState } from 'react';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { CardImage } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface CardImageGalleryProps {
  images: CardImage[];
  imageDataUrls: Map<string, string>;
  onImageClick: (imageId: string, imageUrl: string) => void;
  onImageDelete?: (imageId: string) => Promise<boolean>;
  onImageReorder?: (updates: Array<{ id: string; position: number }>) => Promise<boolean>;
  className?: string;
}

export function CardImageGallery({
  images,
  imageDataUrls,
  onImageClick,
  onImageDelete,
  onImageReorder,
  className = ''
}: CardImageGalleryProps) {
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    imageId: string | null;
    imageName: string;
  }>({ isOpen: false, imageId: null, imageName: '' });

  const [draggedImage, setDraggedImage] = useState<string | null>(null);

  if (images.length === 0) {
    return null; // Don't show anything if no images
  }

  const handleDeleteClick = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation(); // Prevent opening the image modal
    const image = images.find(img => img.id === imageId);
    setDeleteConfirmation({
      isOpen: true,
      imageId,
      imageName: image?.caption || 'this image'
    });
  };

  const handleConfirmDelete = async () => {
    const { imageId } = deleteConfirmation;
    if (!imageId || !onImageDelete) return;

    try {
      await onImageDelete(imageId);
      setDeleteConfirmation({ isOpen: false, imageId: null, imageName: '' });
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert('Failed to delete image');
    }
  };

  const handleDragStart = (e: React.DragEvent, imageId: string) => {
    setDraggedImage(imageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetImageId: string) => {
    e.preventDefault();

    if (!draggedImage || !onImageReorder || draggedImage === targetImageId) {
      setDraggedImage(null);
      return;
    }

    const draggedIndex = images.findIndex(img => img.id === draggedImage);
    const targetIndex = images.findIndex(img => img.id === targetImageId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedImage(null);
      return;
    }

    // Create new positions array
    const newImages = [...images];
    const [draggedItem] = newImages.splice(draggedIndex, 1);
    newImages.splice(targetIndex, 0, draggedItem);

    // Update positions
    const updates = newImages.map((img, index) => ({
      id: img.id,
      position: index
    }));

    await onImageReorder(updates);
    setDraggedImage(null);
  };

  return (
    <div className={`card-image-gallery ${className}`}>
      {/* Gallery Container */}
      <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 p-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            <PhotoIcon className="h-3.5 w-3.5 mr-1" />
            <span className="font-medium">Images ({images.length})</span>
          </div>
        </div>

        {/* Thumbnail Strip */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {images.map((image) => {
            const imageUrl = imageDataUrls.get(image.id);
            return (
              <div
                key={image.id}
                className={`
                  relative group flex-shrink-0 cursor-pointer
                  transition-all duration-200 ease-in-out
                  ${draggedImage === image.id ? 'opacity-50' : ''}
                `}
                draggable={!!onImageReorder}
                onDragStart={(e) => handleDragStart(e, image.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, image.id)}
                onClick={() => imageUrl && onImageClick(image.id, imageUrl)}
              >
                {/* Thumbnail Container */}
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:border-primary-500 transition-colors">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={image.caption || 'Card image'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback if image fails to load
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /%3E%3C/svg%3E';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <PhotoIcon className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Delete Button */}
                {onImageDelete && (
                  <button
                    onClick={(e) => handleDeleteClick(e, image.id)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                    title="Delete image"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                )}

                {/* Caption Tooltip */}
                {image.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-[10px] px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="truncate block">{image.caption}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={() => setDeleteConfirmation({ isOpen: false, imageId: null, imageName: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Image"
        message={`Are you sure you want to delete ${deleteConfirmation.imageName}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}