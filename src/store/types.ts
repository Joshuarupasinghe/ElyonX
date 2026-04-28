// EQ Band filter types
export type EQBandType = 'bell' | 'lowshelf' | 'highshelf' | 'highpass' | 'lowpass';

export interface EQBand {
  id: number;
  type: EQBandType;
  frequency: number;   // 20–20000 Hz
  gain: number;         // -18 to +18 dB
  q: number;            // 0.1 to 30
  enabled: boolean;
}

export interface Channel {
  id: string;
  index: number;        // 1-based channel number on the mixer
  name: string;
  input: string;        // e.g., "INPUT 01"
  color: string;
  faderValue: number;   // -60 to +6 dB (display), 0–1 (OSC)
  muted: boolean;
  solo: boolean;
  eqBands: EQBand[];
  eqEnabled: boolean;
}

export interface MixerConnection {
  connected: boolean;
  host: string;
  sendPort: number;
  receivePort: number;
  mixerName: string;
  adapterType: string;
}

// OSC event types coming from the mixer
export type MixerEventType =
  | 'fader'
  | 'mute'
  | 'solo'
  | 'eq_freq'
  | 'eq_gain'
  | 'eq_q'
  | 'eq_type'
  | 'channel_name'
  | 'connection'
  | 'unknown';

export interface MixerEvent {
  type: MixerEventType;
  channel: number;
  band?: number;
  param?: string;
  value: number | string | boolean;
}

// Biquad filter coefficients
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

// UI local state types
export interface UIState {
  selectedChannelId: string | null;
  selectedEQBandId: number | null;
  showGrid: boolean;
  showPhase: boolean;
  compactMode: boolean;
  logScaleFreq: boolean;
  aiAssistEnabled: boolean;
}

// Default EQ bands for a new channel
export const DEFAULT_EQ_BANDS: EQBand[] = [
  { id: 1, type: 'highpass', frequency: 80, gain: 0, q: 0.707, enabled: true },
  { id: 2, type: 'lowshelf', frequency: 200, gain: 0, q: 0.707, enabled: true },
  { id: 3, type: 'bell', frequency: 1000, gain: 0, q: 1.0, enabled: true },
  { id: 4, type: 'highshelf', frequency: 8000, gain: 0, q: 0.707, enabled: true },
  { id: 5, type: 'lowpass', frequency: 16000, gain: 0, q: 0.707, enabled: false },
];

// Default channels matching the reference design
export const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 'ch-1', index: 1, name: 'Kick', input: 'INPUT 01',
    color: '#7B5CFA', faderValue: -3.2, muted: false, solo: false,
    eqBands: [...DEFAULT_EQ_BANDS], eqEnabled: true,
  },
  {
    id: 'ch-2', index: 2, name: 'Snare', input: 'INPUT 02',
    color: '#7B5CFA', faderValue: -8.4, muted: false, solo: false,
    eqBands: [...DEFAULT_EQ_BANDS], eqEnabled: true,
  },
  {
    id: 'ch-3', index: 7, name: 'Lead Vocal', input: 'INPUT 07',
    color: '#7B5CFA', faderValue: -1.2, muted: false, solo: true,
    eqBands: [
      { id: 1, type: 'highpass', frequency: 80, gain: 0, q: 0.707, enabled: true },
      { id: 2, type: 'bell', frequency: 300, gain: -4, q: 1.5, enabled: true },
      { id: 3, type: 'bell', frequency: 487.7, gain: -5.1, q: 2.0, enabled: true },
      { id: 4, type: 'highshelf', frequency: 10000, gain: 3, q: 0.707, enabled: true },
      { id: 5, type: 'lowpass', frequency: 18000, gain: 0, q: 0.707, enabled: true },
    ],
    eqEnabled: true,
  },
  {
    id: 'ch-4', index: 8, name: 'Backing Vocal', input: 'INPUT 08',
    color: '#7B5CFA', faderValue: -22.6, muted: true, solo: false,
    eqBands: [...DEFAULT_EQ_BANDS], eqEnabled: true,
  },
  {
    id: 'ch-5', index: 4, name: 'Bass', input: 'INPUT 04',
    color: '#FFAB40', faderValue: -12.8, muted: false, solo: false,
    eqBands: [...DEFAULT_EQ_BANDS], eqEnabled: true,
  },
  {
    id: 'ch-6', index: 5, name: 'Electric Guitar', input: 'INPUT 05',
    color: '#FFAB40', faderValue: -5.4, muted: false, solo: false,
    eqBands: [...DEFAULT_EQ_BANDS], eqEnabled: true,
  },
];
