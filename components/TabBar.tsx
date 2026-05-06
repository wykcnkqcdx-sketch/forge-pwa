import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, shadow, touchTarget } from '../theme';
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
  return (
    <View style={[styles.tabBar, shadow.card]}>
      <View style={styles.tabBarHighlight} />
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
            onPress={() => onTabPress(tab.id)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            {isActive ? (
              <View style={styles.activePill}>
                <Ionicons name={tab.iconActive} size={18} color={colours.background} />
                <Text style={styles.activePillLabel}>{tab.label}</Text>
              </View>
            ) : (
              <View style={styles.inactiveItem}>
                <Ionicons name={tab.icon} size={20} color={colours.muted} />
                <Text style={styles.inactiveLabel}>{tab.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colours.surface,
    borderTopWidth: 1,
    borderTopColor: colours.border,
    paddingBottom: 20,
    paddingTop: 12,
    position: 'relative',
  },
  tabBarHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colours.borderGlass,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colours.cyan,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 80,
    justifyContent: 'center',
  },
  activePillLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colours.background,
  },
  inactiveItem: {
    alignItems: 'center',
    gap: 4,
  },
  inactiveLabel: {
    fontSize: 12,
    color: colours.muted,
    marginTop: 2,
  },
});
