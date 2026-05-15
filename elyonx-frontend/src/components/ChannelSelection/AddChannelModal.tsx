import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import { InstrumentType, Channel, DEFAULT_EQ_BANDS } from '../../store/types';
import { colors, typography, spacing, radii } from '../../theme/theme';

interface AddChannelModalProps {
  visible: boolean;
  onClose: () => void;
  onAddChannel: (channel: Channel) => void;
}

const INSTRUMENTS: {
  type: InstrumentType;
  label: string;
  icon: string;
}[] = [
  { type: 'kick', label: 'Kick', icon: 'kick' },
  { type: 'snare', label: 'Snare', icon: 'snare' },
  { type: 'hihat', label: 'HiHat', icon: 'hihat' },
];

const ICON_SOURCES: Record<InstrumentType, any> = {
  kick: require('../../../icons/bass-drum.png'),
  snare: require('../../../icons/snare-drum.png'),
  hihat: require('../../../icons/hi-hat.png'),
};

const COLOR_PRESETS = [
  { name: 'Purple', value: '#A855F7' },
  { name: 'Orange', value: '#FFAB40' },
  { name: 'Cyan', value: '#40E0D0' },
  { name: 'Green', value: '#00E676' },
  { name: 'Red', value: '#FF5252' },
  { name: 'Blue', value: '#448AFF' },
  { name: 'Pink', value: '#FF4081' },
  { name: 'Yellow', value: '#FFD740' },
];

export const AddChannelModal: React.FC<AddChannelModalProps> = ({
  visible,
  onClose,
  onAddChannel,
}) => {
  const [instrument, setInstrument] = useState<InstrumentType>('kick');
  const [inputChannel, setInputChannel] = useState('1');
  const [selectedColor, setSelectedColor] = useState(COLOR_PRESETS[0].value);

  const selectedInstrumentDef = INSTRUMENTS.find(i => i.type === instrument)!;

  const handleConfirm = () => {
    const inputNum = Math.max(1, Math.min(32, parseInt(inputChannel, 10) || 1));
    const newChannel: Channel = {
      id: `ch-${Date.now()}`,
      index: inputNum,
      name: selectedInstrumentDef.label,
      instrument,
      input: `INPUT ${inputNum.toString().padStart(2, '0')}`,
      color: selectedColor,
      icon: ICON_SOURCES[selectedInstrumentDef.type],
      faderValue: 0,
      muted: false,
      solo: false,
      eqBands: DEFAULT_EQ_BANDS.map(b => ({ ...b })),
      eqEnabled: true,
    };
    onAddChannel(newChannel);
    setInstrument('kick');
    setInputChannel('1');
    setSelectedColor(COLOR_PRESETS[0].value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>ADD CHANNEL</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>INSTRUMENT</Text>
            <View style={styles.instrumentRow}>
              {INSTRUMENTS.map(inst => {
                const isSelected = inst.type === instrument;
                return (
                  <TouchableOpacity
                    key={inst.type}
                    style={[
                      styles.instrumentOption,
                      isSelected && styles.instrumentOptionSelected,
                    ]}
                    onPress={() => setInstrument(inst.type)}
                    activeOpacity={0.7}
                  >
                    <Image source={ICON_SOURCES[inst.type]} style={styles.instrumentIcon} />
                    <Text
                      style={[
                        styles.instrumentLabel,
                        isSelected && styles.instrumentLabelSelected,
                      ]}
                    >
                      {inst.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>INPUT CHANNEL</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={inputChannel}
                onChangeText={text => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setInputChannel(cleaned);
                }}
                keyboardType="numeric"
                maxLength={2}
                placeholder="1"
                placeholderTextColor={colors.textDim}
              />
              <Text style={styles.inputHint}>1 – 32</Text>
            </View>

            <Text style={styles.label}>COLOR</Text>
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map(preset => {
                const isSelected = preset.value === selectedColor;
                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: preset.value },
                      isSelected && styles.colorSwatchSelected,
                    ]}
                    onPress={() => setSelectedColor(preset.value)}
                    activeOpacity={0.7}
                  >
                    {isSelected && <Text style={styles.colorCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.preview}>
              <View style={[styles.previewBar, { backgroundColor: selectedColor }]} />
              <View style={styles.previewInfo}>
                <Image source={ICON_SOURCES[selectedInstrumentDef.type]} style={styles.previewIcon} />
                <View>
                  <Text style={styles.previewName}>{selectedInstrumentDef.label}</Text>
                  <Text style={styles.previewInput}>
                    INPUT {(parseInt(inputChannel, 10) || 1).toString().padStart(2, '0')}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>CANCEL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmText}>ADD CHANNEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: 420,
    maxHeight: '80%',
    backgroundColor: '#1A1A1E',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  body: {
    padding: spacing.xl,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  instrumentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  instrumentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  instrumentOptionSelected: {
    borderColor: colors.purple,
    backgroundColor: colors.purpleBg,
  },
  instrumentIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
    marginBottom: spacing.xs,
  },
  instrumentLabel: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    letterSpacing: 1,
  },
  instrumentLabelSelected: {
    color: colors.purple,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  textInput: {
    width: 72,
    height: 40,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: typography.semiBold,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  inputHint: {
    color: colors.textDim,
    fontSize: typography.xs,
    letterSpacing: 0.5,
  },
  colorRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: colors.textPrimary,
  },
  colorCheck: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  previewBar: {
    width: 3,
    height: 36,
    borderRadius: 2,
    marginRight: spacing.md,
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  previewName: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    fontWeight: typography.semiBold,
  },
  previewInput: {
    color: colors.textMuted,
    fontSize: typography.xs,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  cancelButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 1.5,
  },
  confirmButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.purple,
  },
  confirmText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 1.5,
  },
});
