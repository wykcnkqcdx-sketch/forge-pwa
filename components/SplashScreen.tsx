import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colours } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE        = 220;
const CX          = SIZE / 2;
const STROKE_W    = 10;
const GAP         = 6;

// Four ring radii (outermost → innermost, matching RuckRing colour order)
const RING_CONFIG = [
  { r: CX - STROKE_W / 2,                         colour: colours.cyan   },  // sand/gold
  { r: CX - STROKE_W / 2 - (STROKE_W + GAP),      colour: colours.violet },  // olive
  { r: CX - STROKE_W / 2 - 2 * (STROKE_W + GAP),  colour: colours.green  },  // green
  { r: CX - STROKE_W / 2 - 3 * (STROKE_W + GAP),  colour: colours.amber  },  // amber
];

// Fill levels shown during the splash (evocative, not data-driven)
const FILL_TARGETS = [0.82, 0.67, 0.91, 0.74];

interface SplashScreenProps {
  pulseAnim: Animated.Value;
  typedText: string;
}

export function SplashScreen({ pulseAnim, typedText }: SplashScreenProps) {
  const fillAnims = useRef(RING_CONFIG.map(() => new Animated.Value(0))).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const stampAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered ring fill
    const ringTimings = fillAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 700 + i * 90,
        delay: 180 + i * 140,
        useNativeDriver: false,
      })
    );

    // Glow fade-in
    const glowIn = Animated.timing(glowAnim, {
      toValue: 1,
      duration: 1000,
      delay: 300,
      useNativeDriver: true,
    });

    // "FORGE" text fade + scale stamp
    const stamp = Animated.spring(stampAnim, {
      toValue: 1,
      friction: 7,
      tension: 60,
      delay: 150,
      useNativeDriver: true,
    });

    Animated.parallel([...ringTimings, glowIn, stamp]).start();
  }, []);

  // Typewriter text flicker: drive opacity via pulseAnim when text is loading
  const cursorOpacity = pulseAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [0, 1],
  });

  const forgScale = stampAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const forgOpacity = stampAnim;

  return (
    <View style={styles.root}>
      {/* Background tactical grid */}
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 9 }).map((_, i) => (
          <View key={i} style={styles.gridLine} />
        ))}
      </View>

      <View style={styles.centreColumn}>
        {/* Ring + FORGE brand */}
        <View style={styles.ringWrap}>
          {/* Glow backdrop */}
          <Animated.View
            style={[styles.glowBackdrop, { opacity: glowAnim }]}
            pointerEvents="none"
          />

          {/* SVG Rings */}
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            {RING_CONFIG.map((ring, i) => {
              const circumference = 2 * Math.PI * ring.r;
              const dashOffset = fillAnims[i].interpolate({
                inputRange:  [0, 1],
                outputRange: [circumference, circumference * (1 - FILL_TARGETS[i])],
              });

              return (
                <React.Fragment key={i}>
                  {/* Track ring */}
                  <Circle
                    cx={CX} cy={CX} r={ring.r}
                    stroke={colours.border}
                    strokeWidth={STROKE_W}
                    fill="none"
                    opacity={0.6}
                  />
                  {/* Filled arc */}
                  <AnimatedCircle
                    cx={CX} cy={CX} r={ring.r}
                    stroke={ring.colour}
                    strokeWidth={STROKE_W}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={dashOffset as unknown as number}
                    transform={`rotate(-90 ${CX} ${CX})`}
                    opacity={0.90}
                  />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* FORGE brand centre */}
          <Animated.View
            style={[
              styles.brandCentre,
              { transform: [{ scale: forgScale }], opacity: forgOpacity },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.brandTop}>FORGE</Text>
            <View style={styles.brandDivider} />
            <Text style={styles.brandSub}>RUCK READINESS</Text>
          </Animated.View>
        </View>

        {/* Status typewriter */}
        <View style={styles.statusRow}>
          <Animated.Text style={[styles.status, { opacity: 0.7 }]}>
            {typedText || ' '}
          </Animated.Text>
          {typedText.endsWith('_') && (
            <Animated.Text style={[styles.cursor, { opacity: cursorOpacity }]}>▮</Animated.Text>
          )}
        </View>

        {/* Field ready tag */}
        <View style={styles.fieldTag}>
          <View style={styles.fieldDot} />
          <Text style={styles.fieldTagText}>FIELD READY</Text>
        </View>
      </View>

      {/* Bottom build mark */}
      <Text style={styles.buildMark}>FORGE / FIELD READY FITNESS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colours.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tactical grid lines (vertical, subtle)
  grid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    opacity: 0.06,
  },
  gridLine: {
    width: 1,
    flex: 0,
    backgroundColor: colours.cyan,
    height: '100%',
  },

  // Centre column
  centreColumn: {
    alignItems: 'center',
    gap: 28,
  },

  // Ring
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBackdrop: {
    position: 'absolute',
    width: SIZE * 0.6,
    height: SIZE * 0.6,
    borderRadius: SIZE * 0.3,
    backgroundColor: colours.cyanGlow,
  },

  // Brand overlay
  brandCentre: {
    position: 'absolute',
    alignItems: 'center',
    gap: 4,
  },
  brandTop: {
    color: colours.cyan,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
  },
  brandDivider: {
    width: 40,
    height: 1,
    backgroundColor: colours.borderHot,
  },
  brandSub: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 3.5,
    textAlign: 'center',
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 20,
  },
  status: {
    color: colours.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'],
  },
  cursor: {
    color: colours.cyan,
    fontSize: 11,
    fontWeight: '900',
  },

  // Field ready chip
  fieldTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${colours.green}40`,
    backgroundColor: colours.greenDim,
  },
  fieldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colours.green,
  },
  fieldTagText: {
    color: colours.green,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.2,
  },

  // Build mark
  buildMark: {
    position: 'absolute',
    bottom: 28,
    color: colours.soft,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.0,
    textAlign: 'center',
  },
});
