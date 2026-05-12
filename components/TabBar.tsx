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
    <View style={styles.outerShell}>
      <View style={[styles.wrapper, shadow.elevated]}>
        <View style={styles.topHighlight} />
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={String(tab.id)}
              style={({ pressed }) => [
                styles.tabItem,
                isActive && styles.tabItemActive,
                pressed && styles.tabItemPressed,
              ]}
              onPress={() => onTabPress(tab.id)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.iconDock, isActive && styles.iconDockActive]}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={isActive ? (isTablet ? 21 : 19) : (isTablet ? 20 : 18)}
                  color={isActive ? colours.background : colours.muted}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { fontSize: fs(9, { min: 8, max: 11 }) },
                  isActive && styles.labelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerShell: {
    backgroundColor: colours.background,
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 18 : 10,
  },
  wrapper: {
    flexDirection: 'row',
    backgroundColor: colours.nav,
    borderWidth: 1,
    borderColor: colours.borderGlass,
    borderRadius: radius.xl,
    paddingVertical: 8,
    paddingHorizontal: 6,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        // @ts-ignore: web-only
        backdropFilter: 'blur(18px)',
      },
    }),
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: colours.borderGlass,
    opacity: 0.95,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTarget,
    paddingHorizontal: 2,
    gap: 4,
    borderRadius: radius.lg,
  },
  tabItemActive: {
    backgroundColor: colours.layer2,
  },
  tabItemPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  iconDock: {
    width: 34,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconDockActive: {
    backgroundColor: colours.cyan,
    borderColor: colours.cyan,
    shadowColor: colours.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    color: colours.soft,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  labelActive: {
    color: colours.text,
    fontWeight: '900',
  },
});
