export type UserProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
  push_token: string | null;
  birthdate: string | null;
  onboarding_step: string | null;
  onboarding_completed: boolean | null;
  notifications_enabled: boolean | null;
  notification_preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type Letter = {
  id: string;
  author_id: string;
  display_name: string;
  title: string;
  content: string;
  category_id: string;
  parent_id: string | null;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Reaction = {
  id: string;
  user_id: string;
  letter_id: string;
  reaction_type: string;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_id: string;
  sender_id: string | null;
  letter_id: string | null;
  reaction_id: string | null;
  type: 'reply' | 'reaction';
  read: boolean;
  created_at: string;
};

export type UserCategoryPreference = {
  id: string;
  user_id: string;
  category_id: string;
  created_at: string;
};

export type LetterRead = {
  id: string;
  user_id: string;
  letter_id: string;
  read_at: string;
  created_at: string;
};

// Extended types with related data
export type LetterWithDetails = Letter & {
  category: Category;
  author: UserProfile;
  reactions: Reaction[];
  is_read?: boolean;
};

export type NotificationWithDetails = Notification & {
  sender?: UserProfile;
  letter?: Letter;
  reaction?: Reaction;
}; 