import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import {
  Channel,
  MessageComposer,
  MessageList,
  useChatContext,
} from 'stream-chat-expo';
import type { Channel as StreamChannel } from 'stream-chat';

import { MatchScoreboardBar } from '@/components/match-scoreboard-bar';
import {
  ensureMatchChannel,
  fetchMatch,
  fetchScoreboard,
  requestBotBanter,
  type MatchScoreboard,
} from '@/lib/api';
import type { Match, MatchTeam } from '@/lib/matches';
import { useGuest } from '@/providers/chat-provider';

export default function MatchChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const guest = useGuest();
  const { client } = useChatContext();
  const headerHeight = useHeaderHeight();
  const headerHeightRef = useRef(headerHeight);

  const [match, setMatch] = useState<Match | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pendingTeam, setPendingTeam] = useState<string | null>(null);
  const [banterError, setBanterError] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState<MatchScoreboard | null>(null);

  const hasBotTeams = Boolean(match?.teamA && match?.teamB);

  const joinChannel = useCallback(async () => {
    if (!matchId) {
      setError('Missing match id');
      return;
    }

    setError(null);
    setChannel(null);
    setMatch(null);

    try {
      const nextMatch = await fetchMatch(matchId);
      setMatch(nextMatch);

      const { channelType, channelId } = await ensureMatchChannel(
        matchId,
        guest.userId,
      );
      const nextChannel = client.channel(channelType, channelId);
      await nextChannel.watch();
      setChannel(nextChannel);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join chat';
      setError(message);
    }
  }, [client, guest.userId, matchId]);

  useEffect(() => {
    void joinChannel();
  }, [joinChannel, retryCount]);

  useEffect(() => {
    if (!matchId || !match?.teamA || !match?.teamB) {
      setScoreboard(null);
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      try {
        const next = await fetchScoreboard(matchId);
        if (!cancelled) {
          setScoreboard(next);
        }
      } catch (err) {
        console.warn('Scoreboard refresh failed', err);
      }
    };

    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [match?.teamA, match?.teamB, matchId]);

  const triggerBanter = useCallback(
    async (team: MatchTeam) => {
      if (!matchId || pendingTeam) {
        return;
      }

      setBanterError(null);
      setPendingTeam(team.slug);

      try {
        await requestBotBanter(matchId, team.slug);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to post bot banter';
        console.warn('Bot banter request failed', err);
        setBanterError(message);
      } finally {
        setPendingTeam(null);
      }
    },
    [matchId, pendingTeam],
  );

  if (error) {
    return (
      <>
        <Stack.Screen options={{ title: match?.title ?? 'Chat' }} />
        <View style={styles.centered}>
          <Text style={styles.message}>Could not open match chat.</Text>
          <Text style={styles.detail}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => setRetryCount((count) => count + 1)}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (!channel) {
    return (
      <>
        <Stack.Screen options={{ title: match?.title ?? 'Chat' }} />
        <View style={styles.centered}>
          <ActivityIndicator />
          <Text style={styles.message}>Joining match chat…</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: match?.title ?? 'Chat' }} />
      <Channel
        channel={channel}
        keyboardVerticalOffset={headerHeightRef.current}
        topInset={headerHeightRef.current}>
        {scoreboard ? <MatchScoreboardBar scoreboard={scoreboard} /> : null}
        <MessageList />
        {hasBotTeams && match?.teamA && match?.teamB ? (
          <View style={styles.botBar}>
            <Pressable
              style={[
                styles.botButton,
                pendingTeam !== null && styles.botButtonDisabled,
              ]}
              disabled={pendingTeam !== null}
              onPress={() => void triggerBanter(match.teamA!)}>
              {pendingTeam === match.teamA.slug ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botButtonLabel}>
                  {match.teamA.label} Fan
                </Text>
              )}
            </Pressable>
            <Pressable
              style={[
                styles.botButton,
                pendingTeam !== null && styles.botButtonDisabled,
              ]}
              disabled={pendingTeam !== null}
              onPress={() => void triggerBanter(match.teamB!)}>
              {pendingTeam === match.teamB.slug ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.botButtonLabel}>
                  {match.teamB.label} Fan
                </Text>
              )}
            </Pressable>
            {banterError ? (
              <Text style={styles.banterError} numberOfLines={2}>
                {banterError}
              </Text>
            ) : null}
          </View>
        ) : null}
        <MessageComposer />
      </Channel>
    </>
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
  botBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  botButton: {
    flexGrow: 1,
    flexBasis: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  botButtonDisabled: {
    opacity: 0.5,
  },
  botButtonLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
  banterError: {
    width: '100%',
    fontSize: 12,
    color: '#b00020',
  },
});
