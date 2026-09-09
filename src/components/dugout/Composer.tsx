import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { fonts, radius, semantic, spacing } from '@/theme/tokens';
import { Icon } from './Icon';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  editable?: boolean;
};

export function Composer({ value, onChangeText, onSend, editable = true }: Props) {
  return (
    <View style={styles.row}>
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
  input: {
    flex: 1,
    height: spacing.controlH,
    paddingHorizontal: spacing.s6,
    backgroundColor: semantic.surfaceTint,
    borderWidth: 1,
    borderColor: semantic.lineBrand,
    borderRadius: radius.pill,
    fontFamily: fonts.body,
    fontSize: 15,
    color: semantic.textBody,
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
});
