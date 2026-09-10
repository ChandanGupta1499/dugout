import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChatContext } from 'stream-chat-expo';
import type { Channel as StreamChannel, LocalMessage } from 'stream-chat';

import { BotBanterBar } from '@/components/dugout/BotBanterBar';
import { ChatBubble, type ChatBubbleKind } from '@/components/dugout/ChatBubble';
import { ChatHeader } from '@/components/dugout/ChatHeader';
import { Composer } from '@/components/dugout/Composer';
import { MediaSheet } from '@/components/dugout/MediaSheet';
import { QuizSheet } from '@/components/dugout/QuizSheet';
import { ScoreStrip } from '@/components/dugout/ScoreStrip';
import { SpinWheelOverlay } from '@/components/dugout/SpinWheelOverlay';
import {
  ensureMatchChannel,
  fetchMatch,
  fetchScoreboard,
  requestBotBanter,
  type GiphyItem,
  type GiphyKind,
  type MatchScoreboard,
} from '@/lib/api';
import { fetchActiveGame, type ActiveGame } from '@/lib/games';
import type { Match, MatchTeam } from '@/lib/matches';
import { MOCK_QUIZ_QUESTION } from '@/lib/quiz-mock';
import { isReactionType, type ReactionType } from '@/lib/reactions';
import { INITIAL_SPINS_LEFT, MOCK_SPIN_PRIZES } from '@/lib/spin-mock';
import { semantic, spacing } from '@/theme/tokens';
import { useGuest } from '@/providers/chat-provider';

function classifyMessage(message: LocalMessage, guestId: string): ChatBubbleKind {
  const userId = message.user?.id ?? '';
  if (userId === guestId) return 'own';
  if (userId.startsWith('bot-')) return 'bot';
  return 'member';
}

function messageImageUrl(message: LocalMessage): string | undefined {
  const attachment = message.attachments?.[0];
  if (!attachment) return undefined;
  const record = attachment as Record<string, unknown>;
  const candidates = [
    attachment.image_url,
    attachment.thumb_url,
    attachment.asset_url,
    typeof record.imageUrl === 'string' ? record.imageUrl : undefined,
    typeof record.gif_url === 'string' ? record.gif_url : undefined,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function ownReactionTypes(message: LocalMessage): string[] {
  const own = message.own_reactions ?? [];
  return own
    .map((reaction) => reaction.type)
    .filter((type): type is string => typeof type === 'string');
}

type ChatMessageRowProps = {
  item: LocalMessage;
  guestId: string;
  showReactionPicker: boolean;
  onToggleReaction: (messageId: string, type: ReactionType) => void;
  onLongPress: (messageId: string) => void;
};

const ChatMessageRow = memo(function ChatMessageRow({
  item,
  guestId,
  showReactionPicker,
  onToggleReaction,
  onLongPress,
}: ChatMessageRowProps) {
  const kind = classifyMessage(item, guestId);
  const counts = item.reaction_counts ?? {};
  const filteredCounts: Record<string, number> = {};
  for (const [type, count] of Object.entries(counts)) {
    if (isReactionType(type) && typeof count === 'number' && count > 0) {
      filteredCounts[type] = count;
    }
  }

  const handleLongPress = useCallback(() => {
    onLongPress(item.id);
  }, [item.id, onLongPress]);

  const handleToggleReaction = useCallback(
    (type: ReactionType) => {
      onToggleReaction(item.id, type);
    },
    [item.id, onToggleReaction],
  );

  return (
    <ChatBubble
      kind={kind}
      author={kind === 'own' ? undefined : item.user?.name ?? item.user?.id}
      imageUrl={messageImageUrl(item)}
      reactionCounts={filteredCounts}
      ownReactions={ownReactionTypes(item)}
      showReactionPicker={showReactionPicker}
      onLongPress={handleLongPress}
      onToggleReaction={handleToggleReaction}>
      {item.text ?? ''}
    </ChatBubble>
  );
});

export default function MatchChatScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const guest = useGuest();
  const { client } = useChatContext();
  const insets = useSafeAreaInsets();

  const [match, setMatch] = useState<Match | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [pendingTeam, setPendingTeam] = useState<string | null>(null);
  const [banterError, setBanterError] = useState<string | null>(null);
  const [scoreboard, setScoreboard] = useState<MatchScoreboard | null>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [loadingGame, setLoadingGame] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const hasBotTeams = Boolean(match?.teamA && match?.teamB);
  const keyboardOpen = keyboardHeight > 0;

  const syncMessages = useCallback((active: StreamChannel) => {
    setMessages([...active.state.messages]);
  }, []);

  const closeMediaSheet = useCallback(() => {
    setMediaOpen(false);
  }, []);

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
      syncMessages(nextChannel);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join chat';
      setError(message);
    }
  }, [client, guest.userId, matchId, syncMessages]);

  useEffect(() => {
    void joinChannel();
  }, [joinChannel, retryCount]);

  useEffect(() => {
    if (!channel) return;

    const sync = () => syncMessages(channel);
    const listeners = [
      channel.on('message.new', sync),
      channel.on('message.updated', sync),
      channel.on('message.deleted', sync),
      channel.on('reaction.new', sync),
      channel.on('reaction.deleted', sync),
    ];

    return () => {
      listeners.forEach((listener) => listener.unsubscribe());
    };
  }, [channel, syncMessages]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
    setMediaOpen(false);
    try {
      await channel.sendMessage({ text });
      syncMessages(channel);
    } catch (err) {
      console.warn('Send message failed', err);
      setDraft(text);
    }
  }, [channel, draft, syncMessages]);

  const toggleReaction = useCallback(
    async (messageId: string, type: ReactionType) => {
      if (!channel) return;

      const message = channel.state.messages.find((item) => item.id === messageId);
      const already =
        message?.own_reactions?.some((reaction) => reaction.type === type) ??
        false;

      try {
        if (already) {
          await channel.deleteReaction(messageId, type);
        } else {
          await channel.sendReaction(messageId, { type });
        }
        syncMessages(channel);
        setReactionTargetId(null);
      } catch (err) {
        console.warn('Toggle reaction failed', err);
      }
    },
    [channel, syncMessages],
  );

  const handleLongPressMessage = useCallback((messageId: string) => {
    setReactionTargetId((current) => (current === messageId ? null : messageId));
  }, []);

  const sendMedia = useCallback(
    async (item: GiphyItem, kind: GiphyKind) => {
      if (!channel) return;

      const imageUrl = item.url?.trim() || item.previewUrl?.trim();
      if (!imageUrl) {
        console.warn('Send media failed: missing image url');
        return;
      }

      try {
        await channel.sendMessage({
          // Stream drops completely empty messages more readily; a space keeps
          // the attachment message valid while staying visually blank.
          text: ' ',
          attachments: [
            {
              type: 'image',
              image_url: imageUrl,
              thumb_url: item.previewUrl?.trim() || imageUrl,
              asset_url: imageUrl,
              title: item.title?.trim() || (kind === 'sticker' ? 'Sticker' : 'GIF'),
            },
          ],
        });
        syncMessages(channel);
        setMediaOpen(false);
      } catch (err) {
        console.warn('Send media failed', err);
      }
    },
    [channel, syncMessages],
  );

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages]);

  const composerBottomPad = keyboardOpen
    ? spacing.s5
    : spacing.s5 + insets.bottom;

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
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
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
            style={styles.flex}
            inverted
            data={orderedMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.feed}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScrollBeginDrag={() => {
              setReactionTargetId(null);
            }}
            renderItem={({ item }) => (
              <ChatMessageRow
                item={item}
                guestId={guest.userId}
                showReactionPicker={reactionTargetId === item.id}
                onToggleReaction={toggleReaction}
                onLongPress={handleLongPressMessage}
              />
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
          <View style={[styles.composerWrap, { paddingBottom: composerBottomPad }]}>
            <Composer
              value={draft}
              onChangeText={setDraft}
              onSend={() => void sendMessage()}
              mediaOpen={mediaOpen}
              onOpenMedia={() => {
                setReactionTargetId(null);
                if (mediaOpen) {
                  closeMediaSheet();
                  return;
                }
                Keyboard.dismiss();
                setMediaOpen(true);
              }}
              onOpenGame={() => {
                setReactionTargetId(null);
                Keyboard.dismiss();
                if (!matchId || loadingGame) return;
                setLoadingGame(true);
                void fetchActiveGame(matchId)
                  .then(setActiveGame)
                  .catch((err) => {
                    console.warn('Fetch active game failed', err);
                  })
                  .finally(() => setLoadingGame(false));
              }}
              gameBadge
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <MediaSheet
        visible={mediaOpen}
        onClose={closeMediaSheet}
        onPickMedia={(item, kind) => void sendMedia(item, kind)}
      />
      <QuizSheet
        visible={activeGame?.type === 'quiz'}
        question={activeGame?.type === 'quiz' ? activeGame.question : MOCK_QUIZ_QUESTION}
        liveLabel={scoreboard ? `LIVE · ${scoreboard.clockLabel}` : undefined}
        onClose={() => setActiveGame(null)}
      />
      <SpinWheelOverlay
        visible={activeGame?.type === 'spin'}
        prizes={activeGame?.type === 'spin' ? activeGame.prizes : MOCK_SPIN_PRIZES}
        initialSpinsLeft={activeGame?.type === 'spin' ? activeGame.spinsLeft : INITIAL_SPINS_LEFT}
        onClose={() => setActiveGame(null)}
      />
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
    paddingTop: spacing.s5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: semantic.lineHairline,
    backgroundColor: semantic.surfacePage,
  },
});
