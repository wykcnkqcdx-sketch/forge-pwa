import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { useLocalStore } from '../hooks/useLocalStore';
import { colours } from '../theme';

interface Slide {
  icon: 'body-outline' | 'flash-outline' | 'barbell-outline';
  title: string;
  body: string;
}

const slides: Slide[] = [
  {
    icon: 'body-outline',
    title: 'Log Readiness First',
    body: 'Every session starts with how you feel: sleep, soreness, hydration, stress. Accurate inputs → better decisions.',
  },
  {
    icon: 'flash-outline',
    title: "AI-Driven Decision",
    body: 'Home screen analyses readiness + training load to recommend your optimal move: ruck, strength, recovery, or rest.',
  },
  {
    icon: 'barbell-outline',
    title: 'Train. Track. Repeat.',
    body: 'Dedicated tabs for ruck mapping, strength/resistance logging, fuel tracking. All offline-first, tactical-grade.',
  },
];

export function OnboardingScreen() {
  const { setHasSeenOnboarding } = useLocalStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  const completeOnboarding = () => {
    setHasSeenOnboarding(true);
  };

  const renderSlide = ({ item }: { item: typeof slides[0] }) => (
    <View style={styles.slide}>
      <Card style={styles.slideCard}>
        <View style={styles.iconWrap}>
          <Ionicons name={item.icon} size={48} color={colours.cyan} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.body}>{item.body}</Text>
      </Card>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dots}>
      {slides.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentSlide && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.brand}>// FORGE</Text>
          <Text style={styles.kicker}>Initialising Systems</Text>
        </View>

        <FlatList
          data={slides}
          renderItem={renderSlide}
          pagingEnabled
          horizontal
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={({
            nativeEvent: { contentOffset },
          }) => {
            const index = Math.round(contentOffset.x / 340); // Approximate slide width
            setCurrentSlide(index);
          }}
          style={styles.slides}
          contentContainerStyle={styles.slidesContent}
        />

        {renderDots()}

        <View style={styles.footer}>
        <Pressable style={styles.getStarted} onPress={completeOnboarding}>
            <Text style={styles.getStartedText}>Get Started →</Text>
          </Pressable>
          {currentSlide < slides.length - 1 && (
            <Pressable onPress={() => setCurrentSlide(currentSlide + 1)}>
              <Text style={styles.next}>Next</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: colours.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  brand: {
    color: colours.cyan,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  kicker: {
    color: colours.muted,
    fontSize: 14,
    marginTop: 8,
  },
  slides: {
    flex: 1,
  },
  slidesContent: {
    paddingHorizontal: 20,
  },
  slide: {
    width: 340,
    justifyContent: 'center',
  },
  slideCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 24,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colours.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colours.cyan,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colours.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: colours.textSoft,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colours.borderSoft,
  },
  dotActive: {
    backgroundColor: colours.cyan,
  },
  footer: {
    padding: 30,
    alignItems: 'center',
    gap: 12,
  },
  getStarted: {
    backgroundColor: colours.cyan,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  getStartedText: {
    color: colours.background,
    fontSize: 18,
    fontWeight: '900',
  },
  next: {
    color: colours.cyan,
    fontSize: 14,
    fontWeight: '800',
  },
});
