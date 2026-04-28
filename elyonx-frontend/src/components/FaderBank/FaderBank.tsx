import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ChannelFader } from './ChannelFader';
import { MasterFader } from './MasterFader';
import { Channel } from '../../store/types';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface FaderBankProps {
  channels: Channel[];
  masterValue: number;
  selectedChannelId: string | null;
  onFaderChange: (channelId: string, db: number) => void;
  onMasterChange: (db: number) => void;
  onToggleMute: (channelId: string) => void;
  onToggleSolo: (channelId: string) => void;
  onSelectChannel: (channelId: string) => void;
}

export const FaderBank: React.FC<FaderBankProps> = ({
  channels,
  masterValue,
  selectedChannelId,
  onFaderChange,
  onMasterChange,
  onToggleMute,
  onToggleSolo,
  onSelectChannel,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FADER BANK</Text>

      <View style={styles.fadersRow}>
        <ScrollView
          style={styles.fadersScroll}
          horizontal
          scrollEnabled={channels.length > 8}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {channels.map(channel => (
            <ChannelFader
              key={channel.id}
              channel={channel}
              isSelected={channel.id === selectedChannelId}
              onFaderChange={db => onFaderChange(channel.id, db)}
              onToggleMute={() => onToggleMute(channel.id)}
              onToggleSolo={() => onToggleSolo(channel.id)}
              onSelect={() => onSelectChannel(channel.id)}
            />
          ))}
        </ScrollView>

        <MasterFader
          value={masterValue}
          onValueChange={onMasterChange}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: spacing.md,
  },
  fadersRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
  },
  fadersScroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'stretch',
    gap: spacing.md,
    paddingRight: spacing.md,
    flexGrow: 1,
  },
});
