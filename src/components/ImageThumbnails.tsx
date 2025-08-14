import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ProblemImage } from '../types';
import { XMarkIcon, PhotoIcon } from '@heroicons/react/24/outline';
import ConfirmationModal from './ConfirmationModal';

interface ImageThumbnailsProps {
  problemId: string;
  isEditing: boolean;
  className?: string;
}

export default function ImageThumbnails({ problemId, isEditing, className = '' }: ImageThumbnailsProps) {
  const [images, setImages] = useState<ProblemImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageDataUrls, setImageDataUrls] = useState<Map<string, string>>(new Map());
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    imageId: string | null;
    imageName: string;
  }>({ isOpen: false, imageId: null, imageName: '' });

  // Load images when problem changes
  useEffect(() => {
    if (problemId) {
      loadImages();
    }
  }, [problemId]);

  const loadImages = async () => {
    try {
      setLoading(true);
      const problemImages = await invoke<ProblemImage[]>('get_problem_images', { problemId });
      setImages(problemImages);
      
      // Load actual image data URLs
      const dataUrlMap = new Map<string, string>();
      for (const img of problemImages) {
        try {
          const dataUrl = await invoke<string>('get_image_data_url', { relativePath: img.image_path });
          dataUrlMap.set(img.id, dataUrl);
        } catch (error) {
          console.error('Failed to get image data URL:', error);
        }
      }
      setImageDataUrls(dataUrlMap);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  };

  const openDeleteConfirmation = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    const imageName = image?.caption || 'this image';
    
    setDeleteConfirmation({
      isOpen: true,
      imageId,
      imageName
    });
  };

  const closeDeleteConfirmation = () => {
    setDeleteConfirmation({ isOpen: false, imageId: null, imageName: '' });
  };

  const handleConfirmDelete = async () => {
    const { imageId } = deleteConfirmation;
    if (!imageId) return;

    console.log('🗑️ Confirmed deletion for imageId:', imageId);

    try {
      await invoke('delete_problem_image', { 
        request: { image_id: imageId }
      });
      
      // Remove from local state
      setImages(prev => prev.filter(img => img.id !== imageId));
      setImageDataUrls(prev => {
        const newMap = new Map(prev);
        newMap.delete(imageId);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert(`Failed to delete image: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleImageClick = (imageId: string, imageDataUrl?: string) => {
    if (isEditing) {
      // In edit mode, clicking the image triggers deletion confirmation
      openDeleteConfirmation(imageId);
    } else {
      // In view mode, clicking the image opens the full-size modal
      if (imageDataUrl) {
        setSelectedImage(imageDataUrl);
      }
    }
  };

  if (images.length === 0 && !loading) {
    return null;
  }

  return (
    <div className={`image-thumbnails ${className}`}>
      {/* Section header */}
      <div className="flex items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
        <PhotoIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Attached Images ({images.length})
        </h4>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
        </div>
      )}

      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((image) => {
          const imageDataUrl = imageDataUrls.get(image.id);
          return (
            <div 
              key={image.id} 
              className="relative group rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-500 transition-colors"
            >
              {/* Thumbnail image */}
              <div 
                className={`aspect-square cursor-pointer ${
                  isEditing 
                    ? 'hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors' 
                    : ''
                }`}
                onClick={() => handleImageClick(image.id, imageDataUrl)}
                title={isEditing ? 'Click to delete image' : 'Click to view full size'}
              >
                {imageDataUrl ? (
                  <img 
                    src={imageDataUrl} 
                    alt={image.caption || 'Problem image'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"%3E%3Cpath stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /%3E%3C/svg%3E';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PhotoIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Delete button (only in edit mode) */}
              {isEditing && (
                <button
                  onClick={(e) => {
                    console.log('🖱️ Delete button clicked for image:', image.id);
                    e.preventDefault();
                    e.stopPropagation();
                    openDeleteConfirmation(image.id);
                  }}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                  title="Delete image"
                  style={{ pointerEvents: 'auto' }}
                >
                  <XMarkIcon className="h-3 w-3" style={{ pointerEvents: 'none' }} />
                </button>
              )}
              
              {/* Edit mode overlay indicator */}
              {isEditing && (
                <div className="absolute inset-0 border-2 border-red-300 dark:border-red-600 rounded-lg opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none" />
              )}

              {/* Caption */}
              {image.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate">
                  {image.caption}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Full-size image modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={selectedImage} 
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 p-2 bg-gray-800 text-white rounded-full hover:bg-gray-700"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        onClose={closeDeleteConfirmation}
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