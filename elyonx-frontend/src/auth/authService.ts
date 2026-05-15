/**
 * ElyonX IMS – Authentication Service
 * Handles Google OAuth login flow, token management, and user profile retrieval.
 */

import { Linking, Platform } from 'react-native';
import { BACKEND_URL } from '../api/backend';
import { setToken, getToken, clearToken, isAuthenticated } from './tokenStorage';

// ── Types ─────────────────────────────────────────────────────────────

export interface AuthUser {
  user_id: string;
  google_id: string | null;
  email: string;
  name: string;
  profile_picture: string | null;
  auth_provider: 'local' | 'google' | string;
  is_active: boolean;
}

export interface AuthCallbackParams {
  token?: string;
  expires_in?: string;
  error?: string;
}

export interface EmailLoginPayload {
  email: string;
  password: string;
}

export interface EmailSignUpPayload {
  fullName: string;
  email: string;
  password: string;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

interface AuthSessionOptions {
  persist?: boolean;
}

async function getAuthErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.clone().json()) as Record<string, unknown>;
    if (typeof body?.detail === 'string') {
      return body.detail;
    }
    if (Array.isArray(body?.detail)) {
      const messages = body.detail
        .map((item: any) => item?.msg)
        .filter(Boolean)
        .join(', ');
      if (messages) return messages;
    }
    if (typeof body?.message === 'string') {
      return body.message;
    }
  } catch {
    const text = await response.text();
    if (text) return text;
  }

  return response.statusText || 'Authentication failed';
}

async function submitAuthRequest(
  endpoint: '/auth/login' | '/auth/signup',
  body: Record<string, string>,
  sessionOptions: AuthSessionOptions = {},
): Promise<AuthUser> {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await getAuthErrorMessage(response));
  }

  const authResponse = (await response.json()) as AuthResponse;
  setToken(
    authResponse.access_token,
    authResponse.expires_in,
    sessionOptions.persist ?? true,
  );
  return authResponse.user;
}

export async function loginWithEmail(
  payload: EmailLoginPayload,
  sessionOptions?: AuthSessionOptions,
): Promise<AuthUser> {
  return submitAuthRequest('/auth/login', {
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  }, sessionOptions);
}

export async function signUpWithEmail(
  payload: EmailSignUpPayload,
): Promise<AuthUser> {
  return submitAuthRequest('/auth/signup', {
    full_name: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    password: payload.password,
  });
}

// ── Google OAuth Login ────────────────────────────────────────────────

/**
 * Initiates Google OAuth login by opening the backend's login URL
 * in the system browser. The backend handles the full OAuth flow
 * and redirects back to the app with a JWT.
 */
export async function loginWithGoogle(): Promise<void> {
  const loginUrl = `${BACKEND_URL}/auth/google/login`;

  if (Platform.OS === 'web') {
    // On web, redirect the current window
    window.location.href = loginUrl;
  } else {
    // On native (Windows), open in the default system browser
    try {
      const canOpen = await Linking.canOpenURL(loginUrl);
      if (canOpen) {
        await Linking.openURL(loginUrl);
      } else {
        console.error('[ElyonX Auth] Cannot open URL:', loginUrl);
        throw new Error('Cannot open login URL in browser');
      }
    } catch (error) {
      console.error('[ElyonX Auth] Failed to open Google login:', error);
      throw error;
    }
  }
}

// ── Handle Auth Callback ──────────────────────────────────────────────

/**
 * Process the callback parameters after Google OAuth redirect.
 * Extracts the JWT from URL query params and stores it.
 *
 * @returns The authenticated user's profile if login succeeded.
 * @throws Error if authentication failed.
 */
export async function handleAuthCallback(
  params: AuthCallbackParams,
): Promise<AuthUser> {
  if (params.error) {
    throw new Error(`Authentication failed: ${params.error}`);
  }

  if (!params.token) {
    throw new Error('No authentication token received');
  }

  // Store the JWT
  const expiresIn = params.expires_in ? parseInt(params.expires_in, 10) : undefined;
  setToken(params.token, expiresIn);

  // Fetch the user profile to confirm the token works
  const user = await fetchCurrentUser();
  return user;
}

// ── Parse Callback URL ────────────────────────────────────────────────

/**
 * Extract auth callback parameters from a URL string.
 * Works for both web URLs and deep-link URLs.
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParams {
  try {
    // Handle both http:// URLs and custom scheme deep links
    const urlObj = new URL(url);
    return {
      token: urlObj.searchParams.get('token') ?? undefined,
      expires_in: urlObj.searchParams.get('expires_in') ?? undefined,
      error: urlObj.searchParams.get('error') ?? undefined,
    };
  } catch {
    // Fallback: try to extract query string manually
    const queryStart = url.indexOf('?');
    if (queryStart === -1) return {};

    const qs = url.substring(queryStart + 1);
    const params: Record<string, string> = {};
    qs.split('&').forEach((pair) => {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
      }
    });
    return {
      token: params.token,
      expires_in: params.expires_in,
      error: params.error,
    };
  }
}

// ── Fetch Current User ────────────────────────────────────────────────

/**
 * Call /auth/me with the stored JWT to get the current user profile.
 * Throws if not authenticated or if the token is invalid.
 */
export async function fetchCurrentUser(): Promise<AuthUser> {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated: no token available');
  }

  const response = await fetch(`${BACKEND_URL}/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Token expired or invalid — clear it
    clearToken();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to fetch user profile (${response.status}): ${detail}`);
  }

  return (await response.json()) as AuthUser;
}

// ── Logout ────────────────────────────────────────────────────────────

/**
 * Log out the current user.
 * Calls the backend logout endpoint and clears the local token.
 */
export async function logout(): Promise<void> {
  const token = getToken();

  // Best-effort call to backend logout
  if (token) {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      // Logout should succeed even if the backend call fails
      console.warn('[ElyonX Auth] Backend logout call failed:', e);
    }
  }

  clearToken();
}

// ── Re-exports ────────────────────────────────────────────────────────
export { isAuthenticated, getToken, clearToken };
