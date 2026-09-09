import { StyleSheet, Text, View } from 'react-native';

import type { MatchScoreboard } from '@/lib/api';

type Props = {
  scoreboard: MatchScoreboard;
};

export function MatchScoreboardBar({ scoreboard }: Props) {
  const live =
    scoreboard.state === 'running' ||
    scoreboard.state === 'paused' ||
    scoreboard.state === 'finished';

  return (
    <View style={styles.bar}>
      <Text style={styles.team} numberOfLines={1}>
        {scoreboard.teamA.label}
      </Text>
      <View style={styles.center}>
        <Text style={styles.score}>
          {scoreboard.teamA.score} – {scoreboard.teamB.score}
        </Text>
        <Text style={[styles.clock, live && styles.clockLive]}>
          {scoreboard.clockLabel}
        </Text>
      </View>
      <Text style={[styles.team, styles.teamRight]} numberOfLines={1}>
        {scoreboard.teamB.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    backgroundColor: '#111',
  },
  team: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  teamRight: {
    textAlign: 'right',
  },
  center: {
    alignItems: 'center',
    minWidth: 72,
  },
  score: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  clock: {
    marginTop: 2,
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  clockLive: {
    color: '#7CFFB2',
  },
});
