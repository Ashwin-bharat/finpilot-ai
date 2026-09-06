'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AssetClass } from '@finpilot/shared-types';

interface AssetClassContextType {
  assetClass: AssetClass;
  setAssetClass: (assetClass: AssetClass) => void;
  isCrypto: boolean;
}

const AssetClassContext = createContext<AssetClassContextType | undefined>(undefined);

const STORAGE_KEY = 'finpilot_asset_class';

export function AssetClassProvider({ children }: { children: React.ReactNode }) {
  const [assetClass, setAssetClassState] = useState<AssetClass>('stocks');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'crypto' || stored === 'stocks') {
        setAssetClassState(stored);
      }
    } catch {
      // Ignore localStorage errors in restricted environments
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const setAssetClass = (newClass: AssetClass) => {
    setAssetClassState(newClass);
    try {
      localStorage.setItem(STORAGE_KEY, newClass);
    } catch {
      // Ignore
    }
  };

  return (
    <AssetClassContext.Provider
      value={{
        assetClass,
        setAssetClass,
        isCrypto: assetClass === 'crypto',
      }}
    >
      {children}
    </AssetClassContext.Provider>
  );
}

export function useAssetClass(): AssetClassContextType {
  const context = useContext(AssetClassContext);
  if (!context) {
    throw new Error('useAssetClass must be used within an AssetClassProvider');
  }
  return context;
}
