import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { analyzeChannel, resetEQ, startCapture } from './backend';

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('backend API client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('starts capture with the selected device index', async () => {
    const payload = {
      status: 'started',
      device: {
        index: 2,
        name: 'Focusrite',
        sample_rate: 48000,
        block_size: 256,
        channels: 2,
        latency_ms: 5.33,
      },
      session_id: 'session-1',
    };
    fetchMock.mockResolvedValue(response(payload));

    await expect(startCapture(2)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/devices/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ device_index: 2 }),
      }),
    );
  });

  it('normalizes EQ recommendations from the backend', async () => {
    fetchMock.mockResolvedValue(
      response({
        instrument: 'snare',
        inference_ms: '8.7',
        bands: [
          {
            id: '7',
            type: 'not-a-filter',
            frequency: 999999,
            gain: -99,
            q: 99,
            enabled: true,
          },
        ],
        quality: {
          status: 'warning',
          warnings: ['Input level is low'],
          usable: false,
          rms_dbfs: '-70.5',
          peak_dbfs: '-52.25',
          smoothed: true,
        },
      }),
    );

    const result = await analyzeChannel('snare');

    expect(result).toEqual({
      instrument: 'snare',
      inference_ms: 8.7,
      bands: [
        {
          id: 7,
          type: 'bell',
          frequency: 20000,
          gain: -18,
          q: 30,
          enabled: true,
        },
      ],
      quality: {
        status: 'warning',
        warnings: ['Input level is low'],
        usable: false,
        rms_dbfs: -70.5,
        peak_dbfs: -52.25,
        smoothed: true,
      },
    });
  });

  it('surfaces backend error details', async () => {
    fetchMock.mockResolvedValue(response({ detail: 'no stream' }, false, 400));

    await expect(resetEQ()).rejects.toThrow(
      'Reset EQ failed (400): {"detail":"no stream"}',
    );
  });
});
