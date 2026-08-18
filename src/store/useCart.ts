import { useState, useEffect } from 'react';

export function useCart() {
  const [cartItems, setCartItems] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cssberlin_cart');
      if (stored) {
        setCartItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load cart from local storage', e);
    }
    setIsLoaded(true);
  }, []);

  const toggleCart = (productId: string) => {
    setCartItems((prev) => {
      const isInCart = prev.includes(productId);
      const updated = isInCart
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
        
      try {
        localStorage.setItem('cssberlin_cart', JSON.stringify(updated));
        // trigger global event so other tabs/components update
        window.dispatchEvent(new Event('cart-updated'));
      } catch (e) {
        console.error('Failed to save cart to local storage', e);
      }
      
      return updated;
    });
  };

  const isInCart = (productId: string) => cartItems.includes(productId);

  // Auto-sync if updated from another component
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem('cssberlin_cart');
        if (stored) {
          setCartItems(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to parse cart sync', e);
      }
    };

    window.addEventListener('cart-updated', handleStorageChange);
    return () => window.removeEventListener('cart-updated', handleStorageChange);
  }, []);

  return {
    cartItems,
    toggleCart,
    isInCart,
    count: cartItems.length,
    isLoaded
  };
}
