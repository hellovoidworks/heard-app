import React, { createContext, useContext, useState, useEffect } from 'react';
import { updateAppBadgeCount } from '../services/notifications';

type NotificationContextType = {
  unreadMessagesCount: number;
  unreadReactionsCount: number;
  totalUnreadCount: number;
  setUnreadMessagesCount: (count: number) => void;
  setUnreadReactionsCount: (count: number) => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadReactionsCount, setUnreadReactionsCount] = useState(0);
  
  // Calculate total unread count
  const totalUnreadCount = unreadMessagesCount + unreadReactionsCount;
  
  // Update app badge count whenever unread counts change
  useEffect(() => {
    console.log(`[NotificationContext] Total unread count: ${totalUnreadCount} (messages: ${unreadMessagesCount}, reactions: ${unreadReactionsCount})`);
    updateAppBadgeCount(totalUnreadCount);
  }, [unreadMessagesCount, unreadReactionsCount, totalUnreadCount]);
  
  return (
    <NotificationContext.Provider
      value={{
        unreadMessagesCount,
        unreadReactionsCount,
        totalUnreadCount,
        setUnreadMessagesCount,
        setUnreadReactionsCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
