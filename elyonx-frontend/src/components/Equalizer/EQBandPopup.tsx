import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, LayoutChangeEvent, GestureResponderEvent } from 'react-native';
import { RotaryKnob } from '../Controls/RotaryKnob';
import { IconButton } from '../common/IconButton';
import { Dropdown, EQ_BAND_TYPE_OPTIONS } from '../common/Dropdown';
import { EQBand, EQBandType } from '../../store/types';
import { formatFrequency } from '../../utils/eqMath';
import { colors, radii, spacing, shadows } from '../../theme/theme';

interface EQBandPopupProps {
  band: EQBand;
  bandIndex: number;
  position: { x: number; y: number };
  bounds: { width: number; height: number };
  onPositionChange: (position: { x: number; y: number }) => void;
  onTypeChange: (type: EQBandType) => void;
  onFreqChange: (freq: number) => void;
  onGainChange: (gain: number) => void;
  onQChange: (q: number) => void;
  onToggleEnabled: () => void;
  onAddBand: () => void;
  onRemoveBand: () => void;
  onDragEnd?: () => void;
}

export const EQBandPopup: React.FC<EQBandPopupProps> = ({
  band,
  bandIndex,
  position,
  bounds,
  onPositionChange,
  onTypeChange,
  onFreqChange,
  onGainChange,
  onQChange,
  onToggleEnabled,
  onAddBand,
  onRemoveBand,
  onDragEnd,
}) => {
  const [popupSize, setPopupSize] = useState({ width: 0, height: 0 });
  const startPositionRef = useRef(position);
  const startPageRef = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(position);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDragging) {
      setDragPosition(position);
    }
  }, [position, isDragging]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const clampPosition = (x: number, y: number) => {
    const maxX = Math.max(0, bounds.width - popupSize.width);
    const maxY = Math.max(0, bounds.height - popupSize.height);
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
    };
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPopupSize({ width, height });
    onPositionChange(clampPosition(position.x, position.y));
  };

  const handleResponderMove = (evt: GestureResponderEvent) => {
    const dx = evt.nativeEvent.pageX - startPageRef.current.x;
    const dy = evt.nativeEvent.pageY - startPageRef.current.y;
    const nextPosition = clampPosition(
      startPositionRef.current.x + dx,
      startPositionRef.current.y + dy,
    );
    setDragPosition(nextPosition);
    pendingPositionRef.current = nextPosition;
    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingPositionRef.current) {
          onPositionChange(pendingPositionRef.current);
          pendingPositionRef.current = null;
        }
      });
    }
  };

  const flushDrag = useCallback(() => {
    const finalPosition = pendingPositionRef.current ?? dragPosition;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingPositionRef.current = null;
    onPositionChange(finalPosition);
    setIsDragging(false);
  }, [dragPosition, onPositionChange]);

  return (
    <View
      style={[styles.container, { left: (isDragging ? dragPosition : position).x, top: (isDragging ? dragPosition : position).y }]}
      onLayout={handleLayout}
    >
      <View
        collapsable={false}
        style={styles.dragHandle}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(evt: GestureResponderEvent) => {
          setIsDragging(true);
          startPositionRef.current = position;
          startPageRef.current = {
            x: evt.nativeEvent.pageX,
            y: evt.nativeEvent.pageY,
          };
          setDragPosition(position);
        }}
        onResponderMove={handleResponderMove}
        onResponderRelease={flushDrag}
        onResponderTerminate={flushDrag}
      >
        <View style={styles.dragIndicator} />
      </View>
      <View style={styles.content}>
        <View style={styles.typeSection}>
          <Dropdown
            options={EQ_BAND_TYPE_OPTIONS}
            selectedValue={band.type}
            onSelect={value => onTypeChange(value as EQBandType)}
            width={90}
          />
        </View>

        <View style={styles.knobsRow}>
          <RotaryKnob
            value={band.frequency}
            min={20}
            max={20000}
            label={`${formatFrequency(band.frequency)} Hz`}
            size={48}
            color={colors.purple}
            formatValue={v => formatFrequency(v)}
            onValueChange={onFreqChange}
            onChangeEnd={onDragEnd}
          />

          <RotaryKnob
            value={band.gain}
            min={-18}
            max={18}
            label={`${band.gain >= 0 ? '+' : ''}${band.gain.toFixed(1)} dB (B${bandIndex + 1})`}
            size={48}
            color={colors.purple}
            formatValue={v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`}
            onValueChange={onGainChange}
            onChangeEnd={onDragEnd}
          />

          <RotaryKnob
            value={band.q}
            min={0.1}
            max={30}
            label={band.q.toFixed(1)}
            size={48}
            color={colors.purple}
            formatValue={v => v.toFixed(1)}
            onValueChange={onQChange}
            onChangeEnd={onDragEnd}
          />
        </View>

        <View style={styles.actions}>
          <IconButton
            icon="power"
            size={16}
            color={band.enabled ? colors.purple : colors.textDim}
            onPress={onToggleEnabled}
          />
          <IconButton
            icon="plus"
            size={18}
            color={colors.textSecondary}
            onPress={onAddBand}
          />
          <IconButton
            icon="close"
            size={16}
            color={colors.textSecondary}
            onPress={onRemoveBand}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 50,
    elevation: 20,
    overflow: 'visible',
  },
  dragHandle: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
    marginBottom: 6,
  },
  dragIndicator: {
    width: 64,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
    overflow: 'visible',
  },
  typeSection: {
    marginRight: spacing.sm,
  },
  knobsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  actions: {
    flexDirection: 'column',
    gap: spacing.xs,
    marginLeft: spacing.sm,
  },
});
