import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Card, Mission } from '../types/spywar';

export type ZoomableItem = Card | (Mission & { type: 'Mission' });

interface CardZoomContextType {
  highlightedItem: ZoomableItem | null;
  setHighlightedItem: (item: ZoomableItem | null) => void;
  clearHighlightedItem: (item: ZoomableItem) => void;
  zoomedItem: ZoomableItem | null;
  setZoomedItem: (item: ZoomableItem | null) => void;
  zoomScale: '3x' | '5x';
  setZoomScale: (scale: '3x' | '5x') => void;
  openZoom: (item?: ZoomableItem) => void;
  closeZoom: () => void;
  toggleZoom: () => void;
}

const CardZoomContext = createContext<CardZoomContextType | undefined>(undefined);

export const CardZoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [highlightedItem, setHighlightedItemState] = useState<ZoomableItem | null>(null);
  const [zoomedItem, setZoomedItem] = useState<ZoomableItem | null>(null);
  const [zoomScale, setZoomScale] = useState<'3x' | '5x'>('3x');

  // Keep a ref of highlightedItem and zoomedItem to read inside event listener without stale closures
  const highlightedRef = useRef<ZoomableItem | null>(null);
  const zoomedRef = useRef<ZoomableItem | null>(null);

  useEffect(() => {
    highlightedRef.current = highlightedItem;
  }, [highlightedItem]);

  useEffect(() => {
    zoomedRef.current = zoomedItem;
  }, [zoomedItem]);

  const setHighlightedItem = useCallback((item: ZoomableItem | null) => {
    setHighlightedItemState(item);
  }, []);

  const clearHighlightedItem = useCallback((item: ZoomableItem) => {
    setHighlightedItemState(prev => (prev?.id === item.id ? null : prev));
  }, []);

  const openZoom = useCallback((item?: ZoomableItem) => {
    const target = item || highlightedRef.current;
    if (target) {
      setZoomedItem(target);
    }
  }, []);

  const closeZoom = useCallback(() => {
    setZoomedItem(null);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const toggleZoom = useCallback(() => {
    if (zoomedRef.current) {
      closeZoom();
    } else if (highlightedRef.current) {
      setZoomedItem(highlightedRef.current);
    }
  }, [closeZoom]);

  // Global Spacebar Keydown Handler (Tabletopia style accessibility)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when user is actively typing in input fields
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Spacebar: toggle zoomed card 3x/5x
      if (e.code === 'Space' || e.key === ' ') {
        if (zoomedRef.current) {
          e.preventDefault();
          closeZoom();
        } else if (highlightedRef.current) {
          e.preventDefault();
          setZoomedItem(highlightedRef.current);
        }
      }

      // Escape: close zoomed view
      if (e.key === 'Escape' && zoomedRef.current) {
        e.preventDefault();
        closeZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeZoom]);

  return (
    <CardZoomContext.Provider
      value={{
        highlightedItem,
        setHighlightedItem,
        clearHighlightedItem,
        zoomedItem,
        setZoomedItem,
        zoomScale,
        setZoomScale,
        openZoom,
        closeZoom,
        toggleZoom,
      }}
    >
      {children}
    </CardZoomContext.Provider>
  );
};

export const useCardZoom = (): CardZoomContextType => {
  const context = useContext(CardZoomContext);
  if (!context) {
    throw new Error('useCardZoom must be used within a CardZoomProvider');
  }
  return context;
};
