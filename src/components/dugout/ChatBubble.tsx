import { StyleSheet, Text, View } from 'react-native';

import { semantic, spacing, radius, typography } from '@/theme/tokens';
import { Badge } from './Badge';

export type ChatBubbleKind = 'member' | 'bot' | 'system' | 'own';

type Props = {
  kind: ChatBubbleKind;
  author?: string;
  children: string;
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

export function ChatBubble({ kind, author, children }: Props) {
  const own = kind === 'own';

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
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: BUBBLE_BACKGROUND[kind],
            alignSelf: own ? 'flex-end' : 'flex-start',
          },
        ]}>
        <Text
          style={[
            typography.body,
            { color: BUBBLE_TEXT_COLOR[kind], textAlign: kind === 'bot' ? 'center' : 'left' },
          ]}>
          {children}
        </Text>
      </View>
    </View>
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
  bubble: {
    maxWidth: '86%',
    paddingVertical: spacing.s5,
    paddingHorizontal: spacing.s6,
    borderRadius: radius.card,
  },
});
