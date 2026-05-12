import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius, typography } from '../theme';
import { CATEGORIES, ALL_ABBREVS } from '../data/militaryAbbreviations';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function RuckMapGuidePanel({ visible, onClose }: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('essential');

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 1 : 0,
      tension: 90,
      friction: 14,
      useNativeDriver: true,
    }).start();
    if (!visible) setQuery('');
  }, [visible, slideAnim]);

  const filteredTerms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES.find((c) => c.id === activeCategory)?.terms ?? [];
    return ALL_ABBREVS.filter(
      (t) => t.abbr.toLowerCase().includes(q) || t.meaning.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [query, activeCategory]);

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] });
  const opacity = slideAnim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0, 1] });

  return (
    <Animated.View
      style={[styles.panel, { transform: [{ translateY }], opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.handle} />

      <View style={styles.header}>
        <Ionicons name="book-outline" size={12} color={colours.cyan} />
        <Text style={styles.headerTitle}>FIELD GUIDE</Text>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={16} color={colours.muted} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={13} color={colours.muted} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search terms…"
          placeholderTextColor={colours.muted}
          autoCapitalize="characters"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={14} color={colours.muted} />
          </Pressable>
        )}
      </View>

      {!query && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
          <View style={styles.catRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text style={[styles.catChipText, activeCategory === cat.id && styles.catChipTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {filteredTerms.length === 0 ? (
          <Text style={styles.noResults}>No matches for "{query}"</Text>
        ) : (
          filteredTerms.map((term) => (
            <View key={`${term.abbr}-${term.meaning}`} style={styles.row}>
              <Text style={styles.abbr}>{term.abbr}</Text>
              <Text style={styles.meaning}>{term.meaning}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: colours.panel,
    borderTopWidth: 1,
    borderTopColor: colours.borderGlass,
    borderTopLeftRadius: radius.xs,
    borderTopRightRadius: radius.xs,
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colours.borderSoft,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { ...typography.label, color: colours.cyan, letterSpacing: 1.4, flex: 1 },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    color: colours.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  catScroll: { marginHorizontal: 10, marginBottom: 4, flexGrow: 0 },
  catRow: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catChipActive: {
    backgroundColor: 'rgba(103,232,249,0.14)',
    borderColor: 'rgba(103,232,249,0.30)',
  },
  catChipText: { ...typography.label, color: colours.muted, fontSize: 9, letterSpacing: 0.6 },
  catChipTextActive: { color: colours.cyan },
  list: { flex: 1, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  abbr: { width: 72, color: colours.cyan, fontWeight: '900', fontSize: 11, letterSpacing: 0.6, paddingTop: 1 },
  meaning: { flex: 1, color: colours.textSoft, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  noResults: { color: colours.muted, fontSize: 12, textAlign: 'center', paddingVertical: 20 },
});
