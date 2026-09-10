import { memo, useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Portal } from '@gorhom/portal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
  ZoomIn,
  ZoomOut,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import {
  REACTION_EMOJI,
  REACTION_TYPES,
  type ReactionType,
} from '@/lib/reactions';
import { semantic, spacing, radius, typography } from '@/theme/tokens';
import { Badge } from './Badge';

const PICKER_GAP = spacing.s2;
const PICKER_ESTIMATED_HEIGHT = 48;
const SCREEN_EDGE_PADDING = spacing.s4;

type AnchorRect = { x: number; y: number; width: number; height: number };

export type ChatBubbleKind = 'member' | 'bot' | 'system' | 'own';

type Props = {
  kind: ChatBubbleKind;
  author?: string;
  children: string;
  imageUrl?: string;
  reactionCounts?: Record<string, number>;
  ownReactions?: string[];
  showReactionPicker?: boolean;
  onLongPress?: () => void;
  onToggleReaction?: (type: ReactionType) => void;
};

const BUBBLE_BACKGROUND: Record<ChatBubbleKind, string> = {
  member: semantic.surfaceTint,
  bot: semantic.surfaceTintStrong,
  system: semantic.surfaceTint,
  own: semantic.surfaceBrand,
};

const BUBBLE_TEXT_COLOR: Record<ChatBubbleKind, string> = {
  member: semantic.textDisplay,
  bot: semantic.textDisplay,
  system: semantic.textDisplay,
  own: semantic.textOnBrand,
};

export const ChatBubble = memo(function ChatBubble({
  kind,
  author,
  children,
  imageUrl,
  reactionCounts,
  ownReactions = [],
  showReactionPicker = false,
  onLongPress,
  onToggleReaction,
}: Props) {
  const own = kind === 'own';
  const hasText = Boolean(children.trim());
  const ownSet = new Set(ownReactions);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const anchorRef = useRef<View>(null);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);
  const [pickerHeight, setPickerHeight] = useState(PICKER_ESTIMATED_HEIGHT);

  const chips = REACTION_TYPES.filter(
    (type) => (reactionCounts?.[type] ?? 0) > 0,
  );

  const handleLongPress = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchorRect({ x, y, width, height });
    });
    onLongPress?.();
  }, [onLongPress]);

  return (
    <View style={[styles.wrapper, { alignItems: own ? 'flex-end' : 'flex-start' }]}>
      {kind === 'bot' || author ? (
        <View style={styles.authorRow}>
          {kind === 'bot' ? <Badge tone="live">Club bot</Badge> : null}
          {author ? (
            <Text
              style={[
                kind === 'member' ? typography.bodySm : typography.label,
                {
                  textTransform: kind === 'member' ? 'none' : 'uppercase',
                  color: kind === 'system' ? semantic.textBrand : semantic.textMuted,
                },
              ]}>
              {author}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={[styles.messageBlock, { alignSelf: own ? 'flex-end' : 'flex-start' }]}>
        <View ref={anchorRef} style={styles.bubbleAnchor}>
          <Pressable
            onLongPress={handleLongPress}
            delayLongPress={280}
            style={[
              styles.bubble,
              {
                backgroundColor: imageUrl && !hasText
                  ? 'transparent'
                  : BUBBLE_BACKGROUND[kind],
                paddingVertical: imageUrl && !hasText ? 0 : spacing.s5,
                paddingHorizontal: imageUrl && !hasText ? 0 : spacing.s6,
              },
            ]}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.media}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
                recyclingKey={imageUrl}
              />
            ) : null}
            {hasText ? (
              <Text
                style={[
                  typography.body,
                  {
                    color: BUBBLE_TEXT_COLOR[kind],
                    textAlign: kind === 'bot' ? 'center' : 'left',
                    marginTop: imageUrl ? spacing.s4 : 0,
                  },
                ]}>
                {children}
              </Text>
            ) : null}
          </Pressable>
        </View>

        {chips.length > 0 ? (
          <Animated.View
            layout={Layout.duration(200)}
            style={[
              styles.chipRow,
              { alignSelf: own ? 'flex-end' : 'flex-start' },
            ]}>
            {chips.map((type) => {
              const count = reactionCounts?.[type] ?? 0;
              const active = ownSet.has(type);
              return (
                <Animated.View
                  key={type}
                  layout={Layout.duration(200)}
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(150)}>
                  <Pressable
                    onPress={() => onToggleReaction?.(type)}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text style={styles.chipLabel}>
                      {REACTION_EMOJI[type]} {count}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}
      </View>

      {showReactionPicker && onToggleReaction && anchorRect ? (
        <Portal>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleLongPress}
          />
          <Animated.View
            entering={ZoomIn.duration(180)}
            exiting={ZoomOut.duration(120)}
            onLayout={(event) => setPickerHeight(event.nativeEvent.layout.height)}
            style={[
              styles.picker,
              styles.pickerPortal,
              {
                top: Math.max(
                  insets.top + SCREEN_EDGE_PADDING,
                  anchorRect.y - pickerHeight - PICKER_GAP,
                ),
                ...(own
                  ? {
                      right: Math.max(
                        SCREEN_EDGE_PADDING,
                        screenWidth - (anchorRect.x + anchorRect.width),
                      ),
                    }
                  : { left: Math.max(SCREEN_EDGE_PADDING, anchorRect.x) }),
              },
            ]}>
            {REACTION_TYPES.map((type) => (
              <ReactionPickerItem
                key={type}
                type={type}
                active={ownSet.has(type)}
                onPress={() => onToggleReaction(type)}
              />
            ))}
          </Animated.View>
        </Portal>
      ) : null}
    </View>
  );
});

function ReactionPickerItem({
  type,
  active,
  onPress,
}: {
  type: ReactionType;
  active: boolean;
  onPress: () => void;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(active ? 1.15 : 1, { damping: 12, stiffness: 220 }) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={[styles.pickerItem, active && styles.pickerItemActive]}>
      <Animated.Text style={[styles.pickerEmoji, animatedStyle]}>
        {REACTION_EMOJI[type]}
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.s3,
    width: '100%',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s4,
  },
  messageBlock: {
    position: 'relative',
    maxWidth: '86%',
    gap: spacing.s2,
  },
  bubbleAnchor: {
    position: 'relative',
  },
  bubble: {
    paddingVertical: spacing.s5,
    paddingHorizontal: spacing.s6,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  media: {
    width: 220,
    height: 160,
    borderRadius: radius.card,
    backgroundColor: semantic.surfaceTint,
  },
  picker: {
    flexDirection: 'row',
    gap: spacing.s2,
    backgroundColor: semantic.surfaceCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: semantic.lineHairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  pickerPortal: {
    position: 'absolute',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pickerItem: {
    padding: spacing.s2,
    borderRadius: radius.pill,
  },
  pickerItemActive: {
    backgroundColor: semantic.surfaceTintStrong,
  },
  pickerEmoji: {
    fontSize: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
  chip: {
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s2,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: semantic.lineHairline,
  },
  chipActive: {
    borderColor: semantic.lineBrand,
    backgroundColor: semantic.surfaceTintStrong,
  },
  chipLabel: {
    fontSize: 12,
    color: semantic.textBody,
  },
});
