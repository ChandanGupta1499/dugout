import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fonts, radius, semantic, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';

export type QuizOption = { key: string; label: string };
export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[]; // exactly 4, rendered as a 2x2 grid
  correctKey: string;
  durationSec: number; // countdown length, e.g. 45
};

type Props = {
  visible: boolean;
  question: QuizQuestion;
  liveLabel?: string; // e.g. "LIVE · 63'"; defaults to "LIVE · MIN --"
  onClose: () => void;
};

function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QuizSheet({ visible, question, liveLabel, onClose }: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState(question.durationSec);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Reset all interactive state whenever the sheet is closed, so reopening
  // (even with the same question object) always starts fresh. Modal doesn't
  // unmount its subtree on visible=false, so this reset can't be skipped.
  useEffect(() => {
    if (!visible) {
      clearTimer();
      setSelectedKey(null);
      setRemainingSec(question.durationSec);
    }
  }, [visible, question.durationSec, clearTimer]);

  useEffect(() => {
    if (!visible || selectedKey !== null || remainingSec <= 0) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemainingSec((current) => Math.max(0, current - 1));
    }, 1000);

    return clearTimer;
  }, [visible, selectedKey, remainingSec, clearTimer]);

  const locked = selectedKey !== null || remainingSec === 0;

  const handleSelect = useCallback(
    (key: string) => {
      if (locked) return;
      clearTimer();
      setSelectedKey(key);
    },
    [locked, clearTimer],
  );

  const rows = [question.options.slice(0, 2), question.options.slice(2, 4)];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.liveLabel}>{liveLabel ?? "LIVE · MIN --"}</Text>
              <Text style={styles.title}>Quiz</Text>
            </View>
            <View style={[styles.timerCircle, remainingSec === 0 && styles.timerCircleExpired]}>
              <Text style={styles.timerValue}>{formatClock(remainingSec)}</Text>
              <Text style={styles.timerCaption}>LEFT</Text>
            </View>
          </View>

          <View style={styles.questionCard}>
            <Text style={styles.sectionLabel}>Quiz break · pick one</Text>
            <Text style={styles.prompt}>{question.prompt}</Text>

            <View style={styles.grid}>
              {rows.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.gridRow}>
                  {row.map((option) => {
                    const isCorrect = option.key === question.correctKey;
                    const isWrongPick = locked && selectedKey === option.key && !isCorrect;
                    const isRevealedCorrect = locked && isCorrect;
                    const isDimmed = locked && !isRevealedCorrect && !isWrongPick;

                    return (
                      <Pressable
                        key={option.key}
                        disabled={locked}
                        onPress={() => handleSelect(option.key)}
                        style={[
                          styles.option,
                          isRevealedCorrect && styles.optionCorrect,
                          isWrongPick && styles.optionWrong,
                          isDimmed && styles.optionDimmed,
                        ]}>
                        <Text
                          style={[
                            styles.optionLabel,
                            isRevealedCorrect && styles.optionLabelCorrect,
                            isWrongPick && styles.optionLabelWrong,
                          ]}
                          numberOfLines={1}>
                          {option.label}
                        </Text>
                        {isRevealedCorrect ? (
                          <Icon name="circle-check" size={18} color={semantic.textSuccess} />
                        ) : null}
                        {isWrongPick ? (
                          <Icon name="circle-x" size={18} color={semantic.textBrand} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 16, 19, 0.4)',
  },
  sheet: {
    backgroundColor: semantic.surfacePage,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.s4,
    paddingHorizontal: spacing.gutterScreen,
    paddingBottom: spacing.s8,
    gap: spacing.s6,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: semantic.lineStrong,
    marginBottom: spacing.s4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    gap: spacing.s2,
  },
  liveLabel: {
    ...typography.label,
    color: semantic.textBrand,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.displayMd,
    color: semantic.textDisplay,
  },
  timerCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerCircleExpired: {
    backgroundColor: semantic.lineBrand,
  },
  timerValue: {
    fontFamily: fonts.button,
    fontSize: 14,
    color: semantic.textOnBrand,
  },
  timerCaption: {
    ...typography.caption,
    fontSize: 9,
    color: semantic.textOnBrand,
  },
  questionCard: {
    gap: spacing.s5,
    padding: spacing.s5,
    backgroundColor: semantic.surfaceTint,
    borderWidth: 1,
    borderColor: semantic.lineBrand,
    borderRadius: radius.card,
  },
  sectionLabel: {
    ...typography.label,
    color: semantic.textBrand,
    textTransform: 'uppercase',
  },
  prompt: {
    ...typography.title,
    color: semantic.textDisplay,
    textTransform: 'uppercase',
  },
  grid: {
    gap: spacing.s4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.s4,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.controlH,
    paddingHorizontal: spacing.s5,
    borderRadius: radius.md,
    backgroundColor: semantic.surfaceCard,
    borderWidth: 1,
    borderColor: semantic.lineHairline,
  },
  optionCorrect: {
    backgroundColor: semantic.surfaceSuccess,
    borderColor: semantic.textSuccess,
  },
  optionWrong: {
    backgroundColor: semantic.surfaceTintStrong,
    borderColor: semantic.textBrand,
  },
  optionDimmed: {
    opacity: 0.6,
  },
  optionLabel: {
    ...typography.rowName,
    color: semantic.textDisplay,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  optionLabelCorrect: {
    color: semantic.textSuccess,
  },
  optionLabelWrong: {
    color: semantic.textBrand,
  },
});
