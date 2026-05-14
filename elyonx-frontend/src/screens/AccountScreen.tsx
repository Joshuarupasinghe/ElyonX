import React, { useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AuthUser } from '../auth';
import { colors, radii, spacing, typography } from '../theme/theme';

interface AccountScreenProps {
  user: AuthUser;
  onBack: () => void;
  onLogout: () => void;
}

interface DetailRowProps {
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} selectable>
      {value}
    </Text>
  </View>
);

function formatProvider(provider: string): string {
  if (provider.toLowerCase() === 'google') return 'Google';
  if (provider.toLowerCase() === 'local') return 'Email and password';
  return provider;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  user,
  onBack,
  onLogout,
}) => {
  const avatarInitial = useMemo(() => {
    const source = user.name?.trim() || user.email?.trim() || '?';
    return source.charAt(0).toUpperCase();
  }, [user.email, user.name]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.75}
        >
          <Text style={styles.backButtonText}>BACK</Text>
        </TouchableOpacity>

        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>ACCOUNT</Text>
          <Text style={styles.headerSubtitle}>ELYONX IMS PROFILE</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={onLogout}
          activeOpacity={0.75}
        >
          <Text style={styles.logoutButtonText}>LOGOUT</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryPanel}>
          <View style={styles.largeAvatar}>
            <Text style={styles.largeAvatarText}>{avatarInitial}</Text>
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.displayName} numberOfLines={1}>
              {user.name || 'ElyonX User'}
            </Text>
            <Text style={styles.displayEmail} numberOfLines={1}>
              {user.email}
            </Text>
            <View style={styles.providerPill}>
              <Text style={styles.providerPillText}>
                {formatProvider(user.auth_provider)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.accentBar} />
            <Text style={styles.sectionTitle}>PROFILE DETAILS</Text>
          </View>

          <DetailRow label="Name" value={user.name || 'Not provided'} />
          <DetailRow label="Email" value={user.email || 'Not provided'} />
          <DetailRow
            label="Authentication"
            value={formatProvider(user.auth_provider)}
          />
          <DetailRow
            label="Status"
            value={user.is_active ? 'Active' : 'Disabled'}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.accentBar} />
            <Text style={styles.sectionTitle}>ACCOUNT IDS</Text>
          </View>

          <DetailRow label="Account ID" value={user.user_id || 'Not provided'} />
          <DetailRow
            label="Google ID"
            value={user.google_id || 'Not linked'}
          />
          <DetailRow
            label="Profile Image"
            value={user.profile_picture || 'Not provided'}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.md,
  },
  backButton: {
    minWidth: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },
  headerTextBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    letterSpacing: 3,
  },
  headerSubtitle: {
    color: colors.textDim,
    fontSize: 8,
    fontWeight: typography.medium,
    letterSpacing: 2,
    marginTop: 2,
  },
  logoutButton: {
    minWidth: 84,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.red,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: colors.red,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  summaryPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  largeAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.purpleBg,
    borderWidth: 1,
    borderColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarText: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: typography.bold,
    letterSpacing: 0,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: typography.bold,
    marginBottom: 6,
  },
  displayEmail: {
    color: colors.textSecondary,
    fontSize: typography.md,
    fontWeight: typography.medium,
    marginBottom: spacing.sm,
  },
  providerPill: {
    alignSelf: 'flex-start',
    borderRadius: radii.round,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  providerPillText: {
    color: colors.purple,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  accentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.purple,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: typography.semiBold,
    letterSpacing: 1.5,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    gap: spacing.md,
  },
  detailLabel: {
    width: 140,
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: typography.medium,
  },
});
