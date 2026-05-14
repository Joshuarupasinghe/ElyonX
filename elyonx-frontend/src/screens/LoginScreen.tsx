import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { colors, typography } from '../theme/theme';
import { Checkbox } from '../components/common/Checkbox';

interface LoginScreenProps {
  onLogin: (email: string, password: string) => void | Promise<void>;
  onNavigateToSignUp: () => void;
  onGoogleSignIn?: () => void;
  errorMessage?: string | null;
  isSubmitting?: boolean;
}

/* ── SVG Icon Components ─────────────────────────────────────── */

const ElyonXLogo: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <View style={[logoStyles.container, { width: size, height: size }]}>
    <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
      <Rect x="4" y="8" width="2" height="8" rx="1" fill={colors.purple} />
      <Rect x="8" y="4" width="2" height="16" rx="1" fill={colors.purple} />
      <Rect x="12" y="6" width="2" height="12" rx="1" fill={colors.purple} />
      <Rect x="16" y="3" width="2" height="18" rx="1" fill={colors.purple} />
      <Rect x="20" y="7" width="2" height="10" rx="1" fill={colors.purple} />
    </Svg>
  </View>
);

const logoStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const MailIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = colors.textMuted,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Path d="M22 6l-10 7L2 6" stroke={color} strokeWidth={1.5} fill="none" />
  </Svg>
);

const LockIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = colors.textMuted,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect
      x="3"
      y="11"
      width="18"
      height="11"
      rx="2"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Path
      d="M7 11V7a5 5 0 0110 0v4"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
  </Svg>
);

const EyeIcon: React.FC<{ size?: number; color?: string; visible?: boolean }> = ({
  size = 18,
  color = colors.textMuted,
  visible = false,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    {visible ? (
      <>
        <Path
          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
        />
        <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.5} fill="none" />
      </>
    ) : (
      <>
        <Path
          d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
          stroke={color}
          strokeWidth={1.5}
          fill="none"
        />
        <Line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth={1.5} />
      </>
    )}
  </Svg>
);

const GoogleIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <Path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <Path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <Path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Svg>
);

/* ── Login Screen ────────────────────────────────────────────── */

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onNavigateToSignUp,
  onGoogleSignIn,
  errorMessage,
  isSubmitting = false,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  const handleLogin = useCallback(() => {
    if (!canSubmit) return;
    onLogin(email.trim(), password);
  }, [canSubmit, email, password, onLogin]);

  return (
    <View style={styles.screenContainer}>
      {/* Subtle ambient glow effects */}
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Logo + Branding */}
          <View style={styles.brandingSection}>
            <ElyonXLogo size={52} />
            <Text style={styles.brandName} accessibilityLabel="ElyonX">ELYONX</Text>
            <Text style={styles.brandSubtitle}>INTELLIGENT MIXING SYSTEM</Text>
          </View>

          {/* Sign In Header */}
          <View style={styles.sectionHeader}>
            <View style={styles.accentBar} />
            <Text style={styles.sectionTitle}>SIGN IN</Text>
          </View>

          {errorMessage ? (
            <Text style={styles.formError}>{errorMessage}</Text>
          ) : null}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
            <View
              style={[
                styles.inputContainer,
                emailFocused && styles.inputContainerFocused,
              ]}
            >
              <MailIcon size={16} color={emailFocused ? colors.purple : colors.textMuted} />
              <TextInput
                accessibilityLabel="Email address"
                style={styles.input}
                placeholder="foh@elyonx.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View
              style={[
                styles.inputContainer,
                passwordFocused && styles.inputContainerFocused,
              ]}
            >
              <LockIcon size={16} color={passwordFocused ? colors.purple : colors.textMuted} />
              <TextInput
                accessibilityLabel="Password"
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Toggle password visibility"
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                activeOpacity={0.6}
              >
                <EyeIcon size={16} color={colors.textMuted} visible={showPassword} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me + Forgot Password */}
          <View style={styles.optionsRow}>
            <Checkbox
              label="Remember Me"
              checked={rememberMe}
              onToggle={setRememberMe}
            />
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.forgotPassword}>FORGOT PASSWORD?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Login"
            style={[styles.loginButton, !canSubmit && styles.buttonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={!canSubmit}
          >
            <View
              style={[
                styles.loginButtonGradient,
                !canSubmit && styles.loginButtonGradientDisabled,
              ]}
            >
              <Text style={styles.loginButtonText}>
                {isSubmitting ? 'LOGGING IN' : 'LOGIN'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign In */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            style={styles.googleButton}
            onPress={onGoogleSignIn}
            activeOpacity={0.85}
          >
            <GoogleIcon size={18} />
            <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
          </TouchableOpacity>

          {/* Create Account Link */}
          <View style={styles.createAccountSection}>
            <Text style={styles.newToText}>NEW TO ELYONX?</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Create account"
              onPress={onNavigateToSignUp}
              activeOpacity={0.7}
            >
              <Text style={styles.createAccountLink}>Create Account →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

/* ── Styles ──────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  glowTopLeft: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
    ...(Platform.OS === 'web'
      ? { filter: 'blur(80px)' }
      : {}),
  } as any,
  glowBottomRight: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(168, 85, 247, 0.04)',
    ...(Platform.OS === 'web'
      ? { filter: 'blur(60px)' }
      : {}),
  } as any,
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#12121A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 36,
    paddingVertical: 40,
  },

  /* Branding */
  brandingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandName: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: typography.bold,
    letterSpacing: 4,
    marginTop: 14,
  },
  brandSubtitle: {
    color: colors.purple,
    fontSize: 10,
    fontWeight: typography.medium,
    letterSpacing: 3,
    marginTop: 6,
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  accentBar: {
    width: 3,
    height: 20,
    backgroundColor: colors.purple,
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: typography.semiBold,
    letterSpacing: 1.5,
  },
  formError: {
    color: colors.red,
    fontSize: 11,
    fontWeight: typography.medium,
    lineHeight: 16,
    marginBottom: 16,
  },

  /* Input Fields */
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: typography.semiBold,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E28',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputContainerFocused: {
    borderColor: 'rgba(168, 85, 247, 0.5)',
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 13,
    ...(Platform.OS === 'web'
      ? { outlineStyle: 'none' }
      : {}),
  } as any,
  eyeButton: {
    padding: 4,
  },

  /* Options Row */
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  forgotPassword: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },

  /* Login Button */
  loginButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  loginButtonGradient: {
    backgroundColor: colors.purple,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    // Simulated gradient via linear gradient on web
    ...(Platform.OS === 'web'
      ? {
          background: 'linear-gradient(135deg, #9B59F7 0%, #C084FC 50%, #A855F7 100%)',
        }
      : {}),
  } as any,
  loginButtonGradientDisabled: {
    backgroundColor: '#3A3A4A',
    ...(Platform.OS === 'web'
      ? { background: '#3A3A4A' }
      : {}),
  } as any,
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  /* Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: typography.medium,
    letterSpacing: 1,
    marginHorizontal: 16,
  },

  /* Google Button */
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E28',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    paddingVertical: 14,
    gap: 10,
    marginBottom: 28,
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: typography.semiBold,
    letterSpacing: 1.5,
  },

  /* Create Account */
  createAccountSection: {
    alignItems: 'center',
  },
  newToText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: typography.medium,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  createAccountLink: {
    color: colors.purple,
    fontSize: 13,
    fontWeight: typography.semiBold,
  },
});
