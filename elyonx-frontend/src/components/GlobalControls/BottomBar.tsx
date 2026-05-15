import React from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ToggleSwitch } from '../Controls/ToggleSwitch';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface BottomBarProps {
  aiAssistEnabled: boolean;
  isAnalyzing: boolean;
  onToggleAiAssist: (value: boolean) => void;
  onStartAnalyzing: () => void;
  onResetEQ: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  aiAssistEnabled,
  isAnalyzing,
  onToggleAiAssist,
  onStartAnalyzing,
  onResetEQ,
}) => {
  const startAnalyzingDisabled = !aiAssistEnabled || isAnalyzing;

  return (
    <View style={styles.container}>
      <View style={styles.spacer} />

      <View style={styles.rightSection}>
        <ToggleSwitch
          value={aiAssistEnabled}
          onToggle={onToggleAiAssist}
          label="AI ASSIST"
          showStatus={true}
        />

        <TouchableOpacity
          style={[
            styles.startAnalyzingButton,
            !aiAssistEnabled && styles.startAnalyzingButtonDisabled,
            isAnalyzing && styles.startAnalyzingButtonLoading,
          ]}
          onPress={onStartAnalyzing}
          disabled={startAnalyzingDisabled}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{
            disabled: startAnalyzingDisabled,
            busy: isAnalyzing,
          }}
        >
          {isAnalyzing && (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          )}
          <Text
            style={[
              styles.startAnalyzingText,
              !aiAssistEnabled && styles.startAnalyzingTextDisabled,
              isAnalyzing && styles.startAnalyzingTextLoading,
            ]}
          >
            {isAnalyzing ? 'ANALYZING' : 'START ANALYZING'}
          </Text>
        </TouchableOpacity>

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
  spacer: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  startAnalyzingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.green,
    backgroundColor: colors.greenDim,
    minWidth: 150,
  },
  startAnalyzingButtonDisabled: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    opacity: 0.55,
  },
  startAnalyzingButtonLoading: {
    borderColor: colors.cyan,
    backgroundColor: colors.purpleBg,
  },
  startAnalyzingText: {
    color: colors.textPrimary,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  startAnalyzingTextDisabled: {
    color: colors.textMuted,
  },
  startAnalyzingTextLoading: {
    color: colors.textPrimary,
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
