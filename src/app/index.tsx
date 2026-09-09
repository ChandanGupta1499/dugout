import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchMatches } from '@/lib/api';
import type { Match } from '@/lib/matches';
import { useGuest } from '@/providers/chat-provider';

export default function MatchesScreen() {
  const guest = useGuest();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchMatches();
      setMatches(next);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load matches';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches, retryCount]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Live match chat</Text>
        <Text style={styles.signedIn}>Signed in as {guest.name}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.message}>Loading matches…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.message}>Could not load matches.</Text>
          <Text style={styles.detail}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => setRetryCount((count) => count + 1)}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Link href={`/match/${item.id}`} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
                {!item.channelId ? (
                  <Text style={styles.chatSoon}>Chat coming soon</Text>
                ) : null}
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={
            <Text style={styles.message}>No matches yet.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 4,
  },
  eyebrow: {
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#666',
  },
  signedIn: {
    fontSize: 14,
    color: '#333',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    borderRadius: 12,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  chatSoon: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
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
  retryButton: {
    marginTop: 8,
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
