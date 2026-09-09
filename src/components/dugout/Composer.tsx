import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radius, semantic, spacing } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onOpenMedia?: () => void;
  mediaOpen?: boolean;
  onOpenQuiz?: () => void;
  quizBadge?: boolean;
  editable?: boolean;
};

export function Composer({
  value,
  onChangeText,
  onSend,
  onOpenMedia,
  mediaOpen = false,
  onOpenQuiz,
  quizBadge = false,
  editable = true,
}: Props) {
  return (
    <View style={styles.row}>
      {onOpenQuiz ? (
        <Pressable
          onPress={onOpenQuiz}
          disabled={!editable}
          style={[styles.quizButton, !editable && styles.disabled]}>
          <Icon name="gamepad" size={20} color={semantic.textOnBrand} />
          {quizBadge ? <View style={styles.quizBadge} /> : null}
        </Pressable>
      ) : null}
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="Roast, react, or poll…"
          placeholderTextColor={semantic.textPlaceholder}
          style={styles.input}
          editable={editable}
          onSubmitEditing={onSend}
          returnKeyType="send"
          multiline={false}
        />
        {onOpenMedia ? (
          <Pressable
            onPress={onOpenMedia}
            disabled={!editable}
            hitSlop={8}
            style={[styles.plusInside, !editable && styles.disabled]}>
            <Icon
              name="plus"
              size={20}
              color={mediaOpen ? semantic.textBrand : semantic.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onSend}
        disabled={!editable || !value.trim()}
        style={[styles.sendButton, (!editable || !value.trim()) && styles.sendButtonDisabled]}>
        <Icon name="send" size={20} color={semantic.textOnBrand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s5,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: spacing.controlH,
    paddingLeft: spacing.s6,
    paddingRight: spacing.s3,
    backgroundColor: semantic.surfaceTint,
    borderWidth: 1,
    borderColor: semantic.lineBrand,
    borderRadius: radius.pill,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: fonts.body,
    fontSize: 15,
    color: semantic.textBody,
  },
  plusInside: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    width: spacing.controlH,
    height: spacing.controlH,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  quizButton: {
    width: spacing.controlH,
    height: spacing.controlH,
    borderRadius: radius.pill,
    backgroundColor: semantic.surfaceBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.amber600,
    borderWidth: 1.5,
    borderColor: semantic.surfaceBrand,
  },
  disabled: {
    opacity: 0.5,
  },
});
