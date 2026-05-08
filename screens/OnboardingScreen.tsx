import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colours, radius, shadows, touchTarget } from '../theme';
import { useResponsive } from '../utils/responsive';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  title: string;
  body: string;
  tone: string;
}

const slides: Slide[] = [
  {
    icon: 'body-outline',
    label: 'STEP 01',
    title: 'Log Readiness First',
    body: 'Every session starts with how you feel: sleep, soreness, hydration, stress. Accurate inputs lead to better decisions and safer training.',
    tone: colours.amber,
  },
  {
    icon: 'analytics-outline',
    label: 'STEP 02',
    title: 'AI-Driven Decisions',
    body: 'Home screen analyses readiness and training load to recommend your optimal move: ruck, strength, recovery, or complete rest.',
    tone: colours.cyan,
  },
  {
    icon: 'barbell-outline',
    label: 'STEP 03',
    title: 'Train. Track. Repeat.',
    body: 'Dedicated tabs for ruck mapping, strength logging, fuel tracking and analytics. Offline-first. No account required to start.',
    tone: colours.green,
  },
];

export function OnboardingScreen({ onComplete }: { onComplete: (mode: 'fresh' | 'demo') => void }) {
  const { width } = useWindowDimensions();
  const { fs, isTablet, sp } = useResponsive();
  const [currentSlide, setCurrentSlide] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  function goToNextSlide() {
    const next = currentSlide + 1;
    setCurrentSlide(next);
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
  }

  const activeTone = slides[currentSlide].tone;

  const renderSlide = ({ item }: { item: typeof slides[0] }) => (
    <View style={[styles.slide, { width }]}>
      <View style={styles.slideInner}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: `${item.tone}14`, borderColor: `${item.tone}50` }]}>
          <Ionicons name={item.icon} size={isTablet ? 52 : 44} color={item.tone} />
        </View>

        {/* Step label */}
        <Text style={[styles.stepLabel, { color: item.tone, fontSize: fs(9, { min: 8, max: 11 }) }]}>{item.label}</Text>

        {/* Title */}
        <Text style={[styles.slideTitle, { fontSize: fs(24, { min: 20, max: 32 }) }]}>{item.title}</Text>

        {/* Body */}
        <Text style={[styles.slideBody, { fontSize: fs(14, { min: 13, max: 17 }) }]}>{item.body}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Subtle grid overlay */}
      <View style={styles.gridOverlay} pointerEvents="none" />

      {/* Brand header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="shield-checkmark" size={isTablet ? 22 : 18} color={colours.cyan} />
          <Text style={[styles.brand, { fontSize: fs(20, { min: 17, max: 26 }) }]}>// FORGE</Text>
        </View>
        <Text style={[styles.headerSub, { fontSize: fs(10, { min: 9, max: 12 }) }]}>TACTICAL FITNESS PLATFORM</Text>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        pagingEnabled
        horizontal
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={({ nativeEvent: { contentOffset } }) => {
          setCurrentSlide(Math.round(contentOffset.x / width));
        }}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        style={{ flex: 1 }}
        bounces={false}
      />

      {/* Dot indicators */}
      <View style={styles.dots}>
        {slides.map((slide, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentSlide
                ? [styles.dotActive, { backgroundColor: slide.tone, width: 24 }]
                : { backgroundColor: colours.borderSoft },
            ]}
          />
        ))}
      </View>

      {/* Footer actions */}
      <View style={[styles.footer, { paddingHorizontal: sp(24) }]}>
        {currentSlide < slides.length - 1 ? (
          <Pressable
            style={({ pressed }) => [styles.nextBtn, { borderColor: `${activeTone}60`, backgroundColor: `${activeTone}14` }, pressed && { opacity: 0.75 }]}
            onPress={goToNextSlide}
            accessibilityRole="button"
            accessibilityLabel="Next slide"
          >
            <Text style={[styles.nextBtnText, { color: activeTone, fontSize: fs(14, { min: 13, max: 16 }) }]}>Next</Text>
            <Ionicons name="arrow-forward" size={isTablet ? 18 : 16} color={activeTone} />
          </Pressable>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: activeTone }, pressed && { opacity: 0.85 }]}
              onPress={() => onComplete('fresh')}
              accessibilityRole="button"
              accessibilityLabel="Start fresh"
            >
              <Ionicons name="play-circle-outline" size={isTablet ? 20 : 18} color={colours.background} />
              <Text style={[styles.primaryBtnText, { fontSize: fs(15, { min: 13, max: 17 }) }]}>Start Fresh</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.75 }]}
              onPress={() => onComplete('demo')}
              accessibilityRole="button"
              accessibilityLabel="Load demo data"
            >
              <Ionicons name="flask-outline" size={isTablet ? 18 : 16} color={colours.cyan} />
              <Text style={[styles.secondaryBtnText, { fontSize: fs(13, { min: 12, max: 15 }) }]}>Load Demo Data</Text>
            </Pressable>
          </>
        )}

        <Text style={[styles.footerNote, { fontSize: fs(11, { min: 10, max: 12 }) }]}>
          No account required · Works fully offline · Your data stays private
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colours.background,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.016,
    backgroundColor: colours.cyan,
  },
  header: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    gap: 5,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brand: {
    color: colours.cyan,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  headerSub: {
    color: colours.muted,
    fontWeight: '900',
    letterSpacing: 2,
  },
  slide: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  slideInner: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepLabel: {
    fontWeight: '900',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  slideTitle: {
    color: colours.text,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: undefined,
  },
  slideBody: {
    color: colours.textSoft,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '700',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: radius.pill,
  },
  dotActive: {
    height: 6,
    borderRadius: radius.pill,
  },
  footer: {
    paddingBottom: 48,
    gap: 12,
    alignItems: 'stretch',
  },
  nextBtn: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  nextBtnText: {
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  primaryBtn: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.sm,
    ...shadows.cyan,
  },
  primaryBtnText: {
    color: colours.background,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colours.borderHot,
    backgroundColor: colours.cyanDim,
  },
  secondaryBtnText: {
    color: colours.cyan,
    fontWeight: '900',
  },
  footerNote: {
    color: colours.soft,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
});
