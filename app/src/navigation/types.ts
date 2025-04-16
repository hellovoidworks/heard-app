import { LetterWithDetails } from '../types/database.types';

// Define navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
  LetterDetail: { 
    letterId: string;
    letter?: LetterWithDetails;
    onClose?: () => void;
  };
  MyLetterDetail: { 
    letterId: string; 
    letterData?: {
      id: string;
      title: string;
      content: string;
      created_at: string;
      category: {
        id: string;
        name: string;
        color: string;
      } | null;
      mood_emoji?: string;
      author_id: string;
    };
    initialStats?: {
      replyCount: number;
      readCount: number;
      reactionCount: number;
    };
  };
  ThreadDetail: { 
    letterId: string;
    otherParticipantId: string; // Added for pair-based threading
  };
  WriteLetter: { categoryId?: string; parentId?: string; threadId?: string };
  WriteLetterContent: { title?: string; content?: string };
  WriteLetterDetails: { title: string; content: string; categoryId?: string };
  Profile: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  CategoryPreferencesSettings: undefined;
  DeleteAccount: undefined;
  WebView: { url: string; title: string; };
};

export type AuthStackParamList = {
  Login: undefined;
  EmailSignIn: undefined;
};

export type OnboardingStackParamList = {
  AgeVerification: undefined;
  CategoryPreferences: undefined;
  NotificationPermission: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Mailbox: undefined;
  // Write removed as it's now accessed as a modal
}; 