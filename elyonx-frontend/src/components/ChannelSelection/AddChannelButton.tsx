import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { colors, typography, radii, spacing } from '../../theme/theme';

interface AddChannelButtonProps {
  onPress: () => void;
}

export const AddChannelButton: React.FC<AddChannelButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>⊕</Text>
      <Text style={styles.text}>ADD A NEW CHANNEL</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  icon: {
    color: colors.textSecondary,
    fontSize: typography.xl,
    marginRight: spacing.sm,
  },
  text: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
