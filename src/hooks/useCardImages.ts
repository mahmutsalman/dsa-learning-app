import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CardImage } from '../types';

interface UseCardImagesReturn {
  images: CardImage[];
  loading: boolean;
  error: string | null;
  imageDataUrls: Map<string, string>;
  loadImages: () => Promise<void>;
  saveImage: (imageData: string, caption?: string) => Promise<CardImage | null>;
  deleteImage: (imageId: string) => Promise<boolean>;
  updatePositions: (updates: Array<{ id: string; position: number }>) => Promise<boolean>;
}

export function useCardImages(cardId: string | null): UseCardImagesReturn {
  const [images, setImages] = useState<CardImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageDataUrls, setImageDataUrls] = useState<Map<string, string>>(new Map());

  // Load images when card changes
  useEffect(() => {
    if (cardId) {
      loadImages();
    } else {
      // Clear images when no card selected
      setImages([]);
      setImageDataUrls(new Map());
    }
  }, [cardId]);

  const loadImages = useCallback(async () => {
    if (!cardId) return;

    try {
      setLoading(true);
      setError(null);

      const cardImages = await invoke<CardImage[]>('get_card_images', { cardId });
      setImages(cardImages);

      // Load actual image data URLs
      const dataUrlMap = new Map<string, string>();
      for (const img of cardImages) {
        try {
          const dataUrl = await invoke<string>('get_card_image_data_url', {
            relativePath: img.image_path
          });
          dataUrlMap.set(img.id, dataUrl);
        } catch (error) {
          console.error('Failed to get card image data URL:', error);
        }
      }
      setImageDataUrls(dataUrlMap);
    } catch (error) {
      console.error('Failed to load card images:', error);
      setError(error instanceof Error ? error.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  const saveImage = useCallback(async (imageData: string, caption?: string): Promise<CardImage | null> => {
    if (!cardId) {
      setError('No card selected');
      return null;
    }

    try {
      setError(null);

      const newImage = await invoke<CardImage>('save_card_image', {
        request: {
          card_id: cardId,
          image_data: imageData,
          caption: caption || null,
          position: images.length // Add at the end
        }
      });

      // Add to local state
      setImages(prev => [...prev, newImage]);

      // Get data URL for the new image
      try {
        const dataUrl = await invoke<string>('get_card_image_data_url', {
          relativePath: newImage.image_path
        });
        setImageDataUrls(prev => {
          const newMap = new Map(prev);
          newMap.set(newImage.id, dataUrl);
          return newMap;
        });
      } catch (error) {
        console.error('Failed to get data URL for new image:', error);
      }

      return newImage;
    } catch (error) {
      console.error('Failed to save card image:', error);
      setError(error instanceof Error ? error.message : 'Failed to save image');
      return null;
    }
  }, [cardId, images.length]);

  const deleteImage = useCallback(async (imageId: string): Promise<boolean> => {
    try {
      setError(null);

      await invoke('delete_card_image', {
        request: { image_id: imageId }
      });

      // Remove from local state
      setImages(prev => prev.filter(img => img.id !== imageId));
      setImageDataUrls(prev => {
        const newMap = new Map(prev);
        newMap.delete(imageId);
        return newMap;
      });

      return true;
    } catch (error) {
      console.error('Failed to delete card image:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete image');
      return false;
    }
  }, []);

  const updatePositions = useCallback(async (updates: Array<{ id: string; position: number }>): Promise<boolean> => {
    try {
      setError(null);

      const updatePairs = updates.map(u => [u.id, u.position] as [string, number]);
      await invoke('update_card_image_positions', { updates: updatePairs });

      // Update local state with new positions
      setImages(prev => {
        const newImages = [...prev];
        updates.forEach(update => {
          const index = newImages.findIndex(img => img.id === update.id);
          if (index !== -1) {
            newImages[index].position = update.position;
          }
        });
        // Re-sort by position
        return newImages.sort((a, b) => a.position - b.position);
      });

      return true;
    } catch (error) {
      console.error('Failed to update image positions:', error);
      setError(error instanceof Error ? error.message : 'Failed to update positions');
      return false;
    }
  }, []);

  return {
    images,
    loading,
    error,
    imageDataUrls,
    loadImages,
    saveImage,
    deleteImage,
    updatePositions
  };
}
