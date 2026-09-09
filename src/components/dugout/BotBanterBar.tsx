import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MatchTeam } from '@/lib/matches';
import { colors, radius, semantic, spacing, typography } from '@/theme/tokens';

type Props = {
  teamA: MatchTeam;
  teamB: MatchTeam;
  pendingTeam: string | null;
  error: string | null;
  onTrigger: (team: MatchTeam) => void;
};

function TeamButton({
  team,
  pending,
  disabled,
  onPress,
}: {
  team: MatchTeam;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && !pending && styles.buttonDisabled]}>
      {pending ? (
        <ActivityIndicator color={semantic.textOnBrand} />
      ) : (
        <Text style={styles.buttonLabel} numberOfLines={1}>
          {team.label} Fan
        </Text>
      )}
    </Pressable>
  );
}

export function BotBanterBar({ teamA, teamB, pendingTeam, error, onTrigger }: Props) {
  return (
    <View style={styles.bar}>
      <TeamButton
        team={teamA}
        pending={pendingTeam === teamA.slug}
        disabled={pendingTeam !== null}
        onPress={() => onTrigger(teamA)}
      />
      <TeamButton
        team={teamB}
        pending={pendingTeam === teamB.slug}
        disabled={pendingTeam !== null}
        onPress={() => onTrigger(teamB)}
      />
      {error ? (
        <Text style={styles.error} numberOfLines={2}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s4,
    paddingHorizontal: spacing.gutterScreen,
    paddingTop: spacing.s4,
  },
  button: {
    flexGrow: 1,
    flexBasis: '40%',
    minHeight: spacing.controlHSm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.s5,
    paddingVertical: spacing.s4,
    backgroundColor: semantic.surfaceBrand,
    borderRadius: radius.control,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    ...typography.button,
    fontSize: 13,
    color: semantic.textOnBrand,
    textTransform: 'uppercase',
  },
  error: {
    width: '100%',
    ...typography.caption,
    color: colors.red700,
  },
});
