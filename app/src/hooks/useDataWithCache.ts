import { useState, useEffect, useCallback, useRef } from 'react';
import dataCache from '../utils/dataCache';

type FetchFunction<T> = () => Promise<T>;

interface UseDataWithCacheOptions<T> {
  cacheKey: string;
  fetchFunction: FetchFunction<T>;
  initialData?: T;
  onDataLoaded?: (data: T) => void;
}

export function useDataWithCache<T>({
  cacheKey,
  fetchFunction,
  initialData,
  onDataLoaded
}: UseDataWithCacheOptions<T>) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstFocus = useRef(true);

  // Main fetch function that shows loading spinner
  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      if (refreshing) setRefreshing(true);
      
      console.log(`[useDataWithCache] Fetching data for ${cacheKey}`);
      const result = await fetchFunction();
      
      setData(result);
      
      if (onDataLoaded) {
        onDataLoaded(result);
      }
      
      // Cache the results
      await dataCache.saveToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error(`Error fetching data for ${cacheKey}:`, error);
      return undefined;
    } finally {
      setLoading(false);
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [cacheKey, fetchFunction, onDataLoaded, refreshing]);

  // Background refresh function that doesn't show loading spinner
  const refreshInBackground = useCallback(async () => {
    console.log(`[useDataWithCache] Refreshing ${cacheKey} in background`);
    try {
      const result = await fetchFunction();
      
      setData(result);
      
      if (onDataLoaded) {
        onDataLoaded(result);
      }
      
      // Cache the results
      await dataCache.saveToCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error(`Error refreshing in background for ${cacheKey}:`, error);
      return undefined;
    }
  }, [cacheKey, fetchFunction, onDataLoaded]);

  // Handle pull-to-refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Initial load with cache
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Try to get cached data first
        const { data: cachedData, isFresh } = await dataCache.getFromCache<T>(cacheKey);
        
        if (cachedData) {
          console.log(`[useDataWithCache] Using cached data for ${cacheKey}`);
          setData(cachedData);
          setInitialLoading(false);
          
          if (onDataLoaded) {
            onDataLoaded(cachedData);
          }
          
          // If cache is stale, refresh in background
          if (!isFresh) {
            console.log(`[useDataWithCache] Cache for ${cacheKey} is stale, refreshing in background`);
            refreshInBackground();
          }
        } else {
          // No cache, do normal fetch
          console.log(`[useDataWithCache] No cache found for ${cacheKey}, doing normal fetch`);
          fetchData();
        }
      } catch (error) {
        console.error(`Error loading initial data for ${cacheKey}:`, error);
        fetchData();
      }
    };
    
    loadInitialData();
  }, [cacheKey, fetchData, onDataLoaded, refreshInBackground]);

  // Function to be called in useFocusEffect
  const handleFocus = useCallback(() => {
    console.log(`[useDataWithCache] Screen for ${cacheKey} focused`);
    
    if (isFirstFocus.current) {
      isFirstFocus.current = false;
      return;
    }
    
    // Refresh in background when returning to this screen
    refreshInBackground();
  }, [cacheKey, refreshInBackground]);

  return {
    data,
    loading,
    initialLoading,
    refreshing,
    fetchData,
    refreshInBackground,
    handleRefresh,
    handleFocus,
    setData
  };
}
