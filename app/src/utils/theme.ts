import { MD3DarkTheme, configureFonts } from 'react-native-paper';

const fontConfig = {
  fontFamily: 'System',
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#BB86FC',
    secondary: '#03DAC6',
    background: '#121212',
    surface: '#1E1E1E',
    text: '#FFFFFF',
    onSurface: '#FFFFFF',
    onBackground: '#FFFFFF',
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