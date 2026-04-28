import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ToggleSwitch } from '../Controls/ToggleSwitch';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface BottomBarProps {
  aiAssistEnabled: boolean;
  onToggleAiAssist: (value: boolean) => void;
  onAnalyzeSelected: () => void;
  onSnapshot: () => void;
  onFinalizeMix: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  aiAssistEnabled,
  onToggleAiAssist,
  onAnalyzeSelected,
  onSnapshot,
  onFinalizeMix,
}) => {
  return (
    <View style={styles.container}>
      {/* Analyze Selected button (left) */}
      <TouchableOpacity
        style={styles.analyzeButton}
        onPress={onAnalyzeSelected}
        activeOpacity={0.8}
      >
        <Text style={styles.analyzeIcon}>🔬</Text>
        <Text style={styles.analyzeText}>ANALYZE SELECTED</Text>
      </TouchableOpacity>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Right section */}
      <View style={styles.rightSection}>
        {/* AI Assist toggle */}
        <ToggleSwitch
          value={aiAssistEnabled}
          onToggle={onToggleAiAssist}
          label="AI ASSIST"
          showStatus={true}
        />

        {/* Snapshot button */}
        <TouchableOpacity
          style={styles.snapshotButton}
          onPress={onSnapshot}
          activeOpacity={0.7}
        >
          <Text style={styles.snapshotText}>SNAPSHOT</Text>
        </TouchableOpacity>

        {/* Finalize Mix button */}
        <TouchableOpacity
          style={styles.finalizeButton}
          onPress={onFinalizeMix}
          activeOpacity={0.8}
        >
          <Text style={styles.finalizeText}>FINALIZE MIX</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    height: 60,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 180,
  },
  analyzeIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  analyzeText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 1.5,
  },
  spacer: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  snapshotButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  snapshotText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 1.5,
  },
  finalizeButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.purple,
  },
  finalizeText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 1.5,
  },
});
