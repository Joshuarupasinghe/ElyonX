import { MixerEvent } from '../../store/types';

/**
 * Abstract interface that normalizes different mixer brands' OSC address spaces.
 * Implement one per mixer brand.
 */
export interface MixerAdapter {
  readonly name: string;
  readonly defaultSendPort: number;
  readonly defaultReceivePort: number;

  getFaderAddress(channel: number): string;
  getMasterFaderAddress(): string;
  getMuteAddress(channel: number): string;
  getSoloAddress(channel: number): string;
  getChannelNameAddress(channel: number): string;
  getEQFreqAddress(channel: number, band: number): string;
  getEQGainAddress(channel: number, band: number): string;
  getEQQAddress(channel: number, band: number): string;
  getEQTypeAddress(channel: number, band: number): string;
  getEQOnAddress(channel: number): string;

  faderToDB(oscValue: number): number;
  dbToFader(db: number): number;

  parseMessage(address: string, args: any[]): MixerEvent;

  getSubscribeMessages(): Array<{ address: string; args: any[] }>;
  subscribeIntervalMs: number;
}
