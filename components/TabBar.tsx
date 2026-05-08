import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius, shadow, touchTarget } from '../theme';
import { useResponsive } from '../utils/responsive';
import type { Tab, MemberTab } from '../types/app';

interface TabItem<TTab extends Tab | MemberTab = Tab | MemberTab> {
  id: TTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}

interface TabBarProps<TTab extends Tab | MemberTab> {
  tabs: TabItem<TTab>[];
  activeTab: TTab;
  onTabPress: (tabId: TTab) => void;
}

export function TabBar<TTab extends Tab | MemberTab>({ tabs, activeTab, onTabPress }: TabBarProps<TTab>) {
  const { isTablet, fs } = useResponsive();

  return (
    <View style={[styles.wrapper, shadow.elevated]}>
      {/* Glass top highlight */}
      <View style={styles.topHighlight} />

      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Pressable
            key={String(tab.id)}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && styles.tabItemPressed,
            ]}
            onPress={() => onTabPress(tab.id)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {isActive ? (
              <View style={styles.activePill}>
                <Ionicons
                  name={tab.iconActive}
                  size={isTablet ? 18 : 16}
                  color={colours.background}
                />
                <Text style={[styles.activePillLabel, { fontSize: fs(11, { min: 10, max: 13 }) }]}>
                  {tab.label}
                </Text>
              </View>
            ) : (
              <View style={styles.inactiveItem}>
                <Ionicons
                  name={tab.icon}
                  size={isTablet ? 22 : 20}
                  color={colours.muted}
                />
                <Text style={[styles.inactiveLabel, { fontSize: fs(10, { min: 9, max: 12 }) }]}>
                  {tab.label}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: colours.surface,
    borderTopWidth: 1,
    borderTopColor: colours.borderSoft,
    paddingBottom: Platform.OS === 'ios' ? 22 : 14,
    paddingTop: 10,
    paddingHorizontal: 6,
    position: 'relative',
    ...Platform.select({
      web: {
        // @ts-ignore: web-only
        backdropFilter: 'blur(12px)',
      },
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colours.borderGlass,
    opacity: 0.9,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
    paddingHorizontal: 4,
  },
  tabItemPressed: {
    opacity: 0.6,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colours.cyan,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    minWidth: 68,
    justifyContent: 'center',
    ...shadow.cyan,
  },
  activePillLabel: {
    fontWeight: '900',
    color: colours.background,
    letterSpacing: 0.3,
  },
  inactiveItem: {
    alignItems: 'center',
    gap: 3,
  },
  inactiveLabel: {
    color: colours.muted,
    fontWeight: '700',
    marginTop: 1,
    letterSpacing: 0.2,
  },
});
