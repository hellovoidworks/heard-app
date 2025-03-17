# Heard App

A mobile application for community letter exchanges, built with Expo and Supabase.

## Features

- Authentication with Apple Sign In and Magic Links
- Community letter exchanges
- Categories for organizing letters
- Notifications for new letters and replies
- User profiles

## Tech Stack

- **Frontend**: React Native, Expo
- **Backend**: Supabase
- **Authentication**: Supabase Auth with Apple Sign In and Magic Links
- **Database**: PostgreSQL (via Supabase)
- **Styling**: React Native Paper

## Getting Started

### Prerequisites

- Node.js (v14 or newer)
- npm or yarn
- Expo CLI
- iOS Simulator or physical device (for iOS testing)
- Android Emulator or physical device (for Android testing)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/heard-app.git
   cd heard-app
   ```

2. Install dependencies:
   ```bash
   cd app
   npm install
   ```

3. Update Supabase configuration:
   - Open `app/src/services/supabase.ts`
   - Replace `supabaseUrl` and `supabaseAnonKey` with your own Supabase project credentials

4. Start the development server:
   ```bash
   npx expo start
   ```

### Building for iOS

1. Generate native iOS files:
   ```bash
   npx expo prebuild --platform ios
   ```

2. Open the iOS project in Xcode:
   ```bash
   open ios/HeardApp.xcworkspace
   ```

3. Build and run the project in Xcode

## Deep Linking

The app supports deep linking for authentication callbacks:

- Custom URL scheme: `heardapp://auth/callback`
- Universal links: `https://[your-supabase-project-id].supabase.co/auth/v1/callback`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 