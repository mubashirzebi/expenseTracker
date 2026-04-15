import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, useColorScheme, View, Text } from 'react-native';
import 'react-native-reanimated';
import '../global.css';
import { GlobalProvider } from './context/GlobalState';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../db/client';
import migrations from '../drizzle/migrations';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useMigrations(db, migrations);

  if (!success) {
    if (error) {
      console.error('Migration error:', error);
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Database Error: {error.message}</Text>
        </View>
      );
    }
    return null; // Keep splash screen or show loader
  }

  return (
    <GlobalProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="manage-categories" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </GlobalProvider>
  );
}
