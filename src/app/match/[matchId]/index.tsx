import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchMatch } from '@/lib/api';
import type { Match } from '@/lib/matches';

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadMatch = useCallback(async () => {
    if (!matchId) {
      setError('Missing match id');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await fetchMatch(matchId);
      setMatch(next);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load match';
      setError(message);
      setMatch(null);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    void loadMatch();
  }, [loadMatch, retryCount]);

  const title = match?.title ?? 'Match';
  const subtitle = match?.subtitle ?? 'Open the live chat for this match.';

  return (
    <>
      <Stack.Screen options={{ title }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
            <Text style={styles.message}>Loading match…</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.message}>Could not load match.</Text>
            <Text style={styles.detail}>{error}</Text>
            <Pressable
              style={styles.button}
              onPress={() => setRetryCount((count) => count + 1)}>
              <Text style={styles.buttonLabel}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            {match?.channelId ? (
              <Link href={`/match/${matchId}/chat`} asChild>
                <Pressable style={styles.button}>
                  <Text style={styles.buttonLabel}>Open chat</Text>
                </Pressable>
              </Link>
            ) : (
              <Text style={styles.chatUnavailable}>
                Chat isn’t set up for this match yet.
              </Text>
            )}
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
  },
  chatUnavailable: {
    fontSize: 15,
    color: '#666',
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
    alignSelf: 'flex-start',
    backgroundColor: '#111',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
