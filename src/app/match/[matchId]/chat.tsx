import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatContext } from 'stream-chat-expo';
import type { Channel as StreamChannel, LocalMessage } from 'stream-chat';

import { BotBanterBar } from '@/components/dugout/BotBanterBar';
import { ChatBubble, type ChatBubbleKind } from '@/components/dugout/ChatBubble';
import { ChatHeader } from '@/components/dugout/ChatHeader';
import { Composer } from '@/components/dugout/Composer';
import { ScoreStrip } from '@/components/dugout/ScoreStrip';
import {
  ensureMatchChannel,
  fetchMatch,
  fetchScoreboard,
  requestBotBanter,
  type MatchScoreboard,
} from '@/lib/api';
import type { Match, MatchTeam } from '@/lib/matches';
import { semantic, spacing } from '@/theme/tokens';
import { useGuest } from '@/providers/chat-provider';

function classifyMessage(message: LocalMessage, guestId: string): ChatBubbleKind {
  const userId = message.user?.id ?? '';
  if (userId === guestId) return 'own';
  if (userId.startsWith('bot-')) return 'bot';
  return 'member';
}

export default function MatchChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const guest = useGuest();
  const { client } = useChatContext();

  const [match, setMatch] = useState<Match | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState('');
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
    setMessages([]);

    try {
      const nextMatch = await fetchMatch(matchId);
      setMatch(nextMatch);

      if (!nextMatch.channelId) {
        setError('Chat isn’t set up for this match yet.');
        return;
      }

      const { channelType, channelId } = await ensureMatchChannel(
        matchId,
        guest.userId,
      );
      const nextChannel = client.channel(channelType, channelId);
      await nextChannel.watch();
      setChannel(nextChannel);
      setMessages([...nextChannel.state.messages]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join chat';
      setError(message);
    }
  }, [client, guest.userId, matchId]);

  useEffect(() => {
    void joinChannel();
  }, [joinChannel, retryCount]);

  useEffect(() => {
    if (!channel) return;

    const sync = () => setMessages([...channel.state.messages]);
    const listeners = [
      channel.on('message.new', sync),
      channel.on('message.updated', sync),
      channel.on('message.deleted', sync),
    ];

    return () => {
      listeners.forEach((listener) => listener.unsubscribe());
    };
  }, [channel]);

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

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !channel) return;

    setDraft('');
    try {
      await channel.sendMessage({ text });
    } catch (err) {
      console.warn('Send message failed', err);
      setDraft(text);
    }
  }, [channel, draft]);

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  if (error) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
          <Text style={styles.message}>Could not open match chat.</Text>
          <Text style={styles.detail}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => setRetryCount((count) => count + 1)}>
            <Text style={styles.retryButtonLabel}>Retry</Text>
          </Pressable>
        </SafeAreaView>
      </>
    );
  }

  if (!channel) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={styles.centered} edges={['top', 'bottom']}>
          <ActivityIndicator color={semantic.textBrand} />
          <Text style={styles.message}>Joining match chat…</Text>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ChatHeader
            title={match?.title ?? 'Chat'}
            meta={scoreboard ? scoreboard.clockLabel : undefined}
            onBack={() => router.back()}
          />
          {scoreboard ? (
            <View style={styles.scoreStripWrap}>
              <ScoreStrip scoreboard={scoreboard} />
            </View>
          ) : null}
          <FlatList
            inverted
            data={orderedMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.feed}
            renderItem={({ item }) => (
              <ChatBubble
                kind={classifyMessage(item, guest.userId)}
                author={
                  classifyMessage(item, guest.userId) === 'own'
                    ? undefined
                    : item.user?.name ?? item.user?.id
                }>
                {item.text ?? ''}
              </ChatBubble>
            )}
          />
          {hasBotTeams && match?.teamA && match?.teamB ? (
            <BotBanterBar
              teamA={match.teamA}
              teamB={match.teamB}
              pendingTeam={pendingTeam}
              error={banterError}
              onTrigger={(team) => void triggerBanter(team)}
            />
          ) : null}
          <View style={styles.composerWrap}>
            <Composer value={draft} onChangeText={setDraft} onSend={() => void sendMessage()} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: semantic.surfacePage,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: semantic.surfacePage,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    color: semantic.textDisplay,
  },
  detail: {
    fontSize: 13,
    color: semantic.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: semantic.surfaceBrand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonLabel: {
    color: semantic.textOnBrand,
    fontWeight: '600',
  },
  scoreStripWrap: {
    paddingHorizontal: spacing.gutterScreen,
    paddingTop: spacing.s5,
  },
  feed: {
    flexGrow: 1,
    gap: spacing.gapSection,
    paddingHorizontal: spacing.gutterScreen,
    paddingVertical: spacing.s5,
  },
  composerWrap: {
    paddingHorizontal: spacing.gutterScreen,
    paddingVertical: spacing.s5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.lineHairline,
  },
});
