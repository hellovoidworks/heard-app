import React, { createContext, useContext, useState } from 'react';

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface PreloadContextType {
  preloadedCategories: Category[];
  setPreloadedCategories: (categories: Category[]) => void;
}

const PreloadContext = createContext<PreloadContextType>({
  preloadedCategories: [],
  setPreloadedCategories: () => {},
});

export const usePreload = () => useContext(PreloadContext);

export const PreloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preloadedCategories, setPreloadedCategories] = useState<Category[]>([]);

  return (
    <PreloadContext.Provider value={{ preloadedCategories, setPreloadedCategories }}>
      {children}
    </PreloadContext.Provider>
  );
};
