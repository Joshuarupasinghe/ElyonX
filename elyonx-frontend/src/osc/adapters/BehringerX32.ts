import { MixerAdapter } from './MixerAdapter';
import { MixerEvent } from '../../store/types';

/**
 * Behringer X32 / Midas M32 OSC adapter.
 *
 * Based on the unofficial but widely-documented X32 OSC protocol.
 * Default ports: send to 10023, receive on 10024.
 */
export class BehringerX32Adapter implements MixerAdapter {
  readonly name = 'Behringer X32 / Midas M32';
  readonly defaultSendPort = 10023;
  readonly defaultReceivePort = 10024;
  readonly subscribeIntervalMs = 8000; // X32 requires /xremote every ~10s

  private pad(ch: number): string {
    return ch.toString().padStart(2, '0');
  }

  // --- Address builders ---

  getFaderAddress(channel: number): string {
    return `/ch/${this.pad(channel)}/mix/fader`;
  }

  getMasterFaderAddress(): string {
    return '/main/st/mix/fader';
  }

  getMuteAddress(channel: number): string {
    return `/ch/${this.pad(channel)}/mix/on`;
  }

  getSoloAddress(channel: number): string {
    // X32 solo is on a different bus
    return `/-stat/solosw/${this.pad(channel)}`;
  }

  getChannelNameAddress(channel: number): string {
    return `/ch/${this.pad(channel)}/config/name`;
  }

  getEQFreqAddress(channel: number, band: number): string {
    return `/ch/${this.pad(channel)}/eq/${band}/f`;
  }

  getEQGainAddress(channel: number, band: number): string {
    return `/ch/${this.pad(channel)}/eq/${band}/g`;
  }

  getEQQAddress(channel: number, band: number): string {
    return `/ch/${this.pad(channel)}/eq/${band}/q`;
  }

  getEQTypeAddress(channel: number, band: number): string {
    return `/ch/${this.pad(channel)}/eq/${band}/type`;
  }

  getEQOnAddress(channel: number): string {
    return `/ch/${this.pad(channel)}/eq/on`;
  }

  // --- Value conversions ---

  /**
   * X32 fader position (0.0–1.0) to dB.
   * The X32 uses a specific taper curve:
   *   0.0 = -∞ (effectively -90 dB)
   *   0.75 ≈ 0 dB (unity)
   *   1.0 = +10 dB
   */
  faderToDB(oscValue: number): number {
    if (oscValue <= 0) return -90;
    if (oscValue >= 1) return 10;

    // Approximate X32 taper using known data points
    // This is a piecewise linear approximation
    const table: [number, number][] = [
      [0.0, -90],
      [0.0625, -60],
      [0.125, -50],
      [0.1875, -40],
      [0.25, -30],
      [0.375, -20],
      [0.5, -10],
      [0.625, -5],
      [0.75, 0],
      [0.875, 5],
      [1.0, 10],
    ];

    for (let i = 1; i < table.length; i++) {
      if (oscValue <= table[i][0]) {
        const [x0, y0] = table[i - 1];
        const [x1, y1] = table[i];
        const t = (oscValue - x0) / (x1 - x0);
        return y0 + t * (y1 - y0);
      }
    }
    return 10;
  }

  /**
   * dB to X32 fader position (0.0–1.0)
   */
  dbToFader(db: number): number {
    if (db <= -90) return 0;
    if (db >= 10) return 1;

    const table: [number, number][] = [
      [-90, 0.0],
      [-60, 0.0625],
      [-50, 0.125],
      [-40, 0.1875],
      [-30, 0.25],
      [-20, 0.375],
      [-10, 0.5],
      [-5, 0.625],
      [0, 0.75],
      [5, 0.875],
      [10, 1.0],
    ];

    for (let i = 1; i < table.length; i++) {
      if (db <= table[i][0]) {
        const [x0, y0] = table[i - 1];
        const [x1, y1] = table[i];
        const t = (db - x0) / (x1 - x0);
        return y0 + t * (y1 - y0);
      }
    }
    return 1;
  }

  // --- Message parsing ---

  parseMessage(address: string, args: any[]): MixerEvent {
    const value = args.length > 0 ? args[0] : 0;

    // Channel fader: /ch/XX/mix/fader
    const faderMatch = address.match(/^\/ch\/(\d+)\/mix\/fader$/);
    if (faderMatch) {
      return {
        type: 'fader',
        channel: parseInt(faderMatch[1], 10),
        value: this.faderToDB(value as number),
      };
    }

    // Master fader
    if (address === '/main/st/mix/fader') {
      return {
        type: 'fader',
        channel: 0, // 0 = master
        value: this.faderToDB(value as number),
      };
    }

    // Mute: /ch/XX/mix/on (0 = muted, 1 = unmuted — inverted!)
    const muteMatch = address.match(/^\/ch\/(\d+)\/mix\/on$/);
    if (muteMatch) {
      return {
        type: 'mute',
        channel: parseInt(muteMatch[1], 10),
        value: value === 0, // on=0 means muted
      };
    }

    // Solo
    const soloMatch = address.match(/^\/-stat\/solosw\/(\d+)$/);
    if (soloMatch) {
      return {
        type: 'solo',
        channel: parseInt(soloMatch[1], 10),
        value: value === 1,
      };
    }

    // EQ frequency
    const eqFreqMatch = address.match(/^\/ch\/(\d+)\/eq\/(\d+)\/f$/);
    if (eqFreqMatch) {
      return {
        type: 'eq_freq',
        channel: parseInt(eqFreqMatch[1], 10),
        band: parseInt(eqFreqMatch[2], 10),
        value: value as number,
      };
    }

    // EQ gain
    const eqGainMatch = address.match(/^\/ch\/(\d+)\/eq\/(\d+)\/g$/);
    if (eqGainMatch) {
      return {
        type: 'eq_gain',
        channel: parseInt(eqGainMatch[1], 10),
        band: parseInt(eqGainMatch[2], 10),
        value: value as number,
      };
    }

    // EQ Q
    const eqQMatch = address.match(/^\/ch\/(\d+)\/eq\/(\d+)\/q$/);
    if (eqQMatch) {
      return {
        type: 'eq_q',
        channel: parseInt(eqQMatch[1], 10),
        band: parseInt(eqQMatch[2], 10),
        value: value as number,
      };
    }

    // Channel name
    const nameMatch = address.match(/^\/ch\/(\d+)\/config\/name$/);
    if (nameMatch) {
      return {
        type: 'channel_name',
        channel: parseInt(nameMatch[1], 10),
        value: value as string,
      };
    }

    return { type: 'unknown', channel: 0, value };
  }

  // --- Subscription messages ---

  getSubscribeMessages(): Array<{ address: string; args: any[] }> {
    // X32 requires /xremote to keep receiving updates
    return [
      { address: '/xremote', args: [] },
    ];
  }
}
