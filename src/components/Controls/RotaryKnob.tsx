import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, GestureResponderEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, typography } from '../../theme/theme';

interface RotaryKnobProps {
  value: number;
  min: number;
  max: number;
  label: string;
  unit?: string;
  size?: number;
  color?: string;
  formatValue?: (value: number) => string;
  onValueChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
}

const START_ANGLE = 135;  // degrees from 12 o'clock (= 7:30 position)
const END_ANGLE = 405;    // degrees (= 4:30 position)
const SWEEP = END_ANGLE - START_ANGLE; // 270 degrees total

function valueToAngle(value: number, min: number, max: number): number {
  const normalized = (value - min) / (max - min);
  return START_ANGLE + normalized * SWEEP;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  value,
  min,
  max,
  label,
  unit = '',
  size = 52,
  color = colors.purple,
  formatValue,
  onValueChange,
  onChangeEnd,
}) => {
  const startValueRef = useRef(value);
  const startPageYRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(value);
  const pendingValueRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const sensitivity = (max - min) / 200; // Full range over 200px drag

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

  const scheduleValueChange = useCallback((nextValue: number) => {
    pendingValueRef.current = nextValue;
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingValueRef.current !== null) {
        onValueChange(pendingValueRef.current);
        pendingValueRef.current = null;
      }
    });
  }, [onValueChange]);

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
  }, [dragValue, onChangeEnd, onValueChange]);

  const handleResponderMove = (evt: GestureResponderEvent) => {
    // Vertical drag: up = increase, down = decrease
    const dy = evt.nativeEvent.pageY - startPageYRef.current;
    const delta = -dy * sensitivity;
    let newValue = startValueRef.current + delta;
    newValue = Math.max(min, Math.min(max, newValue));
    setDragValue(newValue);
    scheduleValueChange(newValue);
  };

  const svgSize = size;
  const center = svgSize / 2;
  const radius = (svgSize / 2) - 5;
  const trackWidth = 3;
  const indicatorRadius = radius - 8;

  const currentAngle = valueToAngle(value, min, max);
  const displayValue = isDragging ? dragValue : value;
  const displayAngle = valueToAngle(displayValue, min, max);
  const indicatorPos = polarToCartesian(center, center, indicatorRadius, displayAngle);

  const bgArc = describeArc(center, center, radius, START_ANGLE, END_ANGLE);
  const valueArc = describeArc(center, center, radius, START_ANGLE, displayAngle);

  const displayLabel = formatValue ? formatValue(displayValue) : displayValue.toFixed(1);

  return (
    <View
      collapsable={false}
      style={styles.container}
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
      <View style={[styles.knobShadow, { width: svgSize, height: svgSize }]}>
        <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
          {/* Background track */}
          <Path
            d={bgArc}
            fill="none"
            stroke={colors.border}
            strokeWidth={trackWidth}
            strokeLinecap="round"
          />
          {/* Value arc */}
          {currentAngle > START_ANGLE && (
            <Path
              d={valueArc}
              fill="none"
              stroke={color}
              strokeWidth={trackWidth}
              strokeLinecap="round"
            />
          )}
          {/* Center circle (knob body) */}
          <Circle
            cx={center}
            cy={center}
            r={radius - 6}
            fill={colors.surfaceElevated}
            stroke={colors.border}
            strokeWidth={1}
          />
          {/* Indicator dot */}
          <Circle
            cx={indicatorPos.x}
            cy={indicatorPos.y}
            r={2.5}
            fill={color}
          />
        </Svg>
      </View>
      <Text style={styles.value}>
        {displayLabel}{unit ? ` ${unit}` : ''}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobShadow: {
    borderRadius: 999,
  },
  value: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: typography.medium,
    marginTop: 4,
    textAlign: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginTop: 1,
    textAlign: 'center',
  },
});
