import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AudioDeviceOption,
  MixerStatus,
  RuntimeSettings,
  connectMixer,
  fetchRuntimeSettings,
  updateRuntimeSettings,
} from '../api/backend';
import { IconButton } from '../components/common/IconButton';
import { colors, radii, spacing, typography } from '../theme/theme';

type SelectOption = {
  label: string;
  value: string;
  detail?: string;
};

interface SettingsPageProps {
  onClose: () => void;
  onMixerStatusChange?: (status: MixerStatus) => void;
}

interface SelectFieldProps {
  label: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

function splitIpAddress(ip: string): string[] {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return ['', '', '', ''];
  }
  return parts.map((part) => part.replace(/\D/g, '').slice(0, 3));
}

function normalizeIpOctets(octets: string[]): string | null {
  if (octets.length !== 4) {
    return null;
  }

  const parsed = octets.map((octet) => Number(octet));
  const valid = parsed.every(
    (value, index) =>
      octets[index].length > 0 &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 255
  );

  return valid ? parsed.join('.') : null;
}

function parseError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected settings error.';
}

function formatSampleRate(device: AudioDeviceOption): string {
  if (
    device.default_samplerate === null ||
    !Number.isFinite(Number(device.default_samplerate))
  ) {
    return device.hostapi || 'Audio input';
  }
  return `${Math.round(Number(device.default_samplerate) / 1000)} kHz - ${
    device.hostapi || 'Audio input'
  }`;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  options,
  selectedValue,
  onSelect,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected =
    options.find((option) => option.value === selectedValue) ?? options[0];

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.selectRoot}>
        <TouchableOpacity
          style={[styles.selectTrigger, disabled && styles.controlDisabled]}
          onPress={() => setIsOpen((open) => !open)}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <View style={styles.selectTextWrap}>
            <Text style={styles.selectText} numberOfLines={1}>
              {selected?.label ?? 'No options'}
            </Text>
            {selected?.detail && (
              <Text style={styles.selectDetail} numberOfLines={1}>
                {selected.detail}
              </Text>
            )}
          </View>
          <Text style={styles.selectChevron}>{isOpen ? '^' : 'v'}</Text>
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.selectMenu}>
            <ScrollView style={styles.selectList} nestedScrollEnabled>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.selectOption,
                    option.value === selectedValue && styles.selectOptionActive,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    setIsOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.selectOptionText,
                      option.value === selectedValue &&
                        styles.selectOptionTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {option.label}
                  </Text>
                  {option.detail && (
                    <Text style={styles.selectOptionDetail} numberOfLines={1}>
                      {option.detail}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
};

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onClose,
  onMixerStatusChange,
}) => {
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [ipOctets, setIpOctets] = useState<string[]>(['', '', '', '']);
  const [portText, setPortText] = useState('');
  const [selectedDeviceValue, setSelectedDeviceValue] = useState('fallback');
  const [rtaChannelValue, setRtaChannelValue] = useState('0');
  const [bandMode, setBandMode] = useState<4 | 6>(6);

  const applySettingsToDraft = useCallback((next: RuntimeSettings) => {
    setSettings(next);
    setIpOctets(splitIpAddress(next.mixer.osc_target_ip));
    setPortText(String(next.mixer.osc_target_port));
    setSelectedDeviceValue(
      next.audio.selected_device_index === null
        ? 'fallback'
        : String(next.audio.selected_device_index)
    );
    setRtaChannelValue(String(next.audio.rta_input_channel));
    setBandMode(next.equalizer.band_mode);
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchRuntimeSettings();
      applySettingsToDraft(next);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }, [applySettingsToDraft]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const deviceOptions = useMemo<SelectOption[]>(() => {
    const fallbackName =
      settings?.audio.fallback_device_name ?? 'Focusrite USB Audio';
    const options: SelectOption[] = [
      {
        label: `${fallbackName} fallback`,
        value: 'fallback',
        detail: 'Backend default device match',
      },
    ];

    for (const device of settings?.available_audio_devices ?? []) {
      options.push({
        label: device.name,
        value: String(device.index),
        detail: `${device.max_input_channels} input${
          device.max_input_channels === 1 ? '' : 's'
        } - ${formatSampleRate(device)}`,
      });
    }

    return options;
  }, [settings]);

  const selectedDevice = useMemo(() => {
    if (!settings || selectedDeviceValue === 'fallback') {
      return null;
    }
    return (
      settings.available_audio_devices.find(
        (device) => String(device.index) === selectedDeviceValue
      ) ?? null
    );
  }, [selectedDeviceValue, settings]);

  const maxInputChannels = Math.max(
    1,
    selectedDevice?.max_input_channels ??
      settings?.audio.max_input_channels ??
      1
  );

  const channelOptions = useMemo<SelectOption[]>(
    () =>
      Array.from({ length: maxInputChannels }, (_, index) => ({
        label: `Input ${index + 1}`,
        value: String(index),
        detail: `Backend channel ${index}`,
      })),
    [maxInputChannels]
  );

  useEffect(() => {
    if (Number(rtaChannelValue) >= maxInputChannels) {
      setRtaChannelValue('0');
    }
  }, [maxInputChannels, rtaChannelValue]);

  const handleOctetChange = useCallback((index: number, value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 3);
    setIpOctets((prev) =>
      prev.map((octet, i) => (i === index ? cleaned : octet))
    );
  }, []);

  const handleSave = useCallback(async () => {
    const ip = normalizeIpOctets(ipOctets);
    if (!ip) {
      setError('Enter a valid IPv4 address.');
      return;
    }

    const port = Number(portText);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError('Enter a valid OSC port from 1 to 65535.');
      return;
    }

    const inputChannel = Number(rtaChannelValue);
    if (!Number.isInteger(inputChannel) || inputChannel < 0) {
      setError('Select a valid RTA mic input.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const next = await updateRuntimeSettings({
        osc_target_ip: ip,
        osc_target_port: port,
        audio_device_index:
          selectedDeviceValue === 'fallback'
            ? null
            : Number(selectedDeviceValue),
        rta_input_channel: inputChannel,
        eq_band_mode: bandMode,
      });
      applySettingsToDraft(next);
      let mixerMessage = 'Settings saved.';
      try {
        const mixerStatus = await connectMixer();
        onMixerStatusChange?.(mixerStatus);
        mixerMessage = mixerStatus.connected
          ? `Settings saved. Mixer connected at ${mixerStatus.host}:${mixerStatus.port}.`
          : 'Settings saved. Mixer did not report online yet.';
      } catch (mixerErr) {
        mixerMessage = `Settings saved. Mixer connection failed: ${parseError(
          mixerErr
        )}`;
      }
      setStatusMessage(
        next.requires_capture_restart
          ? `${mixerMessage} Restart AI Assist capture to use the new audio input.`
          : mixerMessage
      );
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSaving(false);
    }
  }, [
    applySettingsToDraft,
    bandMode,
    ipOctets,
    onMixerStatusChange,
    portText,
    rtaChannelValue,
    selectedDeviceValue,
  ]);

  const currentIp = normalizeIpOctets(ipOctets) ?? ipOctets.join('.');
  const currentDeviceLabel =
    selectedDeviceValue === 'fallback'
      ? settings?.audio.fallback_device_name ?? 'Focusrite USB Audio'
      : selectedDevice?.name ??
        settings?.audio.selected_device_name ??
        'Selected device';

  return (
    <View style={styles.container}>
      <View style={styles.overviewPane}>
        <View style={styles.overviewHeader}>
          <View>
            <Text style={styles.eyebrow}>SYSTEM SETTINGS</Text>
            <Text style={styles.title}>Console setup</Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={styles.backButtonText}>BACK TO MIXER</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>MIXER ENDPOINT</Text>
            <Text style={styles.summaryValue}>{currentIp}</Text>
            <Text style={styles.summaryMeta}>OSC {portText || '--'}</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>RTA SOURCE</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {currentDeviceLabel}
            </Text>
            <Text style={styles.summaryMeta}>
              INPUT {Number(rtaChannelValue) + 1}
            </Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryLabel}>EQ TOPOLOGY</Text>
            <Text style={styles.summaryValue}>{bandMode} BAND</Text>
            <Text style={styles.summaryMeta}>
              {bandMode === 4 ? 'LOW TO HIGHS' : 'FULL MODEL OUTPUT'}
            </Text>
          </View>
        </View>

        <View style={styles.largeStatusPanel}>
          {loading && !settings ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.purple} />
              <Text style={styles.loadingText}>LOADING SETTINGS</Text>
            </View>
          ) : (
            <>
              <Text style={styles.panelEyebrow}>ACTIVE ROUTING</Text>
              <Text style={styles.panelTitle}>
                {settings?.audio.stream_active
                  ? 'RTA capture is online'
                  : 'RTA capture is idle'}
              </Text>
              <View style={styles.signalRows}>
                <View style={styles.signalRow}>
                  <View
                    style={[
                      styles.signalDot,
                      { backgroundColor: colors.purple },
                    ]}
                  />
                  <Text style={styles.signalText}>
                    OSC target {currentIp}:{portText || '--'}
                  </Text>
                </View>
                <View style={styles.signalRow}>
                  <View
                    style={[styles.signalDot, { backgroundColor: colors.cyan }]}
                  />
                  <Text style={styles.signalText} numberOfLines={1}>
                    RTA mic {currentDeviceLabel} input{' '}
                    {Number(rtaChannelValue) + 1}
                  </Text>
                </View>
                <View style={styles.signalRow}>
                  <View
                    style={[
                      styles.signalDot,
                      { backgroundColor: colors.green },
                    ]}
                  />
                  <Text style={styles.signalText}>
                    EQ recommendations return {bandMode} band values
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.sidebar}
        contentContainerStyle={styles.sidebarContent}
        bounces={false}
      >
        <View style={styles.sidebarHeader}>
          <View>
            <Text style={styles.sidebarTitle}>SETTINGS</Text>
            <Text style={styles.sidebarSubtitle}>Runtime configuration</Text>
          </View>
          <IconButton
            icon="close"
            size={18}
            color={colors.textSecondary}
            onPress={onClose}
          />
        </View>

        {error && (
          <View style={[styles.messageBox, styles.errorBox]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {statusMessage && (
          <View style={[styles.messageBox, styles.successBox]}>
            <Text style={styles.successText}>{statusMessage}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MIXER SETTINGS</Text>
          <Text style={styles.fieldLabel}>OSC TARGET IP</Text>
          <View style={styles.ipRow}>
            {ipOctets.map((octet, index) => (
              <React.Fragment key={index}>
                <TextInput
                  value={octet}
                  onChangeText={(value) => handleOctetChange(index, value)}
                  keyboardType="numeric"
                  maxLength={3}
                  selectTextOnFocus
                  placeholder="000"
                  placeholderTextColor={colors.textDim}
                  style={styles.ipInput}
                />
                {index < 3 && <Text style={styles.ipDot}>.</Text>}
              </React.Fragment>
            ))}
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>OSC TARGET PORT</Text>
            <TextInput
              value={portText}
              onChangeText={(value) =>
                setPortText(value.replace(/\D/g, '').slice(0, 5))
              }
              keyboardType="numeric"
              placeholder="10023"
              placeholderTextColor={colors.textDim}
              style={styles.textInput}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AUDIO DEVICE SETTINGS</Text>
          <SelectField
            label="AUDIO DEVICE"
            options={deviceOptions}
            selectedValue={selectedDeviceValue}
            onSelect={setSelectedDeviceValue}
            disabled={loading}
          />
          <SelectField
            label="RTA MIC INPUT"
            options={channelOptions}
            selectedValue={rtaChannelValue}
            onSelect={setRtaChannelValue}
            disabled={loading}
          />
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={loadSettings}
            activeOpacity={0.75}
            disabled={loading || saving}
          >
            <Text style={styles.secondaryButtonText}>
              {loading ? 'REFRESHING' : 'REFRESH DEVICES'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EQUALIZER SETTINGS</Text>
          <View style={styles.modeGrid}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                bandMode === 4 && styles.modeButtonActive,
              ]}
              onPress={() => setBandMode(4)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.modeTitle,
                  bandMode === 4 && styles.modeTitleActive,
                ]}
              >
                4 BAND
              </Text>
              <Text style={styles.modeMeta}>LOW, LOW-MID</Text>
              <Text style={styles.modeMeta}>HIGH-MID, HIGHS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                bandMode === 6 && styles.modeButtonActive,
              ]}
              onPress={() => setBandMode(6)}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.modeTitle,
                  bandMode === 6 && styles.modeTitleActive,
                ]}
              >
                6 BAND
              </Text>
              <Text style={styles.modeMeta}>SUB TO AIR</Text>
              <Text style={styles.modeMeta}>FULL OUTPUT</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.controlDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={saving || loading}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'SAVING' : 'SAVE SETTINGS'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  overviewPane: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  eyebrow: {
    color: colors.purple,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 3,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: typography.bold,
    marginTop: spacing.xs,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  summaryTile: {
    flex: 1,
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.purpleBg,
    padding: spacing.lg,
    borderRadius: radii.md,
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  summaryValue: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: typography.bold,
  },
  summaryMeta: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
  },
  largeStatusPanel: {
    flex: 1,
    minHeight: 240,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  loadingWrap: {
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  panelEyebrow: {
    color: colors.cyan,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 3,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: typography.xxl,
    fontWeight: typography.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  signalRows: {
    gap: spacing.md,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  signalText: {
    color: colors.textSecondary,
    fontSize: typography.md,
    fontWeight: typography.medium,
    flex: 1,
  },
  sidebar: {
    width: 384,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  sidebarContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sidebarTitle: {
    color: colors.textPrimary,
    fontSize: typography.xl,
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  sidebarSubtitle: {
    color: colors.textMuted,
    fontSize: typography.sm,
    fontWeight: typography.medium,
    marginTop: spacing.xs,
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  errorBox: {
    borderColor: colors.red,
    backgroundColor: colors.redDim,
  },
  successBox: {
    borderColor: colors.green,
    backgroundColor: colors.greenDim,
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    lineHeight: 16,
  },
  successText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.semiBold,
    lineHeight: 16,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 2,
  },
  fieldBlock: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  textInput: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    fontSize: typography.md,
    fontWeight: typography.semiBold,
  },
  ipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ipInput: {
    flex: 1,
    minWidth: 48,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
    fontSize: typography.md,
    fontWeight: typography.bold,
  },
  ipDot: {
    color: colors.textSecondary,
    fontSize: typography.lg,
    fontWeight: typography.bold,
  },
  selectRoot: {
    position: 'relative',
    zIndex: 20,
  },
  selectTrigger: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectTextWrap: {
    flex: 1,
  },
  selectText: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: typography.semiBold,
  },
  selectDetail: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginTop: spacing.xxs,
  },
  selectChevron: {
    color: colors.purple,
    fontSize: typography.xs,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  selectMenu: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
    overflow: 'hidden',
    zIndex: 50,
  },
  selectList: {
    maxHeight: 220,
  },
  selectOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  selectOptionActive: {
    backgroundColor: colors.purpleBg,
  },
  selectOptionText: {
    color: colors.textSecondary,
    fontSize: typography.md,
    fontWeight: typography.semiBold,
  },
  selectOptionTextActive: {
    color: colors.purple,
  },
  selectOptionDetail: {
    color: colors.textMuted,
    fontSize: typography.xs,
    marginTop: spacing.xxs,
  },
  secondaryButton: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: typography.sm,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    minHeight: 94,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    justifyContent: 'center',
  },
  modeButtonActive: {
    borderColor: colors.purple,
    backgroundColor: colors.purpleBg,
  },
  modeTitle: {
    color: colors.textSecondary,
    fontSize: typography.lg,
    fontWeight: typography.bold,
    marginBottom: spacing.sm,
  },
  modeTitleActive: {
    color: colors.purple,
  },
  modeMeta: {
    color: colors.textMuted,
    fontSize: typography.xs,
    fontWeight: typography.semiBold,
    lineHeight: 14,
  },
  saveButton: {
    minHeight: 46,
    borderRadius: radii.sm,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  saveButtonText: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: typography.bold,
    letterSpacing: 1,
  },
  controlDisabled: {
    opacity: 0.55,
  },
});
