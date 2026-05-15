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

interface SignUpScreenProps {
  onSignUp: (data: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => void | Promise<void>;
  onNavigateToLogin: () => void;
  onGoogleSignIn?: () => void;
  errorMessage?: string | null;
  isSubmitting?: boolean;
}

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

const UserIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = colors.textMuted,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Circle cx="12" cy="7" r="4" stroke={color} strokeWidth={1.5} fill="none" />
  </Svg>
);

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

const ShieldIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 18,
  color = colors.textMuted,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth={1.5} fill="none" />
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

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  onSignUp,
  onNavigateToLogin,
  onGoogleSignIn,
  errorMessage,
  isSubmitting = false,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const passwordStrong = password.length >= 8;
  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    agreeTerms &&
    passwordsMatch &&
    passwordStrong &&
    !isSubmitting;

  const handleSignUp = useCallback(() => {
    if (!canSubmit) return;
    onSignUp({ fullName: fullName.trim(), email: email.trim(), password, confirmPassword });
  }, [canSubmit, fullName, email, password, confirmPassword, onSignUp]);

  return (
    <View style={styles.screenContainer}>
      <View style={styles.glowTopLeft} />
      <View style={styles.glowBottomRight} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.brandingSection}>
            <ElyonXLogo size={52} />
            <Text style={styles.brandName}>ELYONX</Text>
            <Text style={styles.brandSubtitle}>INTELLIGENT MIXING SYSTEM</Text>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.accentBar} />
            <Text style={styles.sectionTitle}>CREATE ACCOUNT</Text>
          </View>

          {errorMessage ? (
            <Text style={styles.formError}>{errorMessage}</Text>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL NAME</Text>
            <View
              style={[
                styles.inputContainer,
                nameFocused && styles.inputContainerFocused,
              ]}
            >
              <UserIcon size={16} color={nameFocused ? colors.purple : colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="John Doe"
                placeholderTextColor={colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoCorrect={false}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
              />
            </View>
          </View>

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
                style={styles.input}
                placeholder="studio@sonicai.com"
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

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONSOLE PASSWORD</Text>
            <View
              style={[
                styles.inputContainer,
                passwordFocused && styles.inputContainerFocused,
              ]}
            >
              <LockIcon size={16} color={passwordFocused ? colors.purple : colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Min. 8 characters"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                activeOpacity={0.6}
              >
                <EyeIcon size={16} color={colors.textMuted} visible={showPassword} />
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                <View style={styles.strengthBarContainer}>
                  <View
                    style={[
                      styles.strengthBar,
                      {
                        width: password.length >= 12 ? '100%' : password.length >= 8 ? '66%' : '33%',
                        backgroundColor:
                          password.length >= 12
                            ? colors.green
                            : password.length >= 8
                            ? colors.orange
                            : colors.red,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.strengthText,
                    {
                      color:
                        password.length >= 12
                          ? colors.green
                          : password.length >= 8
                          ? colors.orange
                          : colors.red,
                    },
                  ]}
                >
                  {password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Good' : 'Weak'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
            <View
              style={[
                styles.inputContainer,
                confirmFocused && styles.inputContainerFocused,
                confirmPassword.length > 0 && !passwordsMatch && styles.inputContainerError,
              ]}
            >
              <ShieldIcon size={16} color={confirmFocused ? colors.purple : colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="Re-enter password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
                activeOpacity={0.6}
              >
                <EyeIcon size={16} color={colors.textMuted} visible={showConfirmPassword} />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
            {passwordsMatch && (
              <Text style={styles.matchText}>✓ Passwords match</Text>
            )}
          </View>

          <View style={styles.termsRow}>
            <Checkbox
              label=""
              checked={agreeTerms}
              onToggle={setAgreeTerms}
            />
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.signUpButton,
              !canSubmit && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            activeOpacity={0.85}
            disabled={!canSubmit}
          >
            <View
              style={[
                styles.signUpButtonGradient,
                !canSubmit && styles.buttonGradientDisabled,
              ]}
            >
              <Text style={styles.signUpButtonText}>
                {isSubmitting ? 'CREATING ACCOUNT' : 'CREATE ACCOUNT'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={onGoogleSignIn}
            activeOpacity={0.85}
          >
            <GoogleIcon size={18} />
            <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
          </TouchableOpacity>

          <View style={styles.loginLinkSection}>
            <Text style={styles.existingText}>ALREADY HAVE AN ACCOUNT?</Text>
            <TouchableOpacity onPress={onNavigateToLogin} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Sign In →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

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
  inputContainerError: {
    borderColor: 'rgba(255, 82, 82, 0.5)',
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

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  strengthBarContainer: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 10,
    fontWeight: typography.medium,
  },

  errorText: {
    color: colors.red,
    fontSize: 10,
    fontWeight: typography.medium,
    marginTop: 6,
  },
  matchText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: typography.medium,
    marginTop: 6,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    marginTop: 4,
  },
  termsText: {
    color: colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  termsLink: {
    color: colors.purple,
    fontWeight: typography.semiBold,
  },

  signUpButton: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  signUpButtonGradient: {
    backgroundColor: colors.purple,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? {
          background: 'linear-gradient(135deg, #9B59F7 0%, #C084FC 50%, #A855F7 100%)',
        }
      : {}),
  } as any,
  signUpButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradientDisabled: {
    backgroundColor: '#3A3A4A',
    ...(Platform.OS === 'web'
      ? { background: '#3A3A4A' }
      : {}),
  } as any,

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

  loginLinkSection: {
    alignItems: 'center',
  },
  existingText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: typography.medium,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  loginLink: {
    color: colors.purple,
    fontSize: 13,
    fontWeight: typography.semiBold,
  },
});
