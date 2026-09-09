import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, semantic, typography } from '@/theme/tokens';

type Tone = 'live' | 'brand' | 'neutral';

const TONES: Record<Tone, { background: string; color: string }> = {
  live: { background: semantic.statusLive, color: colors.white },
  brand: { background: semantic.surfaceTintStrong, color: semantic.textBrand },
  neutral: { background: colors.grey100, color: colors.grey800 },
};

type Props = {
  children: string;
  tone?: Tone;
};

export function Badge({ children, tone = 'brand' }: Props) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.color }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.label,
    textTransform: 'uppercase',
  },
});
