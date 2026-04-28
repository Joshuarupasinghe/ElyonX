import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconButton } from '../common/IconButton';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface TopBarProps {
  mixerConnected: boolean;
  mixerName?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  mixerConnected,
  mixerName = 'MIXER',
}) => {
  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <View style={styles.logoCircle} />
        </View>
        <View>
          <Text style={styles.logoText}>ELYON</Text>
          <Text style={styles.logoSubtext}>AUDIO SYSTEMS</Text>
        </View>
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Right controls */}
      <View style={styles.rightControls}>
        {/* Connection status */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: mixerConnected ? colors.green : colors.red },
            ]}
          />
          <Text style={styles.statusText}>
            {mixerConnected ? `${mixerName} CONNECTED` : 'DISCONNECTED'}
          </Text>
        </View>

        {/* Settings */}
        <IconButton
          icon="settings"
          size={20}
          color={colors.textSecondary}
          onPress={() => {}}
        />

        {/* Profile avatar */}
        <View style={styles.avatar} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    height: 56,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.purple,
  },
  logoText: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    letterSpacing: 3,
  },
  logoSubtext: {
    color: colors.textDim,
    fontSize: 6,
    fontWeight: typography.regular,
    letterSpacing: 2,
  },
  spacer: {
    flex: 1,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.round,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.purpleLight,
    opacity: 0.8,
  },
});
