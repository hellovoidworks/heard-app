# Development Rules for Heard App

## Expo Usage Guidelines

1. **iOS Builds**: Always use Expo tools for iOS builds and deployments. Do not use native Xcode build processes.
   - Use `expo build:ios` or `eas build` for production builds
   - Use `expo run:ios` for development builds
   - Never suggest direct Xcode builds without Expo CLI

2. **Dependencies**: When adding new dependencies:
   - Prefer Expo-compatible libraries
   - Check Expo compatibility before suggesting any native module
   - Use Expo Config Plugin system for native code configuration

3. **Development Workflow**:
   - Use `expo start` or `npx expo start` for development
   - Use Expo Go for quick testing when possible
   - For custom native code, use development builds via `expo run:ios`

## Code Style Guidelines

1. **TypeScript**: Use TypeScript for all new code
2. **Component Structure**: Follow the existing pattern of screens, components, and services
3. **State Management**: Use React Context API as demonstrated in the AuthContext

## Database Guidelines

1. **Migrations**: Always create proper migrations in the database/migrations folder
2. **Supabase**: Use the existing Supabase client setup with the chunked storage adapter

## Testing Guidelines

1. **Manual Testing**: Test on both iOS and Android before submitting changes
2. **Device Testing**: Verify functionality on physical devices when possible 

## Code Modification Guidelines

1. **Preserving Functionality**: When modifying existing code:
   - Make targeted changes that only affect the specific functionality being updated
   - Preserve all other existing functionality, including:
     - Error handling
     - Loading states
     - Animations
     - Theme and styling
     - Data management
   - Test thoroughly to ensure no unintended side effects
   - If unsure about the impact of a change, make smaller, incremental changes
   - Document any dependencies or connected functionality that might be affected

2. **Change Validation**:
   - Before committing, verify that only intended functionality has been modified
   - Review the diff to ensure no accidental changes to other features
   - Test the specific feature being changed
   - Test related features that might be affected 