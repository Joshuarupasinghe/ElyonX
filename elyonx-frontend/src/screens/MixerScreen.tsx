import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Alert } from 'react-native';
import { TopBar } from '../components/GlobalControls/TopBar';
import { BottomBar } from '../components/GlobalControls/BottomBar';
import { ChannelList } from '../components/ChannelSelection/ChannelList';
import { AddChannelModal } from '../components/ChannelSelection/AddChannelModal';
import { EQGraph } from '../components/Equalizer/EQGraph';
import { FaderBank } from '../components/FaderBank/FaderBank';
import { SettingsPage } from './SettingsPage';
import { Channel, EQBand, EQRecommendation } from '../store/types';
import { useRTATelemetry } from '../hooks/UseRTATelemetry';
import type { AuthUser } from '../auth';
import {
  MixerStatus,
  startCapture,
  stopCapture,
  analyzeChannel,
  resetEQ,
  fetchMixerStatus,
  registerMixerChannel,
  setMixerChannelEQBand,
  setMixerChannelFader,
  setMixerChannelGain,
  setMixerChannelMute,
  setMixerChannelSolo,
  setMixerMasterFader,
} from '../api/backend';
import { colors } from '../theme/theme';

interface MixerScreenProps {
  currentUser?: AuthUser | null;
  onViewAccount?: () => void;
  onLogout?: () => void;
}

const ANALYZE_POLL_INTERVAL_MS = 350;
const ANALYZE_MAX_ATTEMPTS = 24;
const STABLE_REQUIRED_CONSECUTIVE = 3;
const STABLE_GAIN_DELTA_DB = 0.25;
const STABLE_FREQ_DELTA_HZ = 10;
const STABLE_Q_DELTA = 0.08;

type AnalysisNotice = {
  level: 'warning' | 'error';
  title: string;
  messages: string[];
  meta?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDbfs(value: number | null | undefined): string {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)} dBFS` : '--';
}

function noticeFromRecommendation(
  recommendation: EQRecommendation
): AnalysisNotice | null {
  const { quality } = recommendation;
  if (!quality || quality.status === 'ok') {
    return null;
  }

  const messages =
    quality.warnings.length > 0
      ? quality.warnings
      : [
          'Analysis returned a warning. Check the RTA input before applying EQ.',
        ];

  return {
    level: quality.status === 'error' ? 'error' : 'warning',
    title: quality.usable ? 'ANALYSIS WARNING' : 'INPUT TOO LOW',
    messages,
    meta: `RMS ${formatDbfs(quality.rms_dbfs)}  PEAK ${formatDbfs(
      quality.peak_dbfs
    )}`,
  };
}

function errorNotice(message: string): AnalysisNotice {
  return {
    level: 'error',
    title: 'ANALYSIS ERROR',
    messages: [message],
  };
}

function areBandArraysStable(
  prevBands: EQBand[],
  nextBands: EQBand[]
): boolean {
  if (prevBands.length !== nextBands.length) {
    return false;
  }

  const prevSorted = [...prevBands].sort((a, b) => a.id - b.id);
  const nextSorted = [...nextBands].sort((a, b) => a.id - b.id);

  for (let i = 0; i < prevSorted.length; i++) {
    const prev = prevSorted[i];
    const next = nextSorted[i];

    if (prev.type !== next.type || prev.enabled !== next.enabled) {
      return false;
    }

    if (Math.abs(prev.gain - next.gain) > STABLE_GAIN_DELTA_DB) {
      return false;
    }

    if (Math.abs(prev.frequency - next.frequency) > STABLE_FREQ_DELTA_HZ) {
      return false;
    }

    if (Math.abs(prev.q - next.q) > STABLE_Q_DELTA) {
      return false;
    }
  }

  return true;
}

function applyRecommendationToChannel(
  channel: Channel,
  recommendation: EQRecommendation
): Channel {
  // The model outputs authoritative EQ values; replace channel bands directly.
  const recommendedBands = [...recommendation.bands]
    .sort((a, b) => a.id - b.id)
    .map((band, index) => ({
      ...band,
      id: index + 1,
    }));

  return {
    ...channel,
    eqBands: recommendedBands,
    eqEnabled: recommendedBands.some((band) => band.enabled),
  };
}

export const MixerScreen: React.FC<MixerScreenProps> = ({
  currentUser,
  onViewAccount,
  onLogout,
}) => {
  // Channel state — starts empty, user adds channels via modal
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [masterFader, setMasterFader] = useState(0);

  // Add channel modal
  const [showAddChannel, setShowAddChannel] = useState(false);

  // UI state
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [_aiAssistLoading, setAiAssistLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overallEQGain, setOverallEQGain] = useState(0);
  const [analysisNotice, setAnalysisNotice] = useState<AnalysisNotice | null>(
    null
  );
  const [showSettings, setShowSettings] = useState(false);
  const [mixerStatus, setMixerStatus] = useState<MixerStatus | null>(null);

  // Live RTA telemetry from the backend WebSocket
  const { rta, connected, streamOnline } = useRTATelemetry();

  // Selected channel
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  const refreshMixerStatus = useCallback(async () => {
    try {
      const status = await fetchMixerStatus();
      setMixerStatus(status);
    } catch (err) {
      console.warn('[ElyonX] Mixer status unavailable:', err);
      setMixerStatus((prev) =>
        prev
          ? { ...prev, connected: false, state: 'error', error: String(err) }
          : prev
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const status = await fetchMixerStatus();
        if (!cancelled) {
          setMixerStatus(status);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[ElyonX] Mixer status poll failed:', err);
        }
      }
    };

    poll();
    const intervalId = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const sendMixerCommand = useCallback(
    async (operation: () => Promise<unknown>) => {
      if (!mixerStatus?.connected) {
        return;
      }

      try {
        await operation();
      } catch (err) {
        console.warn('[ElyonX] Mixer command failed:', err);
        await refreshMixerStatus();
      }
    },
    [mixerStatus?.connected, refreshMixerStatus]
  );

  const pushEQBandsToMixer = useCallback(
    (channelIndex: number, bands: EQBand[]) => {
      void sendMixerCommand(async () => {
        for (const band of bands.slice(0, 4)) {
          await setMixerChannelEQBand(channelIndex, {
            band: band.id,
            type: band.type,
            frequency: band.frequency,
            gain: band.gain,
            q: band.q,
            enabled: band.enabled,
          });
        }
      });
    },
    [sendMixerCommand]
  );

  // Channel actions
  const handleSelectChannel = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
    setAnalysisNotice(null);
  }, []);

  const handleToggleMute = useCallback((channelId: string) => {
    const target = channels.find((channel) => channel.id === channelId);
    const nextMuted = !(target?.muted ?? false);
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, muted: !ch.muted } : ch))
    );
    if (target) {
      void sendMixerCommand(() => setMixerChannelMute(target.index, nextMuted));
    }
  }, [channels, sendMixerCommand]);

  const handleToggleSolo = useCallback((channelId: string) => {
    const target = channels.find((channel) => channel.id === channelId);
    const nextSolo = !(target?.solo ?? false);
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, solo: !ch.solo } : ch))
    );
    if (target) {
      void sendMixerCommand(() => setMixerChannelSolo(target.index, nextSolo));
    }
  }, [channels, sendMixerCommand]);

  const handleFaderChange = useCallback((channelId: string, db: number) => {
    const target = channels.find((channel) => channel.id === channelId);
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, faderValue: db } : ch))
    );
    if (target) {
      void sendMixerCommand(() => setMixerChannelFader(target.index, db));
    }
  }, [channels, sendMixerCommand]);

  const handleAddChannel = useCallback((channel: Channel) => {
    setChannels((prev) => [...prev, channel]);
    // Auto-select the newly added channel
    setSelectedChannelId(channel.id);
    setAnalysisNotice(null);
    void registerMixerChannel({
      channel: channel.index,
      name: channel.name,
      instrument: channel.instrument,
      input_source: channel.index,
    })
      .then(setMixerStatus)
      .catch(async (err) => {
        console.warn('[ElyonX] Mixer channel registration failed:', err);
        await refreshMixerStatus();
      });
  }, [refreshMixerStatus]);

  const handleRemoveChannel = useCallback((channelId: string) => {
    const nextChannels = channels.filter((channel) => channel.id !== channelId);

    if (nextChannels.length === channels.length) {
      return;
    }

    setChannels(nextChannels);

    if (selectedChannelId === channelId) {
      setSelectedChannelId(nextChannels[0]?.id ?? null);
      setAnalysisNotice(null);
      setOverallEQGain(0);
    }
  }, [channels, selectedChannelId]);

  const handleMasterFaderChange = useCallback((db: number) => {
    setMasterFader(db);
    void sendMixerCommand(() => setMixerMasterFader(db));
  }, [sendMixerCommand]);

  const handleOverallGainChange = useCallback((db: number) => {
    setOverallEQGain(db);
    if (!selectedChannel) {
      return;
    }
    const trimDb = Math.max(-18, Math.min(18, db));
    void sendMixerCommand(() =>
      setMixerChannelGain(selectedChannel.index, trimDb, 'trim')
    );
  }, [selectedChannel, sendMixerCommand]);

  // EQ actions for selected channel
  const handleBandUpdate = useCallback(
    (bandId: number, updates: Partial<EQBand>) => {
      if (!selectedChannelId) return;
      const mixerChannel = selectedChannel;
      const currentBand = mixerChannel?.eqBands.find((band) => band.id === bandId);
      const nextBand = currentBand ? { ...currentBand, ...updates } : null;
      setChannels((prev) =>
        prev.map((ch) => {
          if (ch.id !== selectedChannelId) return ch;
          return {
            ...ch,
            eqBands: ch.eqBands.map((band) =>
              band.id === bandId ? { ...band, ...updates } : band
            ),
          };
        })
      );
      if (mixerChannel && nextBand && nextBand.id <= 4) {
        void sendMixerCommand(() =>
          setMixerChannelEQBand(mixerChannel.index, {
            band: nextBand.id,
            type: nextBand.type,
            frequency: nextBand.frequency,
            gain: nextBand.gain,
            q: nextBand.q,
            enabled: nextBand.enabled,
          })
        );
      }
    },
    [selectedChannelId, selectedChannel, sendMixerCommand]
  );

  const handleAddBand = useCallback(() => {
    if (!selectedChannelId) return;
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== selectedChannelId) return ch;
        const newId = Math.max(...ch.eqBands.map((b) => b.id), 0) + 1;
        return {
          ...ch,
          eqBands: [
            ...ch.eqBands,
            {
              id: newId,
              type: 'bell' as const,
              frequency: 1000,
              gain: 0,
              q: 1.0,
              enabled: true,
            },
          ],
        };
      })
    );
  }, [selectedChannelId]);

  const handleRemoveBand = useCallback(
    (bandId: number) => {
      if (!selectedChannelId) return;
      const mixerChannel = selectedChannel;
      setChannels((prev) =>
        prev.map((ch) => {
          if (ch.id !== selectedChannelId) return ch;
          return {
            ...ch,
            eqBands: ch.eqBands.filter((b) => b.id !== bandId),
          };
        })
      );
      if (mixerChannel && bandId <= 4) {
        void sendMixerCommand(() =>
          setMixerChannelEQBand(mixerChannel.index, {
            band: bandId,
            gain: 0,
            enabled: false,
          })
        );
      }
    },
    [selectedChannelId, selectedChannel, sendMixerCommand]
  );

  // AI Assist toggle → start / stop audio capture on the backend
  const handleToggleAiAssist = useCallback(async (enabled: boolean) => {
    setAiAssistLoading(true);
    try {
      if (enabled) {
        await startCapture();
      } else {
        await stopCapture();
        setAnalysisNotice(null);
      }
      setAiAssistEnabled(enabled);
    } catch (err) {
      console.error('[ElyonX] AI Assist toggle failed:', err);
      setAnalysisNotice(
        errorNotice(
          'AI Assist could not start. Check the backend and audio device.'
        )
      );
      // Revert — keep the switch in its previous state
    } finally {
      setAiAssistLoading(false);
    }
  }, []);

  const runAnalyzeUntilStable = useCallback(
    async (
      instrument: Channel['instrument'],
      shouldCancel?: () => boolean
    ): Promise<EQRecommendation | null> => {
      let previous: EQRecommendation | null = null;
      let stableCount = 0;

      for (let attempt = 0; attempt < ANALYZE_MAX_ATTEMPTS; attempt++) {
        if (shouldCancel?.()) {
          return null;
        }

        const response: EQRecommendation = await analyzeChannel(instrument);
        if (response.quality && !response.quality.usable) {
          return response;
        }

        if (previous && areBandArraysStable(previous.bands, response.bands)) {
          stableCount += 1;
        } else {
          stableCount = 0;
        }

        previous = response;

        if (stableCount >= STABLE_REQUIRED_CONSECUTIVE) {
          return response;
        }

        if (attempt < ANALYZE_MAX_ATTEMPTS - 1) {
          await sleep(ANALYZE_POLL_INTERVAL_MS);
        }
      }

      return previous;
    },
    []
  );

  // Run IMS analysis for the current channel.
  const runSelectedChannelAnalysis = useCallback(async () => {
    if (!selectedChannel) {
      Alert.alert('No channel selected', 'Please select a channel to analyze.');
      return;
    }

    if (!aiAssistEnabled) {
      Alert.alert(
        'AI Assist off',
        'Turn on AI ASSIST before starting analysis.'
      );
      return;
    }

    if (!streamOnline) {
      Alert.alert(
        'Stream offline',
        'Please enable AI ASSIST to capture audio before analyzing.'
      );
      return;
    }

    if (isAnalyzing) {
      return;
    }

    try {
      setIsAnalyzing(true);
      console.log(
        `[ElyonX] Requesting analysis for ${selectedChannel.instrument}...`
      );
      const response = await runAnalyzeUntilStable(selectedChannel.instrument);

      if (!response) {
        Alert.alert(
          'Analysis Cancelled',
          'The analysis was interrupted before stable values were reached.'
        );
        return;
      }

      setAnalysisNotice(noticeFromRecommendation(response));

      setChannels((prev) =>
        prev.map((ch) => {
          if (ch.id !== selectedChannel.id) return ch;
          return applyRecommendationToChannel(ch, response);
        })
      );
      pushEQBandsToMixer(selectedChannel.index, response.bands);
    } catch (err) {
      console.error('[ElyonX] Analysis failed:', err);
      setAnalysisNotice(
        errorNotice('Failed to analyze channel. Please check the backend.')
      );
      Alert.alert(
        'Analysis Error',
        'Failed to analyze channel. Please check the backend.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    selectedChannel,
    aiAssistEnabled,
    streamOnline,
    isAnalyzing,
    runAnalyzeUntilStable,
    pushEQBandsToMixer,
  ]);

  // Start Analyzing runs analysis only after AI Assist capture is ready.
  const handleStartAnalyzing = useCallback(async () => {
    if (!aiAssistEnabled) {
      Alert.alert(
        'AI Assist off',
        'Turn on AI ASSIST before starting analysis.'
      );
      return;
    }

    await runSelectedChannelAnalysis();
  }, [aiAssistEnabled, runSelectedChannelAnalysis]);

  // Reset EQ — clears all bands and disables EQ for selected channel
  const handleResetEQ = useCallback(async () => {
    if (!selectedChannel) {
      Alert.alert('No channel selected', 'Please select a channel to reset.');
      return;
    }

    try {
      console.log(`[ElyonX] Resetting EQ for ${selectedChannel.name}...`);

      // Call backend reset endpoint
      await resetEQ();
      setAnalysisNotice(null);

      // Update frontend state
      setChannels((prev) =>
        prev.map((ch) => {
          if (ch.id !== selectedChannel.id) return ch;
          return {
            ...ch,
            eqBands: [], // Clear all bands
            eqEnabled: false, // Disable EQ
          };
        })
      );
      void sendMixerCommand(async () => {
        for (const band of selectedChannel.eqBands.slice(0, 4)) {
          await setMixerChannelEQBand(selectedChannel.index, {
            band: band.id,
            gain: 0,
            enabled: false,
          });
        }
      });

      console.log(`[ElyonX] EQ reset completed for ${selectedChannel.name}`);
    } catch (err) {
      console.error('[ElyonX] Failed to reset EQ:', err);
      setAnalysisNotice(errorNotice('Failed to reset EQ. Please try again.'));
      Alert.alert('Reset Error', 'Failed to reset EQ. Please try again.');
    }
  }, [selectedChannel, sendMixerCommand]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Top bar — with live RTA connection status */}
      <TopBar
        mixerConnected={Boolean(mixerStatus?.connected)}
        mixerName={mixerStatus?.mixer_name || mixerStatus?.model || 'X32'}
        rtaConnected={connected}
        rtaStreamOnline={streamOnline}
        onSettingsPress={() => setShowSettings((open) => !open)}
        settingsActive={showSettings}
        user={currentUser}
        onViewAccount={onViewAccount}
        onLogout={onLogout}
      />

      {/* Main content */}
      <View style={styles.mainContent}>
        {showSettings ? (
          <SettingsPage
            onClose={() => setShowSettings(false)}
            onMixerStatusChange={setMixerStatus}
          />
        ) : (
          <>
            {/* Left sidebar: Channel Selection */}
            <View style={styles.sidebar}>
              <ChannelList
                channels={channels}
                selectedChannelId={selectedChannelId}
                onSelectChannel={handleSelectChannel}
                onToggleMute={handleToggleMute}
                onRemoveChannel={handleRemoveChannel}
                onAddChannel={() => setShowAddChannel(true)}
              />
            </View>

            {/* Center + Right: EQ + Fader Bank */}
            <View style={styles.centerArea}>
              {analysisNotice && (
                <View
                  style={[
                    styles.analysisNotice,
                    analysisNotice.level === 'error' &&
                      styles.analysisNoticeError,
                  ]}
                >
                  <View style={styles.analysisNoticeHeader}>
                    <Text style={styles.analysisNoticeTitle}>
                      {analysisNotice.title}
                    </Text>
                    {analysisNotice.meta && (
                      <Text style={styles.analysisNoticeMeta}>
                        {analysisNotice.meta}
                      </Text>
                    )}
                  </View>
                  {analysisNotice.messages.map((message, index) => (
                    <Text
                      key={`${message}-${index}`}
                      style={styles.analysisNoticeText}
                    >
                      {message}
                    </Text>
                  ))}
                </View>
              )}

              {/* Automatic Equalizer — always show with RTA overlay */}
              <View style={styles.eqSection}>
                <EQGraph
                  bands={selectedChannel?.eqBands ?? []}
                  overallGain={overallEQGain}
                  onBandUpdate={handleBandUpdate}
                  onAddBand={handleAddBand}
                  onRemoveBand={handleRemoveBand}
                  onOverallGainChange={handleOverallGainChange}
                  rtaData={rta}
                />
              </View>

              {/* Fader Bank */}
              <View style={styles.faderSection}>
                <FaderBank
                  channels={channels}
                  masterValue={masterFader}
                  selectedChannelId={selectedChannelId}
                  onFaderChange={handleFaderChange}
                  onMasterChange={handleMasterFaderChange}
                  onToggleMute={handleToggleMute}
                  onToggleSolo={handleToggleSolo}
                  onSelectChannel={handleSelectChannel}
                />
              </View>
            </View>
          </>
        )}
      </View>

      {/* Bottom bar */}
      {!showSettings && (
        <BottomBar
          aiAssistEnabled={aiAssistEnabled}
          isAnalyzing={isAnalyzing}
          onToggleAiAssist={handleToggleAiAssist}
          onStartAnalyzing={handleStartAnalyzing}
          onResetEQ={handleResetEQ}
        />
      )}

      {/* Add Channel Modal */}
      <AddChannelModal
        visible={showAddChannel}
        onClose={() => setShowAddChannel(false)}
        onAddChannel={handleAddChannel}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  sidebar: {
    width: 200,
    justifyContent: 'space-between',
  },
  centerArea: {
    flex: 1,
    gap: 8,
  },
  analysisNotice: {
    borderWidth: 1,
    borderColor: colors.orange,
    backgroundColor: colors.orangeDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  analysisNoticeError: {
    borderColor: colors.red,
    backgroundColor: colors.redDim,
  },
  analysisNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  analysisNoticeTitle: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  analysisNoticeMeta: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  analysisNoticeText: {
    color: colors.textPrimary,
    fontSize: 11,
    lineHeight: 15,
  },
  eqSection: {
    flex: 3,
    minHeight: 160,
  },
  faderSection: {
    flex: 2,
    minHeight: 180,
    maxHeight: 300,
  },
});
