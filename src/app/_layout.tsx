import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChatProvider } from '@/providers/chat-provider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <ChatProvider>
          <Stack>
            <Stack.Screen name="index" options={{ title: 'Matches' }} />
            <Stack.Screen name="match/[matchId]/index" options={{ title: 'Match' }} />
            <Stack.Screen name="match/[matchId]/chat" options={{ title: 'Chat' }} />
          </Stack>
        </ChatProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
