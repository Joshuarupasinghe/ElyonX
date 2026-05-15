import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import { colors, typography } from '../../theme/theme';

interface EQGainFaderProps {
  value: number;          // -150 to +30 dB
  height?: number;
  onValueChange: (db: number) => void;
  onChangeEnd?: (db: number) => void;
}

const MIN_GAIN = -150;
const MAX_GAIN = 30;
const TICKS = [30, 0, -60, -90, -120, -150];
const COMMIT_INTERVAL_MS = 24;

export const EQGainFader: React.FC<EQGainFaderProps> = ({
  value,
  height = 380,
  onValueChange,
  onChangeEnd,
}) => {
  const startValueRef = useRef(value);
  const startPageYRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(value);
  const pendingValueRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCommitTsRef = useRef(0);

  useEffect(() => {
    if (!isDragging) {
      setDragValue(value);
    }
  }, [value, isDragging]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const scheduleOnValueChange = useCallback((nextValue: number) => {
    pendingValueRef.current = nextValue;
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
      if (pendingValueRef.current !== null) {
        onValueChange(pendingValueRef.current);
        pendingValueRef.current = null;
        lastCommitTsRef.current = now;
      }
    };
    rafRef.current = requestAnimationFrame(flush);
  }, [onValueChange]);

  const dbToY = useCallback(
    (db: number) => {
      const normalized = (db - MIN_GAIN) / (MAX_GAIN - MIN_GAIN);
      return height * (1 - normalized);
    },
    [height],
  );

  const yToDb = useCallback(
    (y: number) => {
      const normalized = 1 - y / height;
      return MIN_GAIN + normalized * (MAX_GAIN - MIN_GAIN);
    },
    [height],
  );

  const flushDragValue = useCallback(() => {
    const finalValue = pendingValueRef.current ?? dragValue;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingValueRef.current = null;
    onValueChange(finalValue);
    onChangeEnd?.(finalValue);
    setIsDragging(false);
  }, [dragValue, onValueChange, onChangeEnd]);

  const handleResponderMove = useCallback((evt: GestureResponderEvent) => {
    const dy = evt.nativeEvent.pageY - startPageYRef.current;
    const currentY = dbToY(startValueRef.current) + dy;
    const clampedY = Math.max(0, Math.min(height, currentY));
    const newDb = Math.round(Math.max(MIN_GAIN, Math.min(MAX_GAIN, yToDb(clampedY))) * 10) / 10;
    setDragValue(newDb);
    scheduleOnValueChange(newDb);
  }, [dbToY, height, yToDb, scheduleOnValueChange]);

  const displayValue = isDragging ? dragValue : value;
  const thumbY = dbToY(displayValue);
  const thumbHeight = 14;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gain</Text>

      <View
        collapsable={false}
        style={[styles.trackArea, { height }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(evt: GestureResponderEvent) => {
          setIsDragging(true);
          startValueRef.current = value;
          startPageYRef.current = evt.nativeEvent.pageY;
          setDragValue(value);
        }}
        onResponderMove={handleResponderMove}
        onResponderRelease={flushDragValue}
        onResponderTerminate={flushDragValue}
      >
        {TICKS.map(tick => (
          <View
            key={tick}
            style={[
              styles.tick,
              { top: dbToY(tick) - 5 },
            ]}
          >
            <Text style={styles.tickLabel}>
              {tick >= 0 ? `+${tick}` : tick}
            </Text>
          </View>
        ))}

        <View style={[styles.track, { height }]}>
          <View
            style={[
              styles.fill,
              {
                top: Math.min(thumbY, dbToY(0)),
                height: Math.abs(thumbY - dbToY(0)),
                backgroundColor: colors.green + '40',
              },
            ]}
          />
        </View>

        <View
          style={[
            styles.thumb,
            {
              top: thumbY - thumbHeight / 2,
              width: 18,
              height: thumbHeight,
            },
          ]}
        />
      </View>

      <Text style={styles.value}>{displayValue.toFixed(1)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 50,
  },
  title: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: typography.medium,
    marginBottom: 8,
  },
  trackArea: {
    position: 'relative',
    width: 50,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  tick: {
    position: 'absolute',
    left: 0,
    height: 10,
    justifyContent: 'center',
  },
  tickLabel: {
    color: colors.textDim,
    fontSize: 7,
    textAlign: 'right',
    width: 28,
  },
  track: {
    position: 'absolute',
    right: 0,
    width: 8,
    backgroundColor: colors.bg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    right: -5,
    backgroundColor: colors.green,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.green,
    elevation: 3,
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  value: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    marginTop: 8,
  },
});
