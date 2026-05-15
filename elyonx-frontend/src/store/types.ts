// Instrument types for channel classification
export type InstrumentType = 'kick' | 'snare' | 'hihat';

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
  instrument: InstrumentType;
  input: string;        // e.g., "INPUT 01"
  color: string;
  icon: string;         // Emoji icon for the channel
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
  aiAssistEnabled: boolean;
}

// Default EQ bands for a new channel
export const DEFAULT_EQ_BANDS: EQBand[] = [
  { id: 1, type: 'bell', frequency: 80, gain: 0, q: 0.7, enabled: true },
  { id: 2, type: 'bell', frequency: 250, gain: 0, q: 0.7, enabled: true },
  { id: 3, type: 'bell', frequency: 2000, gain: 0, q: 0.7, enabled: true },
  { id: 4, type: 'bell', frequency: 8000, gain: 0, q: 0.7, enabled: true },
];


export interface BandEnergy {
  name: string;
  low_hz: number;
  high_hz: number;
  energy_db: number;
}

export interface ImbalanceIndicators {
  muddiness: number;
  harshness: number;
  thinness: number;
  brightness: number;
  average_db: number;
}

export interface FeedbackAlert {
  frequency_hz: number;
  magnitude_db: number;
  excess_db: number;
}

export type EQRecommendationStatus = 'ok' | 'warning' | 'error';

export interface EQRecommendationQuality {
  status: EQRecommendationStatus;
  warnings: string[];
  usable: boolean;
  rms_dbfs: number | null;
  peak_dbfs: number | null;
  smoothed: boolean;
}

export interface EQRecommendation {
  instrument: InstrumentType;
  inference_ms: number;
  bands: EQBand[];
  quality: EQRecommendationQuality;
}

export interface RTAFrame {
  event: "rta_frame" | "stream_offline" | "eq_recommendation";
  timestamp_ms: number;
  processing_time_ms: number;
  rta: {
    frequencies: number[];
    magnitudes_db: number[];
  };
  spl_dbfs: number;
  bands: BandEnergy[];
  imbalance: ImbalanceIndicators;
  feedback: {
    alerts: FeedbackAlert[];
    risk_level: "safe" | "warning" | "danger";
  };
  // Only present when event === 'eq_recommendation'
  instrument?: InstrumentType;
  inference_ms?: number;
  eq_bands?: EQBand[]; // Note: the backend sends 'bands' inside eq_recommendation, so we might need to handle the overlap carefully, but the backend to_dict() returns { instrument, inference_ms, bands } - we should make sure the payload merging doesn't overwrite RTA bands if we broadcast a raw eq_recommendation without RTA data. Wait, the backend broadcasts just the EQPrediction dictionary which has 'event': 'eq_recommendation', 'instrument', 'inference_ms', 'bands'. This is a completely different message shape from RTAFrame! So let's create a separate interface.
}

export interface EQRecommendationMessage {
  event: "eq_recommendation";
  instrument: InstrumentType;
  inference_ms: number;
  bands: EQBand[];
  quality?: EQRecommendationQuality;
}
