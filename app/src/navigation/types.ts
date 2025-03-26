// Define navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
  LetterDetail: { 
    letterId: string;
    onClose?: () => void;
  };
  MyLetterDetail: { letterId: string; };
  ThreadDetail: { letterId: string };
  WriteLetter: { categoryId?: string; parentId?: string; threadId?: string };
  WriteLetterContent: { title?: string; content?: string };
  WriteLetterDetails: { title: string; content: string; categoryId?: string };
  Profile: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  CategoryPreferencesSettings: undefined;
  AccountSettings: undefined;
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