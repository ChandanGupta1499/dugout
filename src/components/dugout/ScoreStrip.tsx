import { StyleSheet, Text, View } from 'react-native';

import type { MatchScoreboard } from '@/lib/api';
import { colors, radius, semantic, spacing, typography } from '@/theme/tokens';
import { Crest } from './Crest';

function shortCode(label: string) {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map((word) => word[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  }
  return label.slice(0, 3).toUpperCase();
}

function Side({
  code,
  score,
  align,
}: {
  code: string;
  score: number;
  align: 'left' | 'right';
}) {
  const items = [
    <Crest key="crest" code={code} color={colors.club.neutral} size={34} />,
    <View key="text" style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text style={styles.code}>{code}</Text>
      <Text style={styles.score}>{score}</Text>
    </View>,
  ];
  return (
    <View style={styles.side}>{align === 'right' ? [...items].reverse() : items}</View>
  );
}

type Props = {
  scoreboard: MatchScoreboard;
};

export function ScoreStrip({ scoreboard }: Props) {
  const live =
    scoreboard.state === 'running' ||
    scoreboard.state === 'paused' ||
    scoreboard.state === 'finished';

  return (
    <View style={styles.strip}>
      {live ? (
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>Live</Text>
        </View>
      ) : null}
      <Side code={shortCode(scoreboard.teamA.label)} score={scoreboard.teamA.score} align="left" />
      <Text style={styles.vs}>vs</Text>
      <Side code={shortCode(scoreboard.teamB.label)} score={scoreboard.teamB.score} align="right" />
      <View style={styles.clockPill}>
        <Text style={styles.clockText} numberOfLines={1}>
          {scoreboard.clockLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s5,
    padding: spacing.s5,
    backgroundColor: semantic.surfaceCard,
    borderWidth: 1,
    borderColor: semantic.lineHairline,
    borderRadius: radius.card,
  },
  liveTag: {
    alignItems: 'center',
    gap: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: semantic.statusLive,
  },
  liveLabel: {
    ...typography.label,
    color: semantic.statusLive,
  },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s4,
  },
  code: {
    ...typography.label,
    color: semantic.textMuted,
  },
  score: {
    ...typography.displayMd,
    fontSize: 22,
    color: semantic.textDisplay,
  },
  vs: {
    flex: 1,
    textAlign: 'center',
    ...typography.caption,
    color: semantic.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  clockPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    backgroundColor: semantic.surfaceTintStrong,
    borderRadius: radius.sm,
    maxWidth: 84,
  },
  clockText: {
    ...typography.rowName,
    fontSize: 12,
    color: semantic.textBrand,
  },
});
