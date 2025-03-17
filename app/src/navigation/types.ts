// Define navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
  LetterDetail: { letterId: string };
  WriteLetter: { categoryId?: string; parentId?: string; threadId?: string };
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
  Categories: undefined;
  Write: undefined;
  Notifications: undefined;
  Profile: undefined;
}; 