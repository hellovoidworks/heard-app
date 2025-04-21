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
      display_name?: string;
    };
    initialStats?: {
      replyCount: number;
      readCount: number;
      reactionCount: number;
    };
    presentationMode?: 'modal' | 'push'; // To control how the screen is presented
  };
  ThreadDetail: { 
    letterId: string;
    otherParticipantId: string; // Added for pair-based threading
    presentationMode?: 'modal' | 'push'; // To control how the screen is presented
    initialCorrespondence?: {
      letter_id: string;
      letter_title: string;
      letter_author_id: string;
      letter_display_name?: string;
      other_participant_id: string;
      other_participant_name?: string;
      most_recent_interaction_at: string;
      most_recent_interaction_content: string;
      most_recent_interactor_id: string;
      unread_message_count: number;
      category_name: string | null;
      category_color: string | null;
      mood_emoji: string | null;
    };
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
  Mailbox: {
    unreadCount?: number;
  };
  // Write removed as it's now accessed as a modal
}; 