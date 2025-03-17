import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { RootStackParamList } from '../navigation/types';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'heardapp://', 
    'https://lrdylsehrfkkrjzicczz.supabase.co',
    'lrdylsehrfkkrjzicczz.supabase.co'
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          Categories: 'categories',
          Write: 'write',
          Notifications: 'notifications',
          Profile: 'profile',
        },
      },
      LetterDetail: {
        path: 'letter/:letterId',
        parse: {
          letterId: (letterId: string) => letterId,
        },
      },
      WriteLetter: {
        path: 'write/:categoryId?/:parentId?/:threadId?',
        parse: {
          categoryId: (categoryId: string) => categoryId,
          parentId: (parentId: string) => parentId,
          threadId: (threadId: string) => threadId,
        },
      },
    },
  },
  // Special handling for auth callback URLs
  async getInitialURL() {
    // First, check if the app was opened via a deep link
    const url = await Linking.getInitialURL();
    
    if (url != null) {
      return url;
    }
    
    // If not opened by a deep link, check if it was opened from a universal link
    const universalLinkUrl = await Linking.getInitialURL();
    
    if (universalLinkUrl != null) {
      return universalLinkUrl;
    }
    
    return null;
  },
  subscribe(listener) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);

    // Listen to incoming links from deep linking
    const subscription = Linking.addEventListener('url', onReceiveURL);

    return () => {
      // Clean up the event listeners
      subscription.remove();
    };
  },
};

export default linking; 