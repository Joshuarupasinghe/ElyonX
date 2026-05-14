import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ToggleSwitch } from '../Controls/ToggleSwitch';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface BottomBarProps {
  aiAssistEnabled: boolean;
  onToggleAiAssist: (value: boolean) => void;
  onAnalyzeSelected: () => void;
  onStartAnalyzing: () => void;
  onResetEQ: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  aiAssistEnabled,
  onToggleAiAssist,
  onAnalyzeSelected,
  onStartAnalyzing,
  onResetEQ,
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

        {/* Start Analyzing button */}
        <TouchableOpacity
          style={styles.startAnalyzingButton}
          onPress={onStartAnalyzing}
          activeOpacity={0.7}
        >
          <Text style={styles.startAnalyzingText}>START ANALYZING</Text>
        </TouchableOpacity>

        {/* Reset button */}
        <TouchableOpacity
          style={styles.resetButton}
          onPress={onResetEQ}
          activeOpacity={0.8}
        >
          <Text style={styles.resetText}>RESET</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    height: 44,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 150,
  },
  analyzeIcon: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  analyzeText: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  spacer: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  startAnalyzingButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  startAnalyzingText: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  resetButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.purple,
  },
  resetText: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
});
