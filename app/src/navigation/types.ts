// Define navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
  LetterDetail: { letterId: string };
  ThreadDetail: { letterId: string };
  WriteLetter: { categoryId?: string; parentId?: string; threadId?: string };
  Profile: undefined;
  Notifications: undefined;
  NotificationSettings: undefined;
  CategoryPreferencesSettings: undefined;
  AccountSettings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
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