/**
 * ElyonX IMS – Auth Module Barrel Export
 */

export {
  loginWithEmail,
  signUpWithEmail,
  loginWithGoogle,
  handleAuthCallback,
  parseAuthCallbackUrl,
  fetchCurrentUser,
  logout,
  isAuthenticated,
  getToken,
  clearToken,
} from './authService';
export type {
  AuthUser,
  AuthCallbackParams,
  EmailLoginPayload,
  EmailSignUpPayload,
} from './authService';

export { setToken } from './tokenStorage';
export { authFetch, api } from './apiClient';
