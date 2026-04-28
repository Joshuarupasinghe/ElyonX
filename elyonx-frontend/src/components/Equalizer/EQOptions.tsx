import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Checkbox } from '../common/Checkbox';
import { spacing } from '../../theme/theme';

interface EQOptionsProps {
  logScaleFreq: boolean;
  showGrid: boolean;
  showPhase: boolean;
  compactMode: boolean;
  onToggleLogScale: (v: boolean) => void;
  onToggleGrid: (v: boolean) => void;
  onTogglePhase: (v: boolean) => void;
  onToggleCompact: (v: boolean) => void;
}

export const EQOptions: React.FC<EQOptionsProps> = ({
  logScaleFreq,
  showGrid,
  showPhase,
  compactMode,
  onToggleLogScale,
  onToggleGrid,
  onTogglePhase,
  onToggleCompact,
}) => {
  return (
    <View style={styles.container}>
      <Checkbox
        label="Log-scale automated freq."
        checked={logScaleFreq}
        onToggle={onToggleLogScale}
      />
      <Checkbox
        label="Show grid"
        checked={showGrid}
        onToggle={onToggleGrid}
      />
      <Checkbox
        label="Show phase"
        checked={showPhase}
        onToggle={onTogglePhase}
      />
      <Checkbox
        label="Compact mode"
        checked={compactMode}
        onToggle={onToggleCompact}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexWrap: 'wrap',
  },
});
