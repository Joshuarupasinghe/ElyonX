import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  FlatList,
} from 'react-native';
import { colors, typography, radii } from '../../theme/theme';

interface DropdownOption {
  label: string;
  value: string;
  icon?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  width?: number;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  selectedValue,
  onSelect,
  width = 80,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === selectedValue);

  return (
    <View style={[styles.root, { width }]}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsOpen(open => !open)}
        activeOpacity={0.7}
      >
        {selectedOption?.icon && (
          <Text style={styles.icon}>{selectedOption.icon}</Text>
        )}
        <Text style={styles.triggerText}>
          {selectedOption?.label ?? selectedValue}
        </Text>
        <Text style={styles.chevron}>⌃</Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={[styles.dropdownContainer, { width, maxHeight: 240 }]}>
          <FlatList
            data={options}
            keyExtractor={item => item.value}
            renderItem={({ item: option }) => (
              <TouchableOpacity
                style={[
                  styles.option,
                  option.value === selectedValue && styles.optionSelected,
                ]}
                onPress={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
                activeOpacity={0.7}
              >
                {option.icon && (
                  <Text style={styles.optionIcon}>{option.icon}</Text>
                )}
                <Text
                  style={[
                    styles.optionText,
                    option.value === selectedValue && styles.optionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            )}
            bounces={false}
            style={styles.list}
          />
        </View>
      )}
    </View>
  );
};

export const EQ_BAND_TYPE_OPTIONS: DropdownOption[] = [
  { label: 'Bell', value: 'bell', icon: '∿' },
  { label: 'Low Shelf', value: 'lowshelf', icon: '⌐' },
  { label: 'High Shelf', value: 'highshelf', icon: '¬' },
  { label: 'High Pass', value: 'highpass', icon: '/' },
  { label: 'Low Pass', value: 'lowpass', icon: '\\' },
];

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'visible',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    color: colors.textPrimary,
    fontSize: typography.lg,
    marginRight: 6,
  },
  triggerText: {
    color: colors.textPrimary,
    fontSize: typography.md,
    fontWeight: typography.medium,
    flex: 1,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 10,
    transform: [{ rotate: '180deg' }],
  },
  dropdownContainer: {
    position: 'absolute',
    bottom: 38,
    left: 0,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
    elevation: 10,
    overflow: 'hidden',
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionSelected: {
    backgroundColor: colors.purpleBg,
  },
  optionIcon: {
    color: colors.textSecondary,
    fontSize: typography.lg,
    marginRight: 6,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: typography.md,
  },
  optionTextSelected: {
    color: colors.purple,
    fontWeight: typography.semiBold,
  },
});
