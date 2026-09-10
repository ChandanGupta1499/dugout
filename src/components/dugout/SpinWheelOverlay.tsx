import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import type { SpinPrize } from '@/lib/spin-mock';
import { colors, radius, semantic, spacing, typography } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  visible: boolean;
  prizes: SpinPrize[]; // exactly 6
  initialSpinsLeft: number;
  onClose: () => void;
};

type Phase = 'idle' | 'spinning' | 'result';

const WHEEL_SIZE = 280;
const WHEEL_RADIUS = 140;
const SEGMENT_COUNT = 6;
const SEGMENT_DEG = 360 / SEGMENT_COUNT;
const SPIN_DURATION_MS = 3000;
const RESULT_PAUSE_MS = 1200;
const COUNTDOWN_START_SEC = 10;
const EXTRA_FULL_SPINS = 4;
const POINTER_ANGLE_DEG = 270; // 12 o'clock, in SVG's 0deg-at-3-o'clock/clockwise convention

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeSegmentPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

export function SpinWheelOverlay({ visible, prizes, initialSpinsLeft, onClose }: Props) {
  const [spinsLeft, setSpinsLeft] = useState(initialSpinsLeft);
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdownSec, setCountdownSec] = useState(COUNTDOWN_START_SEC);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);

  const rotation = useSharedValue(0);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const clearResultTimer = useCallback(() => {
    if (resultTimeoutRef.current !== null) {
      clearTimeout(resultTimeoutRef.current);
      resultTimeoutRef.current = null;
    }
  }, []);

  // Reset everything whenever the overlay closes, so reopening always starts
  // fresh. Modal doesn't unmount its subtree on visible=false. A direct
  // (non-withTiming) reassignment here means any in-flight spin's completion
  // callback will subsequently fire with finished=false and be ignored by the
  // guard in startSpin's callback below.
  useEffect(() => {
    if (!visible) {
      clearCountdown();
      clearResultTimer();
      setSpinsLeft(initialSpinsLeft);
      setPhase('idle');
      setCountdownSec(COUNTDOWN_START_SEC);
      setLandedIndex(null);
      rotation.value = 0;
    }
  }, [visible, initialSpinsLeft, clearCountdown, clearResultTimer, rotation]);

  // Clear the result-pause timer on unmount so it can never call setState
  // (including the onClose it may invoke) after the component is gone.
  useEffect(() => clearResultTimer, [clearResultTimer]);

  const handleSpinLanded = useCallback(
    (winningIndex: number) => {
      setPhase('result');
      setLandedIndex(winningIndex);
      setSpinsLeft((current) => {
        const next = current - 1;
        resultTimeoutRef.current = setTimeout(() => {
          resultTimeoutRef.current = null;
          if (next > 0) {
            setPhase('idle');
            setCountdownSec(COUNTDOWN_START_SEC);
            setLandedIndex(null);
          } else {
            onClose();
          }
        }, RESULT_PAUSE_MS);
        return next;
      });
    },
    [onClose],
  );

  const startSpin = useCallback(() => {
    if (phase !== 'idle' || spinsLeft <= 0) return;
    clearCountdown();

    const winningIndex = Math.floor(Math.random() * prizes.length);
    const segmentCenterDeg = winningIndex * SEGMENT_DEG + SEGMENT_DEG / 2;
    const targetMod = (((POINTER_ANGLE_DEG - segmentCenterDeg) % 360) + 360) % 360;
    const target = Math.ceil(rotation.value / 360) * 360 + EXTRA_FULL_SPINS * 360 + targetMod;

    setPhase('spinning');
    // Mutating a Reanimated shared value's `.value` is the library's intended
    // API, not a React state mutation; this lint rule doesn't model that.
    // eslint-disable-next-line react-hooks/immutability
    rotation.value = withTiming(
      target,
      { duration: SPIN_DURATION_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(handleSpinLanded)(winningIndex);
        }
      },
    );
  }, [phase, spinsLeft, prizes.length, rotation, clearCountdown, handleSpinLanded]);

  // startSpin's identity changes whenever the parent's onClose prop does
  // (chat.tsx re-renders roughly once per second from scoreboard polling, so
  // this is frequent in practice, not theoretical). Routing calls through a
  // ref — updated every render but never itself a dependency — means the
  // countdown effect below never needs startSpin in its dependency array, so
  // a churning parent can never tear down and rebuild the 1s interval before
  // it fires.
  const startSpinRef = useRef(startSpin);
  useEffect(() => {
    startSpinRef.current = startSpin;
  }, [startSpin]);

  // Auto-spin countdown: runs while idle with spins remaining; hitting 0 spins
  // the same way a tap on the hub would.
  useEffect(() => {
    if (!visible || phase !== 'idle' || spinsLeft <= 0) {
      return;
    }
    if (countdownSec <= 0) {
      startSpinRef.current();
      return;
    }
    countdownIntervalRef.current = setInterval(() => {
      setCountdownSec((current) => Math.max(0, current - 1));
    }, 1000);
    return clearCountdown;
  }, [visible, phase, spinsLeft, countdownSec, clearCountdown]);

  const wheelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const segments = useMemo(
    () =>
      prizes.slice(0, SEGMENT_COUNT).map((prize, index) => {
        const startDeg = index * SEGMENT_DEG;
        const endDeg = startDeg + SEGMENT_DEG;
        const midDeg = startDeg + SEGMENT_DEG / 2;
        const iconPos = polarToCartesian(
          WHEEL_SIZE / 2,
          WHEEL_SIZE / 2,
          WHEEL_RADIUS * 0.65,
          midDeg,
        );
        return { prize, index, startDeg, endDeg, iconPos };
      }),
    [prizes],
  );

  const canInteract = phase === 'idle' && spinsLeft > 0;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (phase === 'idle') onClose();
          }}
        />
        <Animated.View
          entering={ZoomIn.duration(240)}
          exiting={ZoomOut.duration(160)}
          style={styles.content}>
          <View style={styles.wheelWrap}>
            <Animated.View style={[styles.wheelSpinner, wheelAnimatedStyle]}>
              <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
                <Circle
                  cx={WHEEL_SIZE / 2}
                  cy={WHEEL_SIZE / 2}
                  r={WHEEL_RADIUS}
                  fill="none"
                  stroke={colors.amber600}
                  strokeWidth={6}
                />
                {segments.map(({ index, startDeg, endDeg }) => (
                  <Path
                    key={index}
                    d={describeSegmentPath(
                      WHEEL_SIZE / 2,
                      WHEEL_SIZE / 2,
                      WHEEL_RADIUS - 3,
                      startDeg,
                      endDeg,
                    )}
                    fill={index % 2 === 0 ? semantic.surfaceBrand : semantic.surfaceTint}
                  />
                ))}
              </Svg>
              {segments.map(({ prize, index, iconPos }) => {
                const isWinning = phase === 'result' && landedIndex === index;
                return (
                  <View
                    key={prize.id}
                    style={[
                      styles.prizeBadge,
                      {
                        left: iconPos.x - 18,
                        top: iconPos.y - 18,
                      },
                      isWinning && styles.prizeBadgeWinning,
                    ]}>
                    <Icon name={prize.icon} size={18} color={semantic.textBrand} />
                  </View>
                );
              })}
            </Animated.View>
            <View style={styles.pointer} />
            <Pressable
              disabled={!canInteract}
              onPress={startSpin}
              style={[styles.hub, !canInteract && styles.hubDisabled]}>
              <Text style={styles.hubTapTo}>TAP TO</Text>
              <Text style={styles.hubSpin}>SPIN{'\n'}& WIN</Text>
            </Pressable>
          </View>

          {phase === 'idle' && spinsLeft > 0 ? (
            <Text style={styles.autoSpinCaption}>Auto spin in {countdownSec} secs</Text>
          ) : null}

          {spinsLeft > 0 ? (
            <View style={styles.spinsPill}>
              <Text style={styles.spinsPillLabel}>x{spinsLeft} spins left</Text>
            </View>
          ) : null}

          <Text style={styles.termsLink}>Terms and Conditions</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 16, 19, 0.4)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s5,
  },
  wheelWrap: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelSpinner: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
  },
  prizeBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prizeBadgeWinning: {
    backgroundColor: semantic.surfaceSuccess,
  },
  pointer: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.amber600,
  },
  hub: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceCard,
    borderWidth: 2,
    borderColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubDisabled: {
    opacity: 0.5,
  },
  hubTapTo: {
    ...typography.caption,
    color: semantic.textBrand,
  },
  hubSpin: {
    ...typography.title,
    color: semantic.textBrand,
    textAlign: 'center',
    lineHeight: 16,
  },
  autoSpinCaption: {
    ...typography.bodySm,
    color: semantic.textDisplay,
  },
  spinsPill: {
    paddingHorizontal: spacing.s6,
    paddingVertical: spacing.s3,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceCard,
    borderWidth: 1,
    borderColor: semantic.lineHairline,
  },
  spinsPillLabel: {
    ...typography.label,
    color: semantic.textDisplay,
    textTransform: 'none',
  },
  termsLink: {
    ...typography.caption,
    color: semantic.textBrand,
    textDecorationLine: 'underline',
  },
});
