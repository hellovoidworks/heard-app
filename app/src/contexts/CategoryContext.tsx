import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Alert } from 'react-native';
import { Category } from '../types/database.types';

type CategoryContextData = {
  categories: Category[];
  loading: boolean;
  refreshCategories: () => Promise<void>;
  selectedCategory: Category | null;
  setSelectedCategory: (category: Category | null) => void;
};

const CategoryContext = createContext<CategoryContextData>({} as CategoryContextData);

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      if (data) {
        setCategories(data as Category[]);
      }
    } catch (error: any) {
      console.error('Error fetching categories:', error.message);
      Alert.alert('Error', 'Failed to load categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CategoryContext.Provider value={{ 
      categories, 
      loading, 
      refreshCategories: fetchCategories,
      selectedCategory,
      setSelectedCategory
    }}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategories = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategories must be used within a CategoryProvider');
  }
  return context;
}; 