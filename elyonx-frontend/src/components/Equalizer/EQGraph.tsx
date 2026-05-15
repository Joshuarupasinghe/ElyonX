import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { EQCurve } from './EQCurve';
import { RTAOverlay } from './RTAOverlay';
import { EQPoint } from './EQPoint';
import { EQBandPopup } from './EQBandPopup';
import { EQGainFader } from './EQGainFader';
import { EQBand } from '../../store/types';
import { freqToX, gainToY } from '../../utils/eqMath';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface EQGraphProps {
  bands: EQBand[];
  overallGain: number;
  onBandUpdate: (bandId: number, updates: Partial<EQBand>) => void;
  onAddBand: () => void;
  onRemoveBand: (bandId: number) => void;
  onOverallGainChange: (db: number) => void;
  rtaData?: { frequencies: number[]; magnitudes_db: number[] } | null;
}

const BAND_COLORS = [
  colors.eqBand1,
  colors.eqBand2,
  colors.eqBand3,
  colors.eqBand4,
  colors.eqBand5,
];

const MIN_GAIN = -12;
const MAX_GAIN = 12;
const ESTIMATED_POPUP_WIDTH = 360;
const ESTIMATED_POPUP_HEIGHT = 170;
const FREQ_TICKS = [50, 100, 200, 300, 500, '1.0k', '2.0k', '3.0k', '5.0k', '10.0k', '20.0k'];
const FREQ_VALUES = [50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000];
const GAIN_TICKS = [12, 9, 6, 3, 0, -3, -6, -9, -12];

export const EQGraph: React.FC<EQGraphProps> = ({
  bands,
  overallGain,
  onBandUpdate,
  onAddBand,
  onRemoveBand,
  onOverallGainChange,
  rtaData,
}) => {
  const [selectedBandId, setSelectedBandId] = useState<number | null>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 600, height: 380 });
  const [popupPosition, setPopupPosition] = useState({ x: 120, y: 60 });

  const { width: graphWidth, height: graphHeight } = graphDimensions;

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setGraphDimensions({ width, height });
    }
  };

  const selectedBand = bands.find(b => b.id === selectedBandId);

  const clampPopupPosition = useCallback((x: number, y: number) => {
    const maxX = Math.max(0, graphWidth - ESTIMATED_POPUP_WIDTH);
    const maxY = Math.max(0, graphHeight - ESTIMATED_POPUP_HEIGHT);
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
    };
  }, [graphWidth, graphHeight]);

  useEffect(() => {
    setPopupPosition(current => clampPopupPosition(current.x, current.y));
  }, [graphWidth, graphHeight, clampPopupPosition]);

  const handleSelectBand = useCallback((band: EQBand) => {
    setSelectedBandId(band.id);
    const x = freqToX(band.frequency, graphWidth) - (ESTIMATED_POPUP_WIDTH / 2);
    const y = graphHeight - ESTIMATED_POPUP_HEIGHT - 12;
    setPopupPosition(clampPopupPosition(x, y));
  }, [graphWidth, graphHeight, clampPopupPosition]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AUTOMATIC EQUALIZER</Text>

      <View style={styles.graphRow}>
        <View style={styles.graphContainer}>
          <View style={styles.gainAxis}>
            {GAIN_TICKS.map(tick => (
              <Text key={tick} style={styles.gainLabel}>
                {tick >= 0 ? `+${tick}` : tick} dB
              </Text>
            ))}
          </View>

          <View style={styles.plotArea}>
            <View style={styles.svgContainer} onLayout={handleLayout}>
              <Svg width={graphWidth} height={graphHeight}>
                {GAIN_TICKS.map(tick => {
                  const y = gainToY(tick, graphHeight, MIN_GAIN, MAX_GAIN);
                  return (
                    <Line
                      key={`h-${tick}`}
                      x1={0}
                      y1={y}
                      x2={graphWidth}
                      y2={y}
                      stroke={tick === 0 ? colors.border : colors.borderSubtle}
                      strokeWidth={tick === 0 ? 1 : 0.5}
                      strokeDasharray={tick === 0 ? undefined : '4,4'}
                    />
                  );
                })}

                {FREQ_VALUES.map(freq => {
                  const x = freqToX(freq, graphWidth);
                  return (
                    <Line
                      key={`v-${freq}`}
                      x1={x}
                      y1={0}
                      x2={x}
                      y2={graphHeight}
                      stroke={colors.borderSubtle}
                      strokeWidth={0.5}
                      strokeDasharray="4,4"
                    />
                  );
                })}

                {rtaData && rtaData.frequencies.length > 0 && (
                  <RTAOverlay
                    frequencies={rtaData.frequencies}
                    magnitudes_db={rtaData.magnitudes_db}
                    graphWidth={graphWidth}
                    graphHeight={graphHeight}
                    minDb={-120}
                    maxDb={0}
                  />
                )}

                <EQCurve
                  bands={bands}
                  graphWidth={graphWidth}
                  graphHeight={graphHeight}
                  minGain={MIN_GAIN}
                  maxGain={MAX_GAIN}
                />
              </Svg>

              {bands.map((band, i) => (
                <EQPoint
                  key={band.id}
                  band={band}
                  bandIndex={i}
                  graphWidth={graphWidth}
                  graphHeight={graphHeight}
                  minGain={MIN_GAIN}
                  maxGain={MAX_GAIN}
                  color={BAND_COLORS[i % BAND_COLORS.length]}
                  isSelected={band.id === selectedBandId}
                  onSelect={() => handleSelectBand(band)}
                  onFreqChange={freq => onBandUpdate(band.id, { frequency: freq })}
                  onGainChange={gain => onBandUpdate(band.id, { gain })}
                  onDragEnd={() => { }}
                />
              ))}

              {selectedBand && (
                <EQBandPopup
                  band={selectedBand}
                  bandIndex={bands.indexOf(selectedBand)}
                  position={popupPosition}
                  bounds={{ width: graphWidth, height: graphHeight }}
                  onPositionChange={setPopupPosition}
                  onTypeChange={type => onBandUpdate(selectedBand.id, { type })}
                  onFreqChange={freq => onBandUpdate(selectedBand.id, { frequency: freq })}
                  onGainChange={gain => onBandUpdate(selectedBand.id, { gain })}
                  onQChange={q => onBandUpdate(selectedBand.id, { q })}
                  onToggleEnabled={() =>
                    onBandUpdate(selectedBand.id, { enabled: !selectedBand.enabled })
                  }
                  onAddBand={onAddBand}
                  onRemoveBand={() => {
                    onRemoveBand(selectedBand.id);
                    setSelectedBandId(null);
                  }}
                />
              )}
            </View>

            <View style={styles.freqAxis}>
              {FREQ_TICKS.map((tick, i) => (
                <Text
                  key={i}
                  style={[
                    styles.freqLabel,
                    {
                      left: Math.max(
                        0,
                        Math.min(
                          graphWidth - 32,
                          freqToX(FREQ_VALUES[i], graphWidth) - 16,
                        ),
                      ),
                    },
                  ]}
                >
                  {tick}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <EQGainFader
          value={overallGain}
          height={graphHeight}
          onValueChange={onOverallGainChange}
        />
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  title: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    padding: spacing.sm,
    paddingBottom: spacing.xs,
  },
  graphRow: {
    flexDirection: 'row',
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.md,
  },
  graphContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  gainAxis: {
    width: 42,
    justifyContent: 'space-between',
    paddingBottom: 22,
  },
  gainLabel: {
    color: colors.textDim,
    fontSize: 8,
    textAlign: 'right',
    paddingRight: spacing.xs,
  },
  plotArea: {
    flex: 1,
  },
  svgContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  freqAxis: {
    position: 'relative',
    height: 22,
    marginTop: spacing.xs,
  },
  freqLabel: {
    position: 'absolute',
    color: colors.textDim,
    fontSize: 8,
    textAlign: 'center',
    width: 32,
  },
});
