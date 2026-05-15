import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VerticalFader } from '../Controls/VerticalFader';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface MasterFaderProps {
  value: number;
  onValueChange: (db: number) => void;
}

export const MasterFader: React.FC<MasterFaderProps> = ({
  value,
  onValueChange,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.panIndicator}>
        <View style={styles.panLine} />
      </View>

      <View style={styles.faderContainer}>
        <VerticalFader
          value={value}
          min={-60}
          max={6}
          width={8}
          showValue={true}
          fillContainer
          color={colors.purple}
          onValueChange={onValueChange}
        />
      </View>

      <View style={styles.labelContainer}>
        <Text style={styles.label}>MASTER</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 90,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.purple,
    marginLeft: spacing.md,
  },
  panIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  panLine: {
    width: 1,
    height: 8,
    backgroundColor: colors.textMuted,
  },
  faderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.xxs,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  label: {
    color: colors.purple,
    fontSize: 7,
    fontWeight: typography.bold,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
