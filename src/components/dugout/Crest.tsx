import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '@/theme/tokens';

type Props = {
  code: string;
  color?: string;
  size?: number;
};

export function Crest({ code, color = colors.club.neutral, size = 30 }: Props) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor: color },
      ]}>
      <Text style={[styles.label, { fontSize: Math.round(size * 0.34) }]} numberOfLines={1}>
        {code}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'HankenGrotesk_800ExtraBold',
    color: colors.white,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
