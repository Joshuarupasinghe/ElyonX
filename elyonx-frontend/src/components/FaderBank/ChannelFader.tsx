import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VerticalFader } from '../Controls/VerticalFader';
import { Channel } from '../../store/types';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface ChannelFaderProps {
  channel: Channel;
  isSelected: boolean;
  onFaderChange: (db: number) => void;
  onToggleMute: () => void;
  onToggleSolo: () => void;
  onSelect: () => void;
}

const ChannelFaderComponent: React.FC<ChannelFaderProps> = ({
  channel,
  isSelected,
  onFaderChange,
  onToggleMute,
  onToggleSolo,
  onSelect,
}) => {
  const displayNames: Record<string, string> = {
    'Lead Vocal': 'L VOCAL',
    'Backing Vocal': 'B VOCAL',
    'Electric Guitar': 'E GUITAR',
  };
  const faderLabel = displayNames[channel.name] || channel.name.toUpperCase();

  return (
    <View
      style={[
        styles.container,
        isSelected && styles.containerSelected,
      ]}
    >
      <View style={styles.panIndicatorContainer}>
        <View style={styles.panIndicator}>
          <View style={styles.panLine} />
        </View>
      </View>

      <View style={styles.msRow}>
        <TouchableOpacity
          style={[
            styles.msButton,
            channel.muted && styles.muteActive,
          ]}
          onPress={onToggleMute}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.msText,
              channel.muted && styles.muteActiveText,
            ]}
          >
            M
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.msButton,
            channel.solo && styles.soloActive,
          ]}
          onPress={onToggleSolo}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.msText,
              channel.solo && styles.soloActiveText,
            ]}
          >
            S
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.faderContainer}>
        <VerticalFader
          value={channel.faderValue}
          min={-60}
          max={6}
          width={6}
          showValue={false}
          fillContainer
          color={isSelected ? colors.purple : undefined}
          onValueChange={onFaderChange}
        />
      </View>

      <View
        style={[
          styles.labelContainer,
          isSelected && styles.labelSelected,
        ]}
      >
        <TouchableOpacity onPress={onSelect} activeOpacity={0.9}>
          <Text
            style={[
              styles.label,
              isSelected && styles.labelTextSelected,
            ]}
            numberOfLines={1}
          >
            {faderLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const ChannelFader = React.memo(ChannelFaderComponent);

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  containerSelected: {
    borderColor: colors.purple,
    backgroundColor: colors.purpleBg,
  },
  panIndicatorContainer: {
    marginBottom: 2,
  },
  panIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panLine: {
    width: 1,
    height: 8,
    backgroundColor: colors.textMuted,
  },
  msRow: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: 3,
  },
  msButton: {
    width: 20,
    height: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muteActive: {
    backgroundColor: colors.redDim,
    borderColor: colors.red,
  },
  soloActive: {
    backgroundColor: colors.purpleBg,
    borderColor: colors.purple,
  },
  msText: {
    color: colors.textMuted,
    fontSize: 7,
    fontWeight: typography.bold,
  },
  muteActiveText: {
    color: colors.red,
  },
  soloActiveText: {
    color: colors.purple,
  },
  faderContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
  },
  labelContainer: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
    marginTop: 2,
    backgroundColor: colors.surfaceElevated,
  },
  labelSelected: {
    backgroundColor: colors.purple,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 7,
    fontWeight: typography.semiBold,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  labelTextSelected: {
    color: colors.textPrimary,
  },
});
