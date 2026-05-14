import React, { useRef, useCallback, useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import { colors, typography } from '../../theme/theme';

interface VerticalFaderProps {
  value: number;         // in dB
  min?: number;          // default -60
  max?: number;          // default +6
  height?: number;       // track height in px (used as fallback if container doesn't flex)
  width?: number;        // track width in px
  showValue?: boolean;
  color?: string;
  label?: string;
  fillContainer?: boolean; // if true, measure parent and fill it
  onValueChange: (db: number) => void;
  onChangeEnd?: (db: number) => void;
}

const COMMIT_INTERVAL_MS = 24;

/**
 * Get gradient color for a fader position
 * Green (top) → Yellow → Orange → Red (bottom = hot signal)
 */
function getFaderColor(db: number): string {
  if (db > 0) return colors.faderRed;
  if (db > -6) return colors.faderOrange;
  if (db > -12) return colors.faderYellow;
  return colors.faderGreen;
}

export const VerticalFader: React.FC<VerticalFaderProps> = ({
  value,
  min = -60,
  max = 6,
  height: heightProp = 180,
  width = 8,
  showValue = true,
  color,
  label,
  fillContainer = false,
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

  // Dynamic height: if fillContainer, measure parent and fill it; else use height prop
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const thumbHeight = 16;
  const valueDisplayHeight = showValue ? 18 : 0;
  const labelDisplayHeight = label ? 20 : 0;
  const overhead = thumbHeight + valueDisplayHeight + labelDisplayHeight + 4;

  const height = fillContainer && measuredHeight > 0
    ? Math.max(40, measuredHeight - overhead)
    : heightProp;

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
      // Map dB to pixel position (top = max, bottom = min)
      const normalized = (db - min) / (max - min);
      return height * (1 - normalized);
    },
    [min, max, height],
  );

  const yToDb = useCallback(
    (y: number) => {
      const normalized = 1 - y / height;
      return min + normalized * (max - min);
    },
    [min, max, height],
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
    const newDb = Math.round(yToDb(clampedY) * 10) / 10;
    setDragValue(newDb);
    scheduleOnValueChange(newDb);
  }, [dbToY, height, yToDb, scheduleOnValueChange]);

  const displayValue = isDragging ? dragValue : value;
  const thumbY = dbToY(displayValue);
  const thumbWidth = width + 14;
  const thumbColor = color ?? getFaderColor(value);

  const TICK_LABEL_WIDTH = 28;
  const TICK_GAP = 6;
  const TICK_LINE_WIDTH = 4;

  // dB tick marks
  const ticks = useMemo(() => {
    const result: { db: number; y: number }[] = [];
    for (let db = max; db >= min; db -= 6) {
      if (db <= min) db = min;
      result.push({ db, y: dbToY(db) });
      if (db === min) break;
    }
    return result;
  }, [min, max, dbToY]);

  const handleContainerLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    if (fillContainer) {
      setMeasuredHeight(e.nativeEvent.layout.height);
    }
  }, [fillContainer]);

  return (
    <View
      collapsable={false}
      style={[styles.container, fillContainer ? styles.containerFill : { height: height + overhead }]}
      onLayout={handleContainerLayout}
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
      {/* dB value display */}
      {showValue && (
        <Text style={[styles.dbValue, { color: thumbColor }]}>
          {displayValue > min ? displayValue.toFixed(1) : '-∞'}
        </Text>
      )}

      {/* Fader row: track on left, scale labels on right */}
      <View style={[styles.faderRow, { height }]}>
        {/* Track + thumb area */}
        <View style={[styles.trackArea, { height, width: thumbWidth }]}>
          {/* Track background */}
          <View
            style={[
              styles.track,
              {
                height,
                width,
                left: (thumbWidth - width) / 2,
              },
            ]}
          >
            {/* Filled portion */}
            <View
              style={[
                styles.trackFill,
                {
                  height: height - thumbY,
                  bottom: 0,
                  backgroundColor: thumbColor,
                },
              ]}
            />
          </View>

          {/* Thumb */}
          <View
            style={[
              styles.thumb,
              {
                top: thumbY - thumbHeight / 2,
                left: (thumbWidth - thumbWidth) / 2,
                width: thumbWidth,
                height: thumbHeight,
                backgroundColor: colors.surfaceElevated,
                borderColor: thumbColor,
              },
            ]}
          >
            <View style={[styles.thumbLine, { backgroundColor: thumbColor }]} />
          </View>
        </View>

        {/* Scale: tick lines + labels to the right */}
        <View style={[styles.scaleArea, { height, marginLeft: TICK_GAP }]}>
          {ticks.map(tick => (
            <View
              key={tick.db}
              style={[styles.tickRow, { top: tick.y - 5 }]}
            >
              <View style={[styles.tickLine, { width: TICK_LINE_WIDTH, backgroundColor: tick.db === 0 ? colors.textMuted : colors.border }]} />
              <Text style={[styles.tickLabel, { width: TICK_LABEL_WIDTH }]}>
                {tick.db > min ? tick.db : '-∞'}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  containerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  dbValue: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    marginBottom: 4,
    textAlign: 'center',
    minWidth: 36,
  },
  faderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  trackArea: {
    position: 'relative',
  },
  track: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 3,
    opacity: 0.6,
  },
  scaleArea: {
    position: 'relative',
  },
  tickRow: {
    position: 'absolute',
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 10,
  },
  tickLine: {
    height: 1,
    marginRight: 3,
  },
  tickLabel: {
    color: colors.textMuted,
    fontSize: 9,
    textAlign: 'left',
  },
  thumb: {
    position: 'absolute',
    borderRadius: 3,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  thumbLine: {
    width: '60%',
    height: 2,
    borderRadius: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginTop: 6,
    textAlign: 'center',
  },
});
