// Define navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
  LetterDetail: { letterId: string };
  WriteLetter: { categoryId?: string; parentId?: string; threadId?: string };
  Profile: undefined;
  Notifications: undefined;
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
  Write: undefined;
  Mailbox: undefined;
  // Notifications tab removed
}; 