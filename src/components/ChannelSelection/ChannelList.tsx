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
  onAddChannel: () => void;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  selectedChannelId,
  onSelectChannel,
  onToggleMute,
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
        {channels.map(channel => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isSelected={channel.id === selectedChannelId}
            onSelect={() => onSelectChannel(channel.id)}
            onToggleMute={() => onToggleMute(channel.id)}
          />
        ))}

        <AddChannelButton onPress={onAddChannel} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 250,
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  title: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.md,
  },
});
