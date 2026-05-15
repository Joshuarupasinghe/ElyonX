import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme/theme';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: (value: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked, onToggle }) => {
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={styles.container}
      onPress={() => onToggle(!checked)}
      activeOpacity={0.7}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  box: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    backgroundColor: colors.surface,
  },
  boxChecked: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  check: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: typography.bold,
    lineHeight: 12,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.regular,
  },
});
