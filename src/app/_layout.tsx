import 'react-native-gesture-handler';

import { PortalProvider } from '@gorhom/portal';
import { Archivo_900Black_Italic } from '@expo-google-fonts/archivo';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_800ExtraBold,
  HankenGrotesk_800ExtraBold_Italic,
  HankenGrotesk_900Black_Italic,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChatProvider } from '@/providers/chat-provider';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_900Black_Italic,
    HankenGrotesk_400Regular,
    HankenGrotesk_800ExtraBold,
    HankenGrotesk_800ExtraBold_Italic,
    HankenGrotesk_900Black_Italic,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.container}>
        <PortalProvider>
          <ChatProvider>
            <Stack>
              <Stack.Screen name="index" options={{ title: 'Matches' }} />
              <Stack.Screen name="match/[matchId]/index" options={{ title: 'Match' }} />
              <Stack.Screen name="match/[matchId]/chat" options={{ headerShown: false }} />
            </Stack>
          </ChatProvider>
        </PortalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
