/**
 * ElyonX IMS – Backend API client
 * Centralises the base URL and provides typed helpers for REST calls.
 */

import {
  EQBand,
  EQBandType,
  EQRecommendation,
  EQRecommendationQuality,
  EQRecommendationStatus,
  InstrumentType,
} from '../store/types';

export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

const VALID_EQ_TYPES: ReadonlySet<EQBandType> = new Set([
  'bell',
  'lowshelf',
  'highshelf',
  'highpass',
  'lowpass',
]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeBand(rawBand: any, index: number): EQBand {
  const rawType =
    typeof rawBand?.type === 'string' ? rawBand.type.toLowerCase() : 'bell';
  const type: EQBandType = VALID_EQ_TYPES.has(rawType as EQBandType)
    ? (rawType as EQBandType)
    : 'bell';

  const frequency = clamp(Number(rawBand?.frequency ?? 1000), 20, 20000);
  const gain = clamp(Number(rawBand?.gain ?? 0), -18, 18);
  const q = clamp(Number(rawBand?.q ?? 0.7), 0.1, 30);

  return {
    id: Number.isFinite(Number(rawBand?.id)) ? Number(rawBand.id) : index + 1,
    type,
    frequency: Number.isFinite(frequency) ? Number(frequency.toFixed(1)) : 1000,
    gain: Number.isFinite(gain) ? Number(gain.toFixed(2)) : 0,
    q: Number.isFinite(q) ? Number(q.toFixed(2)) : 0.7,
    enabled: Boolean(rawBand?.enabled ?? true),
  };
}

function normalizeQuality(payload: any): EQRecommendationQuality {
  const rawQuality = payload?.quality ?? {};
  const rawStatus =
    typeof rawQuality.status === 'string'
      ? rawQuality.status.toLowerCase()
      : 'ok';
  const status: EQRecommendationStatus =
    rawStatus === 'warning' || rawStatus === 'error' ? rawStatus : 'ok';

  const toNullableNumber = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    status,
    warnings: Array.isArray(rawQuality.warnings)
      ? rawQuality.warnings.filter((item: unknown) => typeof item === 'string')
      : [],
    usable: Boolean(rawQuality.usable ?? true),
    rms_dbfs: toNullableNumber(rawQuality.rms_dbfs),
    peak_dbfs: toNullableNumber(rawQuality.peak_dbfs),
    smoothed: Boolean(rawQuality.smoothed ?? false),
  };
}

function normalizeEQRecommendation(payload: any): EQRecommendation {
  const bands = Array.isArray(payload?.bands)
    ? payload.bands.map(normalizeBand)
    : [];

  return {
    instrument: payload?.instrument as InstrumentType,
    inference_ms: Number(payload?.inference_ms ?? 0),
    bands,
    quality: normalizeQuality(payload),
  };
}

// ── Device / Capture endpoints ────────────────────────────────────────

export interface StartCaptureResponse {
  status: string;
  device: {
    index: number;
    name: string;
    sample_rate: number;
    block_size: number;
    channels: number;
    rta_input_channel?: number;
    latency_ms: number;
  };
  session_id: string | null;
}

export interface StopCaptureResponse {
  status: string;
  stats: Record<string, unknown>;
}

export interface AudioDeviceOption {
  index: number;
  name: string;
  max_input_channels: number;
  default_samplerate: number | null;
  hostapi: string;
}

export interface RuntimeSettings {
  mixer: {
    osc_target_ip: string;
    osc_target_port: number;
  };
  audio: {
    selected_device_index: number | null;
    selected_device_name: string;
    fallback_device_name: string;
    rta_input_channel: number;
    max_input_channels: number;
    stream_active: boolean;
  };
  equalizer: {
    band_mode: 4 | 6;
    labels: string[];
  };
  available_audio_devices: AudioDeviceOption[];
  requires_capture_restart: boolean;
}

export interface UpdateRuntimeSettingsPayload {
  osc_target_ip?: string;
  osc_target_port?: number;
  audio_device_index?: number | null;
  audio_device_name?: string;
  rta_input_channel?: number;
  eq_band_mode?: 4 | 6;
}

export interface RegisteredMixerChannel {
  channel: number;
  name: string | null;
  instrument: string | null;
  input_source: number | null;
  registered_at: number;
}

export interface MixerStatus {
  connected: boolean;
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  host: string;
  port: number;
  mixer_name: string | null;
  firmware: string | null;
  model: string | null;
  last_seen_at: number | null;
  latency_ms: number | null;
  error: string | null;
  registered_channels: RegisteredMixerChannel[];
}

export interface RegisterMixerChannelPayload {
  channel: number;
  name?: string;
  instrument?: string;
  input_source?: number;
}

export interface MixerEQBandPayload {
  band: number;
  type?: EQBandType;
  frequency?: number;
  gain?: number;
  q?: number;
  enabled?: boolean;
}

/**
 * POST /api/v1/devices/start
 * Opens the Focusrite audio stream and launches the RTA processing loop.
 */
export async function startCapture(
  deviceIndex?: number
): Promise<StartCaptureResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1/devices/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      deviceIndex !== undefined ? { device_index: deviceIndex } : {}
    ),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Start capture failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as StartCaptureResponse;
}

/**
 * POST /api/v1/devices/stop
 * Stops the audio stream and RTA processing loop.
 */
export async function stopCapture(): Promise<StopCaptureResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1/devices/stop`, {
    method: 'POST',
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Stop capture failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as StopCaptureResponse;
}

/**
 * GET /api/v1/settings
 * Returns mixer endpoint, RTA input, and EQ topology runtime settings.
 */
export async function fetchRuntimeSettings(): Promise<RuntimeSettings> {
  const res = await fetch(`${BACKEND_URL}/api/v1/settings/`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Fetch settings failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RuntimeSettings;
}

/**
 * PATCH /api/v1/settings
 * Hot-updates runtime settings. Audio device/channel changes apply on the next
 * capture start when the stream is already running.
 */
export async function updateRuntimeSettings(
  payload: UpdateRuntimeSettingsPayload
): Promise<RuntimeSettings> {
  const res = await fetch(`${BACKEND_URL}/api/v1/settings/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Update settings failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RuntimeSettings;
}

async function parseBackendError(res: Response, action: string): Promise<never> {
  const detail = await res.text();
  throw new Error(`${action} failed (${res.status}): ${detail}`);
}

export async function fetchMixerStatus(): Promise<MixerStatus> {
  const res = await fetch(`${BACKEND_URL}/api/v1/mixer/status`);
  if (!res.ok) {
    await parseBackendError(res, 'Fetch mixer status');
  }
  return (await res.json()) as MixerStatus;
}

export async function connectMixer(): Promise<MixerStatus> {
  const res = await fetch(`${BACKEND_URL}/api/v1/mixer/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    await parseBackendError(res, 'Connect mixer');
  }
  return (await res.json()) as MixerStatus;
}

export async function disconnectMixer(): Promise<MixerStatus> {
  const res = await fetch(`${BACKEND_URL}/api/v1/mixer/disconnect`, {
    method: 'POST',
  });
  if (!res.ok) {
    await parseBackendError(res, 'Disconnect mixer');
  }
  return (await res.json()) as MixerStatus;
}

export async function registerMixerChannel(
  payload: RegisterMixerChannelPayload
): Promise<MixerStatus> {
  const res = await fetch(`${BACKEND_URL}/api/v1/mixer/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseBackendError(res, 'Register mixer channel');
  }
  return (await res.json()) as MixerStatus;
}

export async function setMixerChannelFader(
  channel: number,
  db: number
): Promise<void> {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mixer/channels/${channel}/fader`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db }),
    }
  );
  if (!res.ok) {
    await parseBackendError(res, 'Set channel fader');
  }
}

export async function setMixerMasterFader(db: number): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/v1/mixer/master/fader`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ db }),
  });
  if (!res.ok) {
    await parseBackendError(res, 'Set master fader');
  }
}

export async function setMixerChannelGain(
  channel: number,
  db: number,
  target: 'trim' | 'headamp' = 'trim'
): Promise<void> {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mixer/channels/${channel}/gain`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db, target }),
    }
  );
  if (!res.ok) {
    await parseBackendError(res, 'Set channel gain');
  }
}

export async function setMixerChannelMute(
  channel: number,
  muted: boolean
): Promise<void> {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mixer/channels/${channel}/mute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: muted }),
    }
  );
  if (!res.ok) {
    await parseBackendError(res, 'Set channel mute');
  }
}

export async function setMixerChannelSolo(
  channel: number,
  solo: boolean
): Promise<void> {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mixer/channels/${channel}/solo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: solo }),
    }
  );
  if (!res.ok) {
    await parseBackendError(res, 'Set channel solo');
  }
}

export async function setMixerChannelEQBand(
  channel: number,
  payload: MixerEQBandPayload
): Promise<void> {
  const res = await fetch(
    `${BACKEND_URL}/api/v1/mixer/channels/${channel}/eq`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    await parseBackendError(res, 'Set channel EQ');
  }
}

/**
 * POST /api/v1/audio/analyze
 * Analyzes the current RTA audio block for the specified instrument and returns an EQ recommendation.
 */
export async function analyzeChannel(
  instrument: string
): Promise<EQRecommendation> {
  const res = await fetch(`${BACKEND_URL}/api/v1/audio/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrument }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Analyze failed (${res.status}): ${detail}`);
  }
  const payload = await res.json();
  return normalizeEQRecommendation(payload);
}

/**
 * POST /api/v1/audio/reset
 * Resets the EQ state and clears cached inference results on the backend.
 */
export interface ResetEQResponse {
  status: string;
  message: string;
  timestamp: string;
}

export async function resetEQ(): Promise<ResetEQResponse> {
  const res = await fetch(`${BACKEND_URL}/api/v1/audio/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Reset EQ failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as ResetEQResponse;
}
