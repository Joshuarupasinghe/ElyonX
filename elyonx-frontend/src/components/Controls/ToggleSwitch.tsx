import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography } from '../../theme/theme';

interface ToggleSwitchProps {
  value: boolean;
  onToggle: (value: boolean) => void;
  label?: string;
  showStatus?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onToggle,
  label,
  showStatus = true,
}) => {
  const trackWidth = 44;
  const trackHeight = 24;
  const thumbSize = 18;
  const thumbTravel = trackWidth - thumbSize - 4;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        onPress={() => onToggle(!value)}
        activeOpacity={0.8}
        style={[
          styles.track,
          {
            width: trackWidth,
            height: trackHeight,
            backgroundColor: value ? colors.green : colors.surfaceElevated,
            borderColor: value ? colors.green : colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              transform: [{ translateX: value ? thumbTravel : 0 }],
            },
          ]}
        />
      </TouchableOpacity>
      {showStatus && (
        <Text style={[styles.status, { color: value ? colors.green : colors.textMuted }]}>
          {value ? 'ON' : 'OFF'}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  track: {
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  thumb: {
    borderRadius: 9,
    backgroundColor: colors.textPrimary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  status: {
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },
});
