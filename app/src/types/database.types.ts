export type UserProfile = {
  id: string;
  username: string;
  // @deprecated This field is no longer used by the application
  avatar_url: string | null;
  push_token: string | null;
  birthdate: string | null;
  onboarding_step: string | null;
  onboarding_completed: boolean | null;
  notification_preferences: {
    enabled: boolean;
    new_replies?: boolean;
    new_reactions?: boolean;
    system_announcements?: boolean;
    [key: string]: any; // Allow for future notification types
  };
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

export type Letter = {
  id: string;
  author_id: string;
  display_name: string;
  title: string;
  content: string;
  category_id: string;
  mood_emoji: string;
  created_at: string;
  updated_at: string;
};

export type Reply = {
  id: string;
  letter_id: string;
  author_id: string;
  display_name: string;
  content: string;
  reply_to_id: string | null;
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

export type ReplyRead = {
  id: string;
  user_id: string;
  reply_id: string;
  read_at: string;
  created_at: string;
};

export type LetterReceived = {
  id: string;
  user_id: string;
  letter_id: string;
  received_at: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

// Extended types with related data
export type LetterWithDetails = Letter & {
  category: Category;
  author: UserProfile;
  reactions: Reaction[];
  replies?: Reply[];
  is_read?: boolean;
  display_order?: number;
};

export type ReplyWithDetails = Reply & {
  author?: UserProfile;
  is_read?: boolean;
};

export type NotificationWithDetails = Notification & {
  sender?: UserProfile;
  letter?: Letter;
  reaction?: Reaction;
  data?: {
    reaction_type?: string;
    [key: string]: any;
  };
};

export interface Database {
  public: {
    Tables: {
      reactions: {
        Row: {
          id: string;
          user_id: string;
          letter_id: string;
          reaction_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          letter_id: string;
          reaction_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          letter_id?: string;
          reaction_type?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reactions_letter_id_fkey";
            columns: ["letter_id"];
            referencedRelation: "letters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reactions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      
      replies: {
        Row: {
          id: string;
          letter_id: string;
          author_id: string;
          display_name: string;
          content: string;
          reply_to_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          letter_id: string;
          author_id: string;
          display_name: string;
          content: string;
          reply_to_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          letter_id?: string;
          author_id?: string;
          display_name?: string;
          content?: string;
          reply_to_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "replies_letter_id_fkey";
            columns: ["letter_id"];
            referencedRelation: "letters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "replies_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "replies_reply_to_id_fkey";
            columns: ["reply_to_id"];
            referencedRelation: "replies";
            referencedColumns: ["id"];
          }
        ];
      };
      
      reply_reads: {
        Row: {
          id: string;
          user_id: string;
          reply_id: string;
          read_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reply_id: string;
          read_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          reply_id?: string;
          read_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reply_reads_reply_id_fkey";
            columns: ["reply_id"];
            referencedRelation: "replies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reply_reads_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
  };
} 