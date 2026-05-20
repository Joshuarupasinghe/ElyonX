import React, { useState, useCallback, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, View, Platform } from 'react-native';
import { MixerScreen } from './src/screens/MixerScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SignUpScreen } from './src/screens/SignUpScreen';
import { AccountScreen } from './src/screens/AccountScreen';
import {
  loginWithEmail,
  signUpWithEmail,
  loginWithGoogle,
  handleAuthCallback,
  parseAuthCallbackUrl,
  fetchCurrentUser,
  logout,
  isAuthenticated,
  AuthUser,
  addDeepLinkListener,
  getInitialDeepLinkUrl,
} from './src/auth';

type Screen = 'login' | 'signup' | 'mixer' | 'account';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,       // OSC pushes updates; don't auto-refetch
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const processedAuthCallbackUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        if (isAuthenticated()) {
          const user = await fetchCurrentUser();
          setCurrentUser(user);
          setCurrentScreen('mixer');
        }
      } catch (err) {
        console.warn('[ElyonX] Session restore failed:', err);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const processCallbackUrl = async (url: string) => {
      if (!url.includes('/auth/callback') && !url.includes('auth/callback')) return;
      if (processedAuthCallbackUrls.current.has(url)) return;

      processedAuthCallbackUrls.current.add(url);

      console.log('[ElyonX] Processing auth callback URL:', url);

      try {
        setAuthLoading(true);
        const params = parseAuthCallbackUrl(url);
        console.log('[ElyonX] Auth callback params:', { token: params.token ? 'present' : 'missing', error: params.error });
        
        const user = await handleAuthCallback(params);
        console.log('[ElyonX] Auth successful for user:', user.email);
        setCurrentUser(user);
        setCurrentScreen('mixer');
        setAuthError(null);
      } catch (err: any) {
        console.error('[ElyonX] Auth callback error:', err.message);
        setAuthError(err.message || 'Authentication failed. Please try again.');
      } finally {
        setAuthLoading(false);
      }
    };

    if (Platform.OS === 'web') {
      const currentUrl = window.location.href;
      if (currentUrl.includes('/auth/callback')) {
        console.log('[ElyonX] Web callback detected');
        processCallbackUrl(currentUrl);
        if (window.history?.replaceState) {
          window.history.replaceState({}, '', '/');
        }
      }
    } else {
      const handleUrl = (url: string) => {
        console.log('[ElyonX] Deep link received:', url);
        processCallbackUrl(url);
      };

      getInitialDeepLinkUrl().then((url) => {
        if (url) {
          console.log('[ElyonX] Initial URL from deep link:', url);
          processCallbackUrl(url);
        }
      }).catch((err) => {
        console.warn('[ElyonX] Failed to get initial URL:', err);
      });

      const subscription = addDeepLinkListener(handleUrl);
      return () => subscription.remove();
    }
  }, []);

  const handleLogin = useCallback(async (
    email: string,
    password: string,
    rememberSession = true,
  ) => {
    setAuthSubmitting(true);
    setAuthError(null);

    try {
      const user = await loginWithEmail(
        { email, password },
        { persist: rememberSession },
      );
      setCurrentUser(user);
      setCurrentScreen('mixer');
    } catch (err: any) {
      console.error('[ElyonX] Login failed:', err.message);
      setAuthError(err.message || 'Login failed. Please try again.');
    } finally {
      setAuthSubmitting(false);
    }
  }, []);

  const handleSignUp = useCallback((data: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    (async () => {
      setAuthSubmitting(true);
      setAuthError(null);

      try {
        const user = await signUpWithEmail({
          fullName: data.fullName,
          email: data.email,
          password: data.password,
        });
        setCurrentUser(user);
        setCurrentScreen('mixer');
      } catch (err: any) {
        console.error('[ElyonX] Sign up failed:', err.message);
        setAuthError(err.message || 'Sign up failed. Please try again.');
      } finally {
        setAuthSubmitting(false);
      }
    })();
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    console.log('[ElyonX] Google sign-in initiated');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('[ElyonX] Google sign-in failed:', err.message);
      setAuthError(err.message || 'Google sign-in failed. Please try again.');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setCurrentUser(null);
      setCurrentScreen('login');
      setAuthError(null);
      console.log('[ElyonX] User logged out');
    } catch (err: any) {
      console.error('[ElyonX] Logout failed:', err.message);
    }
  }, []);

  const handleViewAccount = useCallback(() => {
    if (currentUser) {
      setCurrentScreen('account');
    }
  }, [currentUser]);

  const renderScreen = () => {
    if (authLoading) return null;

    switch (currentScreen) {
      case 'login':
        return (
          <LoginScreen
            onLogin={handleLogin}
            onNavigateToSignUp={() => {
              setAuthError(null);
              setCurrentScreen('signup');
            }}
            onGoogleSignIn={handleGoogleSignIn}
            errorMessage={authError}
            isSubmitting={authSubmitting}
          />
        );
      case 'signup':
        return (
          <SignUpScreen
            onSignUp={handleSignUp}
            onNavigateToLogin={() => {
              setAuthError(null);
              setCurrentScreen('login');
            }}
            onGoogleSignIn={handleGoogleSignIn}
            errorMessage={authError}
            isSubmitting={authSubmitting}
          />
        );
      case 'mixer':
        return (
          <MixerScreen
            currentUser={currentUser}
            onViewAccount={handleViewAccount}
            onLogout={handleLogout}
          />
        );
      case 'account':
        return currentUser ? (
          <AccountScreen
            user={currentUser}
            onBack={() => setCurrentScreen('mixer')}
            onLogout={handleLogout}
          />
        ) : (
          <LoginScreen
            onLogin={handleLogin}
            onNavigateToSignUp={() => setCurrentScreen('signup')}
            onGoogleSignIn={handleGoogleSignIn}
            errorMessage={authError}
            isSubmitting={authSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.root}>
        {renderScreen()}
      </View>
    </QueryClientProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
