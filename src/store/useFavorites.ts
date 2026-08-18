import { useState, useEffect } from 'react';

// Manages local favorite state for unauthenticated users,
// and acts as a placeholder for authenticated users.
export function useFavorites() {
  const [localFavorites, setLocalFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cssberlin_favorites');
      if (stored) {
        setLocalFavorites(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load favorites from local storage', e);
    }
    setIsLoaded(true);
  }, []);

  const toggleFavorite = (productId: string) => {
    setLocalFavorites((prev) => {
      const isFavorited = prev.includes(productId);
      const updated = isFavorited
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
        
      try {
        localStorage.setItem('cssberlin_favorites', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save favorites to local storage', e);
      }
      
      return updated;
    });
  };

  const isFavorited = (productId: string) => localFavorites.includes(productId);

  return {
    localFavorites,
    toggleFavorite,
    isFavorited,
    count: localFavorites.length,
    isLoaded
  };
}
