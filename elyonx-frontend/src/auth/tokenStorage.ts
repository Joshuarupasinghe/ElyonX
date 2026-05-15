import { NativeModules, Platform } from 'react-native';

const TOKEN_STORAGE_KEY = 'elyonx_auth_token';
const EXPIRY_STORAGE_KEY = 'elyonx_token_expiry';
const SESSION_SEPARATOR = '\n';
const DEFAULT_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

type StoredSession = {
  token: string;
  expiry: number;
};

type NativeTokenStorage = {
  getSession: () => string | null;
  setSession: (session: string) => boolean;
  clearSession: () => boolean;
};

let _memoryToken: string | null = null;
let _memoryExpiry: number | null = null;

function getNativeTokenStorage(): NativeTokenStorage | null {
  if (Platform.OS === 'web') return null;

  const storage = (NativeModules as Record<string, unknown>)
    .ElyonXAuthStorage as Partial<NativeTokenStorage> | undefined;

  if (
    storage &&
    typeof storage.getSession === 'function' &&
    typeof storage.setSession === 'function' &&
    typeof storage.clearSession === 'function'
  ) {
    return storage as NativeTokenStorage;
  }

  return null;
}

function encodeSession(session: StoredSession): string {
  return `${session.expiry}${SESSION_SEPARATOR}${session.token}`;
}

function decodeSession(rawSession: string | null | undefined): StoredSession | null {
  if (!rawSession) return null;

  const separatorIndex = rawSession.indexOf(SESSION_SEPARATOR);
  if (separatorIndex <= 0) return null;

  const expiry = Number(rawSession.slice(0, separatorIndex));
  const token = rawSession.slice(separatorIndex + SESSION_SEPARATOR.length);

  if (!token || !Number.isFinite(expiry)) return null;

  return { token, expiry };
}

function readPersistentSession(): StoredSession | null {
  if (Platform.OS === 'web') {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const expiryStr = localStorage.getItem(EXPIRY_STORAGE_KEY);
      if (!token || !expiryStr) return null;

      const expiry = Number(expiryStr);
      if (!Number.isFinite(expiry)) return null;

      return { token, expiry };
    } catch (e) {
      console.warn('[ElyonX] Failed to read token from localStorage:', e);
      return null;
    }
  }

  const nativeStorage = getNativeTokenStorage();
  if (!nativeStorage) return null;

  try {
    return decodeSession(nativeStorage.getSession());
  } catch (e) {
    console.warn('[ElyonX] Failed to read token from native storage:', e);
    return null;
  }
}

function persistSession(session: StoredSession): void {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, session.token);
      localStorage.setItem(EXPIRY_STORAGE_KEY, String(session.expiry));
    } catch (e) {
      console.warn('[ElyonX] Failed to persist token to localStorage:', e);
    }
    return;
  }

  const nativeStorage = getNativeTokenStorage();
  if (!nativeStorage) return;

  try {
    if (!nativeStorage.setSession(encodeSession(session))) {
      console.warn('[ElyonX] Failed to persist token to native storage.');
    }
  } catch (e) {
    console.warn('[ElyonX] Failed to persist token to native storage:', e);
  }
}

function clearPersistentSession(): void {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(EXPIRY_STORAGE_KEY);
    } catch (e) {
      console.warn('[ElyonX] Failed to clear token from localStorage:', e);
    }
    return;
  }

  const nativeStorage = getNativeTokenStorage();
  if (!nativeStorage) return;

  try {
    nativeStorage.clearSession();
  } catch (e) {
    console.warn('[ElyonX] Failed to clear token from native storage:', e);
  }
}

export function setToken(
  token: string,
  expiresIn?: number,
  persist = true,
): void {
  _memoryToken = token;
  const expiry = expiresIn
    ? Date.now() + expiresIn * 1000
    : Date.now() + DEFAULT_TOKEN_EXPIRY_MS;
  _memoryExpiry = expiry;

  if (persist) {
    persistSession({ token, expiry });
  } else {
    clearPersistentSession();
  }
}

export function getToken(): string | null {
  if (_memoryToken) {
    if (_memoryExpiry && Date.now() > _memoryExpiry) {
      clearToken();
      return null;
    }
    return _memoryToken;
  }

  const session = readPersistentSession();
  if (session) {
    if (Date.now() > session.expiry) {
      clearToken();
      return null;
    }

    _memoryToken = session.token;
    _memoryExpiry = session.expiry;
    return session.token;
  }

  return null;
}

export function clearToken(): void {
  _memoryToken = null;
  _memoryExpiry = null;
  clearPersistentSession();
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}
