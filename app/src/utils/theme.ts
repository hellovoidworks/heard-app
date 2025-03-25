import { MD3DarkTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  fontFamily: 'System',
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#476EF1',
    onPrimary: '#FFFFFF',
    primaryContainer: '#0C2170',
    onPrimaryContainer: '#DCEAFF',
    secondary: '#6680F2',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#1B3AA3',
    onSecondaryContainer: '#DCEAFF',
    background: '#121212',
    onBackground: '#FFFFFF',
    surface: '#1E1E1E',
    onSurface: '#FFFFFF',
    surfaceVariant: '#2C2C2C',
    onSurfaceVariant: '#BABABA',
    onSurfaceDisabled: '#606060',
    outline: '#3A3A3A',
    error: '#CF6679',
    onError: '#000000',
    errorContainer: '#370B1E',
    onErrorContainer: '#F9D8D6',
    elevation: {
      level0: '#121212',
      level1: '#1E1E1E',
      level2: '#222222',
      level3: '#252525',
      level4: '#272727',
      level5: '#2C2C2C',
    },
  },
  fonts: configureFonts({ config: fontConfig }),
}; 