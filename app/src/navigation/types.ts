// Define navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  LetterDetail: { letterId: string };
  WriteLetter: { categoryId?: string; parentId?: string; threadId?: string };
};

export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
  Write: undefined;
  Notifications: undefined;
  Profile: undefined;
}; 