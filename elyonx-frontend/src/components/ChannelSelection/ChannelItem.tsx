import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Channel } from '../../store/types';
import { IconButton } from '../common/IconButton';
import { colors, typography, radii, spacing } from '../../theme/theme';

interface ChannelItemProps {
  channel: Channel;
  isSelected: boolean;
  onSelect: () => void;
  onToggleMute: () => void;
}

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  isSelected,
  onSelect,
  onToggleMute,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        isSelected && styles.containerSelected,
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {/* Color indicator bar */}
      <View style={[styles.colorBar, { backgroundColor: channel.color }]} />

      <View style={styles.info}>
        <Text
          style={[
            styles.name,
            isSelected && styles.nameSelected,
          ]}
        >
          {channel.name}
        </Text>
        <Text style={styles.input}>
          {channel.input}
          {isSelected && (
            <Text style={styles.active}> • ACTIVE</Text>
          )}
        </Text>
      </View>

      {/* Speaker icon */}
      <IconButton
        icon={channel.muted ? 'speaker-muted' : 'speaker'}
        size={16}
        color={channel.muted ? colors.textDim : colors.textSecondary}
        onPress={onToggleMute}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  containerSelected: {
    backgroundColor: colors.purpleBg,
    borderWidth: 1,
    borderColor: colors.purple,
  },
  colorBar: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: typography.semiBold,
  },
  nameSelected: {
    color: colors.purple,
  },
  input: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: typography.regular,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  active: {
    color: colors.purple,
    fontWeight: typography.semiBold,
  },
});
