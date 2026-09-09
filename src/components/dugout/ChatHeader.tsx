import { Pressable, StyleSheet, Text, View } from 'react-native';

import { semantic, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  title: string;
  meta?: string;
  onBack: () => void;
};

export function ChatHeader({ title, meta, onBack }: Props) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
        <Icon name="chevron-left" size={22} color={semantic.textDisplay} />
      </Pressable>
      <View style={styles.titleGroup}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s5,
    paddingHorizontal: spacing.gutterScreen,
    paddingVertical: spacing.s4,
    backgroundColor: semantic.surfacePage,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: semantic.lineHairline,
  },
  backButton: {
    width: spacing.s8,
    height: spacing.s8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.displayMd,
    fontSize: 19,
    textTransform: 'uppercase',
    color: semantic.textDisplay,
  },
  meta: {
    ...typography.caption,
    color: semantic.textMuted,
  },
});
