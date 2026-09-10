import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Chat, OverlayProvider, useCreateChatClient } from 'stream-chat-expo';

import { fetchToken } from '@/lib/api';
import { loadOrCreateGuest, type GuestUser } from '@/lib/guest';

type GuestContextValue = GuestUser;

const GuestContext = createContext<GuestContextValue | null>(null);

export function useGuest() {
  const guest = useContext(GuestContext);
  if (!guest) {
    throw new Error('useGuest must be used within ChatProvider');
  }
  return guest;
}

type Credentials = {
  apiKey: string;
  token: string;
  user: { id: string; name: string };
};

function ConnectedChat({
  credentials,
  children,
}: PropsWithChildren<{ credentials: Credentials }>) {
  const chatClient = useCreateChatClient({
    apiKey: credentials.apiKey,
    userData: {
      id: credentials.user.id,
      name: credentials.user.name,
    },
    tokenOrProvider: credentials.token,
  });

  if (!chatClient) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.message}>Connecting to chat…</Text>
      </View>
    );
  }

  return (
    <OverlayProvider>
      <Chat client={chatClient}>{children}</Chat>
    </OverlayProvider>
  );
}

export function ChatProvider({ children }: PropsWithChildren) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [guest, setGuest] = useState<GuestUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError(null);
      setCredentials(null);

      try {
        const nextGuest = await loadOrCreateGuest();
        const response = await fetchToken(nextGuest.userId, nextGuest.name);
        const apiKey =
          response.apiKey || process.env.EXPO_PUBLIC_STREAM_API_KEY || '';

        if (!apiKey) {
          throw new Error('Missing Stream API key');
        }

        if (!cancelled) {
          setGuest({ userId: response.user.id, name: response.user.name });
          setCredentials({
            apiKey,
            token: response.token,
            user: response.user,
          });
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to connect';
          setError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Could not connect to chat.</Text>
        <Text style={styles.detail}>{error}</Text>
        <Pressable
          style={styles.button}
          onPress={() => setRetryCount((count) => count + 1)}>
          <Text style={styles.buttonLabel}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!credentials || !guest) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.message}>Starting chat…</Text>
        <Text style={styles.detail}>Talking to the API…</Text>
      </View>
    );
  }

  return (
    <GuestContext.Provider value={guest}>
      <ConnectedChat credentials={credentials}>{children}</ConnectedChat>
    </GuestContext.Provider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: '#fff',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
  detail: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
