import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import { EQBand } from '../../store/types';
import { freqToX, gainToY, xToFreq, yToGain } from '../../utils/eqMath';
import { colors, typography } from '../../theme/theme';

interface EQPointProps {
  band: EQBand;
  bandIndex: number;
  graphWidth: number;
  graphHeight: number;
  minGain?: number;
  maxGain?: number;
  color: string;
  isSelected: boolean;
  onSelect: () => void;
  onFreqChange: (freq: number) => void;
  onGainChange: (gain: number) => void;
  onDragEnd: () => void;
}

const COMMIT_INTERVAL_MS = 28;

export const EQPoint: React.FC<EQPointProps> = ({
  band,
  bandIndex,
  graphWidth,
  graphHeight,
  minGain = -18,
  maxGain = 18,
  color,
  isSelected,
  onSelect,
  onFreqChange,
  onGainChange,
  onDragEnd,
}) => {
  const startFreqRef = useRef(band.frequency);
  const startGainRef = useRef(band.gain);
  const startPageRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragFreq, setDragFreq] = useState(band.frequency);
  const [dragGain, setDragGain] = useState(band.gain);
  const pendingFreqRef = useRef<number | null>(null);
  const pendingGainRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCommitTsRef = useRef(0);

  useEffect(() => {
    if (!isDragging) {
      setDragFreq(band.frequency);
      setDragGain(band.gain);
    }
  }, [band.frequency, band.gain, isDragging]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const scheduleCommit = useCallback((nextFreq: number, nextGain: number) => {
    pendingFreqRef.current = nextFreq;
    pendingGainRef.current = nextGain;
    if (rafRef.current !== null) {
      return;
    }
    const flush = () => {
      const now = Date.now();
      if (now - lastCommitTsRef.current < COMMIT_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(flush);
        return;
      }
      rafRef.current = null;
      if (pendingFreqRef.current !== null) {
        onFreqChange(pendingFreqRef.current);
        pendingFreqRef.current = null;
      }
      if (pendingGainRef.current !== null) {
        onGainChange(pendingGainRef.current);
        pendingGainRef.current = null;
      }
      lastCommitTsRef.current = now;
    };
    rafRef.current = requestAnimationFrame(flush);
  }, [onFreqChange, onGainChange]);

  const flushDrag = useCallback(() => {
    const finalFreq = pendingFreqRef.current ?? dragFreq;
    const finalGain = pendingGainRef.current ?? dragGain;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingFreqRef.current = null;
    pendingGainRef.current = null;
    onFreqChange(finalFreq);
    onGainChange(finalGain);
    onDragEnd();
    setIsDragging(false);
  }, [dragFreq, dragGain, onDragEnd, onFreqChange, onGainChange]);

  const cx = freqToX(isDragging ? dragFreq : band.frequency, graphWidth);
  const cy = gainToY(isDragging ? dragGain : band.gain, graphHeight, minGain, maxGain);

  const handleResponderMove = (evt: GestureResponderEvent) => {
    const dx = evt.nativeEvent.pageX - startPageRef.current.x;
    const dy = evt.nativeEvent.pageY - startPageRef.current.y;

    // Map horizontal drag to frequency (log scale)
    const startX = freqToX(startFreqRef.current, graphWidth);
    const newX = Math.max(0, Math.min(graphWidth, startX + dx));
    const newFreq = xToFreq(newX, graphWidth);
    const nextFreq = Math.round(Math.max(20, Math.min(20000, newFreq)) * 10) / 10;

    // Map vertical drag to gain (linear scale)
    const startY = gainToY(startGainRef.current, graphHeight, minGain, maxGain);
    const newY = Math.max(0, Math.min(graphHeight, startY + dy));
    const newGain = yToGain(newY, graphHeight, minGain, maxGain);
    const nextGain = Math.round(Math.max(minGain, Math.min(maxGain, newGain)) * 10) / 10;

    setDragFreq(nextFreq);
    setDragGain(nextGain);
    scheduleCommit(nextFreq, nextGain);
  };

  if (!band.enabled) return null;

  const pointRadius = isSelected ? 12 : 10;

  return (
    <View
      collapsable={false}
      style={[
        styles.pointWrapper,
        {
          position: 'absolute',
          left: cx - 20,
          top: cy - 20,
          width: 40,
          height: 40,
        },
      ]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(evt: GestureResponderEvent) => {
        setIsDragging(true);
        startFreqRef.current = band.frequency;
        startGainRef.current = band.gain;
        startPageRef.current = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
        onSelect();
        setDragFreq(band.frequency);
        setDragGain(band.gain);
      }}
      onResponderMove={handleResponderMove}
      onResponderRelease={flushDrag}
      onResponderTerminate={flushDrag}
    >
      {isSelected && (
        <View
          style={[
            styles.glow,
            { backgroundColor: color + '30' },
          ]}
        />
      )}
      <View
        style={[
          styles.point,
          {
            width: pointRadius * 2,
            height: pointRadius * 2,
            borderRadius: pointRadius,
            backgroundColor: color + '40',
            borderColor: color,
          },
        ]}
      >
        <Text style={styles.pointLabel}>{bandIndex + 1}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pointWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  point: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  pointLabel: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: typography.bold,
  },
  glow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
