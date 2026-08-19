'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cssberlin_cart';

function readCart(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useCart() {
  const [cartItems, setCartItems] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initial load from localStorage
  useEffect(() => {
    setCartItems(readCart());
    setIsLoaded(true);
  }, []);

  // Persist to localStorage whenever cartItems changes (after initial load)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      if (cartItems.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
      }
    } catch (e) {
      console.error('Failed to persist cart', e);
    }
  }, [cartItems, isLoaded]);

  // Cross-tab sync via the native storage event
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setCartItems(e.newValue ? JSON.parse(e.newValue) : []);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleCart = useCallback((productId: string) => {
    setCartItems((prev) => {
      const isInCart = prev.includes(productId);
      return isInCart
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
    });
  }, []);

  const isInCart = useCallback(
    (productId: string) => cartItems.includes(productId),
    [cartItems],
  );

  return {
    cartItems,
    toggleCart,
    isInCart,
    count: cartItems.length,
    isLoaded,
  };
}
