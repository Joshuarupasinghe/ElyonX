/**
 * ElyonX IMS – Token Storage Utility
 * Provides get/set/clear for the application JWT.
 *
 * Uses in-memory storage with localStorage persistence on web.
 * For React Native Windows, it stores in memory (secure storage
 * like react-native-keychain can be added for production).
 */

import { Platform } from 'react-native';

const TOKEN_STORAGE_KEY = 'elyonx_auth_token';
const EXPIRY_STORAGE_KEY = 'elyonx_token_expiry';

// In-memory fallback for native platforms
let _memoryToken: string | null = null;
let _memoryExpiry: number | null = null;

/**
 * Save the JWT token and its expiry timestamp.
 */
export function setToken(token: string, expiresIn?: number): void {
  _memoryToken = token;
  const expiry = expiresIn
    ? Date.now() + expiresIn * 1000
    : Date.now() + 24 * 60 * 60 * 1000; // Default 24h
  _memoryExpiry = expiry;

  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(EXPIRY_STORAGE_KEY, String(expiry));
    } catch (e) {
      console.warn('[ElyonX] Failed to persist token to localStorage:', e);
    }
  }
}

/**
 * Retrieve the stored JWT token.
 * Returns null if no token is stored or if the token has expired.
 */
export function getToken(): string | null {
  // Try in-memory first
  if (_memoryToken) {
    if (_memoryExpiry && Date.now() > _memoryExpiry) {
      clearToken();
      return null;
    }
    return _memoryToken;
  }

  // Try localStorage on web
  if (Platform.OS === 'web') {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const expiryStr = localStorage.getItem(EXPIRY_STORAGE_KEY);
      if (token && expiryStr) {
        const expiry = parseInt(expiryStr, 10);
        if (Date.now() > expiry) {
          clearToken();
          return null;
        }
        // Restore to memory
        _memoryToken = token;
        _memoryExpiry = expiry;
        return token;
      }
    } catch (e) {
      console.warn('[ElyonX] Failed to read token from localStorage:', e);
    }
  }

  return null;
}

/**
 * Clear the stored token (logout).
 */
export function clearToken(): void {
  _memoryToken = null;
  _memoryExpiry = null;

  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(EXPIRY_STORAGE_KEY);
    } catch (e) {
      console.warn('[ElyonX] Failed to clear token from localStorage:', e);
    }
  }
}

/**
 * Check if the user is currently authenticated.
 */
export function isAuthenticated(): boolean {
  return getToken() !== null;
}
