import { MixerAdapter } from './adapters/MixerAdapter';
import { MixerEvent } from '../store/types';

type MessageHandler = (event: MixerEvent) => void;

/**
 * OSC Client for bidirectional communication with digital mixers.
 *
 * Architecture:
 *   App  ──UDP──▶  Mixer (sendPort, default 10023)
 *   App  ◀──UDP──  Mixer (receivePort, default 10024)
 *
 * Uses osc.js for message encoding/decoding and react-native-udp for transport.
 * Falls back to a mock/no-op mode when UDP is unavailable (e.g., during development).
 */
export class OscClient {
  private adapter: MixerAdapter;
  private host: string = '192.168.1.1';
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

  /**
   * Connect to the mixer.
   * In a real implementation, this opens UDP sockets via react-native-udp.
   * Currently implemented as a mock for UI development.
   */
  async connect(host: string, sendPort?: number, receivePort?: number): Promise<void> {
    this.host = host;
    this.sendPort = sendPort ?? this.adapter.defaultSendPort;
    this.receivePort = receivePort ?? this.adapter.defaultReceivePort;

    try {
      // TODO: Initialize react-native-udp socket here
      // const dgram = require('react-native-udp');
      // this.socket = dgram.createSocket({ type: 'udp4' });
      // this.socket.bind(this.receivePort);
      // this.socket.on('message', this.handleIncoming);

      this.connected = true;

      // Start subscription heartbeat (X32 requires /xremote every ~10s)
      this.startSubscription();

      console.log(`[OSC] Connected to ${this.host}:${this.sendPort}`);
    } catch (error) {
      console.warn('[OSC] Failed to connect:', error);
      this.connected = false;
    }
  }

  /**
   * Disconnect from the mixer
   */
  disconnect(): void {
    if (this.subscribeTimer) {
      clearInterval(this.subscribeTimer);
      this.subscribeTimer = null;
    }
    this.connected = false;
    console.log('[OSC] Disconnected');
  }

  /**
   * Send an OSC message to the mixer
   */
  send(address: string, args: any[] = []): void {
    if (!this.connected) {
      console.warn('[OSC] Not connected, cannot send:', address);
      return;
    }

    try {
      // TODO: Encode and send via UDP
      // const osc = require('osc');
      // const message = osc.writeMessage({ address, args: args.map(a => ({ type: 'f', value: a })) });
      // this.socket.send(message, 0, message.length, this.sendPort, this.host);

      console.log(`[OSC] → ${address}`, args);
    } catch (error) {
      console.warn('[OSC] Send error:', error);
    }
  }

  /**
   * Register a handler for incoming mixer events
   */
  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  /**
   * Process incoming raw OSC data (called by UDP socket listener)
   */
  private handleIncoming = (_data: Buffer): void => {
    try {
      // TODO: Decode with osc.js
      // const osc = require('osc');
      // const msg = osc.readMessage(data);
      // const event = this.adapter.parseMessage(msg.address, msg.args.map(a => a.value));
      // this.handlers.forEach(h => h(event));
    } catch (error) {
      console.warn('[OSC] Parse error:', error);
    }
  };

  /**
   * Start sending subscription/heartbeat messages to keep receiving updates
   */
  private startSubscription(): void {
    const messages = this.adapter.getSubscribeMessages();
    if (messages.length === 0) return;

    // Send immediately
    messages.forEach(m => this.send(m.address, m.args));

    // Then on interval
    this.subscribeTimer = setInterval(() => {
      messages.forEach(m => this.send(m.address, m.args));
    }, this.adapter.subscribeIntervalMs);
  }

  // --- Convenience methods ---

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

// Singleton instance with Behringer X32 adapter as default
import { BehringerX32Adapter } from './adapters/BehringerX32';
export const oscClient = new OscClient(new BehringerX32Adapter());
