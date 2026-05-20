import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { IconButton } from '../common/IconButton';
import { colors, typography, spacing, radii } from '../../theme/theme';
import type { AuthUser } from '../../auth';

interface TopBarProps {
  mixerConnected: boolean;
  mixerName?: string;
  rtaConnected?: boolean;
  rtaStreamOnline?: boolean;
  onSettingsPress?: () => void;
  settingsActive?: boolean;
  user?: AuthUser | null;
  onViewAccount?: () => void;
  onLogout?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  mixerConnected,
  mixerName = 'MIXER',
  rtaConnected = false,
  rtaStreamOnline = false,
  onSettingsPress,
  settingsActive = false,
  user,
  onViewAccount,
  onLogout,
}) => {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const rtaColor = rtaConnected
    ? rtaStreamOnline
      ? colors.green
      : colors.orange
    : colors.red;
  const rtaLabel = rtaConnected
    ? rtaStreamOnline
      ? 'RTA LIVE'
      : 'RTA IDLE'
    : 'RTA OFFLINE';

  const avatarInitial = useMemo(() => {
    const source = user?.name?.trim() || user?.email?.trim() || '?';
    return source.charAt(0).toUpperCase();
  }, [user?.email, user?.name]);

  const accountLabel = user?.name?.trim() || user?.email || 'Account';

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <View style={styles.logoCircle} />
        </View>
        <View>
          <Text style={styles.logoText}>ELYONX</Text>
          <Text style={styles.logoSubtext}>IMS</Text>
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.rightControls}>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: rtaColor }]} />
          <Text style={styles.statusText}>{rtaLabel}</Text>
        </View>

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

        <IconButton
          icon="settings"
          size={20}
          color={settingsActive ? colors.purple : colors.textSecondary}
          onPress={onSettingsPress}
          style={settingsActive ? styles.settingsButtonActive : undefined}
        />

        <View style={styles.profileRoot}>
          <TouchableOpacity
            style={[
              styles.avatar,
              profileMenuOpen && styles.avatarActive,
            ]}
            onPress={() => setProfileMenuOpen((open) => !open)}
            activeOpacity={0.75}
          >
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </TouchableOpacity>

          {profileMenuOpen && (
            <View style={styles.profileMenu}>
              <View style={styles.profileHeader}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {accountLabel}
                </Text>
                {user?.email ? (
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.profileMenuItem}
                onPress={() => {
                  setProfileMenuOpen(false);
                  onViewAccount?.();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.profileMenuText}>VIEW ACCOUNT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.profileMenuItem, styles.profileMenuItemDanger]}
                onPress={() => {
                  setProfileMenuOpen(false);
                  onLogout?.();
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.profileMenuText, styles.profileMenuTextDanger]}>
                  LOGOUT
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    height: 44,
    zIndex: 50,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatarActive: {
    borderColor: colors.purple,
    backgroundColor: colors.purple,
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: typography.bold,
    letterSpacing: 0,
  },
  profileRoot: {
    position: 'relative',
  },
  profileMenu: {
    position: 'absolute',
    top: 38,
    right: 0,
    width: 220,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    zIndex: 100,
    elevation: 12,
  },
  profileHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: typography.bold,
    marginBottom: 3,
  },
  profileEmail: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.medium,
  },
  profileMenuItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  profileMenuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  profileMenuText: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },
  profileMenuTextDanger: {
    color: colors.red,
  },
  settingsButtonActive: {
    backgroundColor: colors.purpleBg,
    borderWidth: 1,
    borderColor: colors.purple,
  },
});
