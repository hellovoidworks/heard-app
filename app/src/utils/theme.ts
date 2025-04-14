import { MD3DarkTheme } from 'react-native-paper';
import { fontNames } from './fonts';

// Configure custom fonts for the theme
const fontConfig = {
  fontFamily: fontNames.interRegular,
  headingFontFamily: fontNames.interMedium,
  titleFontFamily: fontNames.interSemiBold,
  bodyFontFamily: fontNames.interRegular,
  labelFontFamily: fontNames.interMedium,
  monospace: fontNames.interRegular,
};

export const darkTheme = {
  ...MD3DarkTheme,
  fonts: {
    ...MD3DarkTheme.fonts,
    // Default overrides
    default: {
      ...MD3DarkTheme.fonts.default,
      fontFamily: fontConfig.fontFamily,
    },
    // Heading styles
    displayLarge: {
      ...MD3DarkTheme.fonts.displayLarge,
      fontFamily: fontConfig.headingFontFamily,
    },
    displayMedium: {
      ...MD3DarkTheme.fonts.displayMedium,
      fontFamily: fontConfig.headingFontFamily,
    },
    displaySmall: {
      ...MD3DarkTheme.fonts.displaySmall,
      fontFamily: fontConfig.headingFontFamily,
    },
    // Title styles
    headlineLarge: {
      ...MD3DarkTheme.fonts.headlineLarge,
      fontFamily: fontConfig.titleFontFamily,
    },
    headlineMedium: {
      ...MD3DarkTheme.fonts.headlineMedium,
      fontFamily: fontConfig.titleFontFamily,
    },
    headlineSmall: {
      ...MD3DarkTheme.fonts.headlineSmall,
      fontFamily: fontConfig.titleFontFamily,
    },
    // Title styles
    titleLarge: {
      ...MD3DarkTheme.fonts.titleLarge,
      fontFamily: fontConfig.titleFontFamily,
    },
    titleMedium: {
      ...MD3DarkTheme.fonts.titleMedium,
      fontFamily: fontConfig.titleFontFamily,
    },
    titleSmall: {
      ...MD3DarkTheme.fonts.titleSmall,
      fontFamily: fontConfig.titleFontFamily,
    },
    // Body text styles
    bodyLarge: {
      ...MD3DarkTheme.fonts.bodyLarge,
      fontFamily: fontConfig.bodyFontFamily,
    },
    bodyMedium: {
      ...MD3DarkTheme.fonts.bodyMedium,
      fontFamily: fontConfig.bodyFontFamily,
    },
    bodySmall: {
      ...MD3DarkTheme.fonts.bodySmall,
      fontFamily: fontConfig.bodyFontFamily,
    },
    // Label styles
    labelLarge: {
      ...MD3DarkTheme.fonts.labelLarge,
      fontFamily: fontConfig.labelFontFamily,
    },
    labelMedium: {
      ...MD3DarkTheme.fonts.labelMedium,
      fontFamily: fontConfig.labelFontFamily,
    },
    labelSmall: {
      ...MD3DarkTheme.fonts.labelSmall,
      fontFamily: fontConfig.labelFontFamily,
    },
  },
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
}; 