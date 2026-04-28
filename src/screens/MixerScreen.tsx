import React, { useState, useCallback } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { TopBar } from '../components/GlobalControls/TopBar';
import { BottomBar } from '../components/GlobalControls/BottomBar';
import { ChannelList } from '../components/ChannelSelection/ChannelList';
import { EQGraph } from '../components/Equalizer/EQGraph';
import { FaderBank } from '../components/FaderBank/FaderBank';
import {
  Channel,
  EQBand,
  DEFAULT_CHANNELS,
  DEFAULT_EQ_BANDS,
} from '../store/types';
import { colors } from '../theme/theme';

export const MixerScreen: React.FC = () => {
  // Channel state
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('ch-3'); // Lead Vocal
  const [masterFader, setMasterFader] = useState(-2.1);

  // UI state
  const [aiAssistEnabled, setAiAssistEnabled] = useState(true);
  const [overallEQGain, setOverallEQGain] = useState(-7.3);

  // Selected channel
  const selectedChannel = channels.find(c => c.id === selectedChannelId);

  // Channel actions
  const handleSelectChannel = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
  }, []);

  const handleToggleMute = useCallback((channelId: string) => {
    setChannels(prev =>
      prev.map(ch =>
        ch.id === channelId ? { ...ch, muted: !ch.muted } : ch,
      ),
    );
  }, []);

  const handleToggleSolo = useCallback((channelId: string) => {
    setChannels(prev =>
      prev.map(ch =>
        ch.id === channelId ? { ...ch, solo: !ch.solo } : ch,
      ),
    );
  }, []);

  const handleFaderChange = useCallback((channelId: string, db: number) => {
    setChannels(prev =>
      prev.map(ch =>
        ch.id === channelId ? { ...ch, faderValue: db } : ch,
      ),
    );
  }, []);

  const handleAddChannel = useCallback(() => {
    const newIndex = channels.length + 1;
    const newChannel: Channel = {
      id: `ch-${Date.now()}`,
      index: newIndex,
      name: `Channel ${newIndex}`,
      input: `INPUT ${newIndex.toString().padStart(2, '0')}`,
      color: colors.purple,
      faderValue: 0,
      muted: false,
      solo: false,
      eqBands: DEFAULT_EQ_BANDS.map(b => ({ ...b })),
      eqEnabled: true,
    };
    setChannels(prev => [...prev, newChannel]);
  }, [channels.length]);

  // EQ actions for selected channel
  const handleBandUpdate = useCallback(
    (bandId: number, updates: Partial<EQBand>) => {
      if (!selectedChannelId) return;
      setChannels(prev =>
        prev.map(ch => {
          if (ch.id !== selectedChannelId) return ch;
          return {
            ...ch,
            eqBands: ch.eqBands.map(band =>
              band.id === bandId ? { ...band, ...updates } : band,
            ),
          };
        }),
      );
    },
    [selectedChannelId],
  );

  const handleAddBand = useCallback(() => {
    if (!selectedChannelId) return;
    setChannels(prev =>
      prev.map(ch => {
        if (ch.id !== selectedChannelId) return ch;
        const newId = Math.max(...ch.eqBands.map(b => b.id), 0) + 1;
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
      }),
    );
  }, [selectedChannelId]);

  const handleRemoveBand = useCallback(
    (bandId: number) => {
      if (!selectedChannelId) return;
      setChannels(prev =>
        prev.map(ch => {
          if (ch.id !== selectedChannelId) return ch;
          return {
            ...ch,
            eqBands: ch.eqBands.filter(b => b.id !== bandId),
          };
        }),
      );
    },
    [selectedChannelId],
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Top bar */}
      <TopBar mixerConnected={true} mixerName="MIXER" />

      {/* Main content */}
      <View style={styles.mainContent}>
        {/* Left sidebar: Channel Selection */}
        <View style={styles.sidebar}>
          <ChannelList
            channels={channels}
            selectedChannelId={selectedChannelId}
            onSelectChannel={handleSelectChannel}
            onToggleMute={handleToggleMute}
            onAddChannel={handleAddChannel}
          />

          {/* Analyze Selected button */}
          {/* Moved to BottomBar per design */}
        </View>

        {/* Center + Right: EQ + Fader Bank */}
        <View style={styles.centerArea}>
          {/* Automatic Equalizer */}
          <View style={styles.eqSection}>
            {selectedChannel && (
              <EQGraph
                bands={selectedChannel.eqBands}
                overallGain={overallEQGain}
                onBandUpdate={handleBandUpdate}
                onAddBand={handleAddBand}
                onRemoveBand={handleRemoveBand}
                onOverallGainChange={setOverallEQGain}
              />
            )}
          </View>

          {/* Fader Bank */}
          <View style={styles.faderSection}>
            <FaderBank
              channels={channels}
              masterValue={masterFader}
              selectedChannelId={selectedChannelId}
              onFaderChange={handleFaderChange}
              onMasterChange={setMasterFader}
              onToggleMute={handleToggleMute}
              onToggleSolo={handleToggleSolo}
              onSelectChannel={handleSelectChannel}
            />
          </View>
        </View>
      </View>

      {/* Bottom bar */}
      <BottomBar
        aiAssistEnabled={aiAssistEnabled}
        onToggleAiAssist={setAiAssistEnabled}
        onAnalyzeSelected={() => console.log('Analyze selected')}
        onSnapshot={() => console.log('Snapshot')}
        onFinalizeMix={() => console.log('Finalize mix')}
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
    padding: 12,
    gap: 12,
  },
  sidebar: {
    width: 260,
    justifyContent: 'space-between',
  },
  centerArea: {
    flex: 1,
    gap: 12,
  },
  eqSection: {
    flex: 1,
    minHeight: 300,
  },
  faderSection: {
    height: 310,
  },
});
