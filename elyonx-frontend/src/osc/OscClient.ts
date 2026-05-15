import { MixerAdapter } from './adapters/MixerAdapter';
import { MixerEvent } from '../store/types';

type MessageHandler = (event: MixerEvent) => void;

export class OscClient {
  private adapter: MixerAdapter;
  private host: string = process.env.EXPO_PUBLIC_OSC_TARGET_IP ?? '192.168.1.1';
  private sendPort: number;
  private receivePort: number;
  private handlers: MessageHandler[] = [];
  private subscribeTimer: ReturnType<typeof setInterval> | null = null;
  private connected: boolean = false;

  constructor(adapter: MixerAdapter) {
    this.adapter = adapter;
    this.sendPort = adapter.defaultSendPort;
    this.receivePort = adapter.defaultReceivePort;
  }

  async connect(host: string, sendPort?: number, receivePort?: number): Promise<void> {
    this.host = host;
    this.sendPort = sendPort ?? this.adapter.defaultSendPort;
    this.receivePort = receivePort ?? this.adapter.defaultReceivePort;

    try {
      this.connected = true;

      this.startSubscription();

      console.log(`[OSC] Connected to ${this.host}:${this.sendPort}`);
    } catch (error) {
      console.warn('[OSC] Failed to connect:', error);
      this.connected = false;
    }
  }

  disconnect(): void {
    if (this.subscribeTimer) {
      clearInterval(this.subscribeTimer);
      this.subscribeTimer = null;
    }
    this.connected = false;
    console.log('[OSC] Disconnected');
  }

  send(address: string, args: any[] = []): void {
    if (!this.connected) {
      console.warn('[OSC] Not connected, cannot send:', address);
      return;
    }

    try {
      console.log(`[OSC] → ${address}`, args);
    } catch (error) {
      console.warn('[OSC] Send error:', error);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  private handleIncoming = (_data: Buffer): void => {
    try {
      // Native OSC decoding is not implemented in this mock client.
    } catch (error) {
      console.warn('[OSC] Parse error:', error);
    }
  };

  private startSubscription(): void {
    const messages = this.adapter.getSubscribeMessages();
    if (messages.length === 0) return;

    messages.forEach(m => this.send(m.address, m.args));

    this.subscribeTimer = setInterval(() => {
      messages.forEach(m => this.send(m.address, m.args));
    }, this.adapter.subscribeIntervalMs);
  }

  setFader(channel: number, db: number): void {
    const oscVal = this.adapter.dbToFader(db);
    const address = channel === 0
      ? this.adapter.getMasterFaderAddress()
      : this.adapter.getFaderAddress(channel);
    this.send(address, [oscVal]);
  }

  setMute(channel: number, muted: boolean): void {
    // X32: on=0 means muted, on=1 means unmuted
    this.send(this.adapter.getMuteAddress(channel), [muted ? 0 : 1]);
  }

  setSolo(channel: number, solo: boolean): void {
    this.send(this.adapter.getSoloAddress(channel), [solo ? 1 : 0]);
  }

  setEQFreq(channel: number, band: number, freq: number): void {
    this.send(this.adapter.getEQFreqAddress(channel, band), [freq]);
  }

  setEQGain(channel: number, band: number, gain: number): void {
    this.send(this.adapter.getEQGainAddress(channel, band), [gain]);
  }

  setEQQ(channel: number, band: number, q: number): void {
    this.send(this.adapter.getEQQAddress(channel, band), [q]);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAdapter(): MixerAdapter {
    return this.adapter;
  }
}

import { BehringerX32Adapter } from './adapters/BehringerX32';
export const oscClient = new OscClient(new BehringerX32Adapter());
