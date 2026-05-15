import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Channel } from '../../store/types';
import { ChannelItem } from './ChannelItem';
import { AddChannelButton } from './AddChannelButton';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface ChannelListProps {
  channels: Channel[];
  selectedChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onToggleMute: (channelId: string) => void;
  onRemoveChannel: (channelId: string) => void;
  onAddChannel: () => void;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  selectedChannelId,
  onSelectChannel,
  onToggleMute,
  onRemoveChannel,
  onAddChannel,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CHANNEL SELECTION</Text>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {channels.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Channels</Text>
            <Text style={styles.emptySubtitle}>
              Add a channel to start mixing
            </Text>
          </View>
        )}

        {channels.map(channel => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isSelected={channel.id === selectedChannelId}
            onSelect={() => onSelectChannel(channel.id)}
            onToggleMute={() => onToggleMute(channel.id)}
            onRemove={() => onRemoveChannel(channel.id)}
          />
        ))}

        <AddChannelButton onPress={onAddChannel} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  title: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontSize: typography.lg,
    fontWeight: typography.semiBold,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    color: colors.textDim,
    fontSize: typography.sm,
    textAlign: 'center',
  },
});
