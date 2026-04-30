import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Pressable, Alert, DeviceEventEmitter, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours } from '../theme';
import { TrainingSession, TrackPoint } from '../data/domain';
import { getMapPoints, distanceBetween, bearingBetween } from '../utils/mapUtils';

function formatElapsed(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatDuration(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs <= 0) return `${mins} min`;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function cardinalDirection(degrees: number) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(degrees / 45) % labels.length];
}

function formatHeading(degrees: number) {
  return `${String(Math.round(degrees)).padStart(3, '0')}°`;
}

function toTrackPoint(location: Location.LocationObject): TrackPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

const LOCATION_TASK_NAME = 'background-location-task';
const supportsBackgroundLocation = Platform.OS !== 'web';

if (supportsBackgroundLocation) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error('Background Location Task Error:', error);
      return;
    }
    if (data) {
      const { locations } = data as { locations: Location.LocationObject[] };

      try {
        const stored = await AsyncStorage.getItem('forge:ruck_route');
        const existingPoints: TrackPoint[] = stored ? JSON.parse(stored) : [];
        const newPoints = locations.map(toTrackPoint);

        await AsyncStorage.setItem('forge:ruck_route', JSON.stringify([...existingPoints, ...newPoints]));
      } catch (e) {
        console.error('Failed to save background locations', e);
      }

      DeviceEventEmitter.emit('onLocationUpdate', locations);
    }
  });
}

export function RuckScreen({ addSession }: { addSession: (session: TrainingSession) => void }) {
  const [weight, setWeight] = useState(18);
  const [distance, setDistance] = useState(8);
  const [plannedAscentM, setPlannedAscentM] = useState(300);
  const [isTracking, setIsTracking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [routePoints, setRoutePoints] = useState<TrackPoint[]>([]);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [weather, setWeather] = useState<TrainingSession['weather']>('Mild');
  const [terrain, setTerrain] = useState<TrainingSession['terrain']>('Pavement');
  const [calibrationFactor, setCalibrationFactor] = useState(1.0);
  const [bodyWeightKg, setBodyWeightKg] = useState(82);

  useEffect(() => {
    AsyncStorage.getItem('forge:profile').then(data => {
      if (data) {
        try {
          const profile = JSON.parse(data);
          if (profile.weight) {
            const w = parseFloat(profile.weight);
            if (!isNaN(w)) setBodyWeightKg(w);
          }
        } catch (e) {
          console.error('Failed to parse profile for weight', e);
        }
      }
    });
  }, []);

  const terrainMultiplier = useMemo(() => {
    switch(terrain) {
      case 'Sand':
      case 'Heavy Brush': return 1.2;
      case 'Mixed':
      case 'Hilly': return 1.1;
      default: return 1.0;
    }
  }, [terrain]);

  const [footCareChecked, setFootCareChecked] = useState(false);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const foregroundLocationSubscription = useRef<Location.LocationSubscription | null>(null);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const lastPointRef = useRef<TrackPoint | null>(null);
  const prevHeading = useRef(0);

  const currentPoint = routePoints[routePoints.length - 1];
  const previousPoint = routePoints[routePoints.length - 2];
  const routeBearing = previousPoint && currentPoint ? Math.round(bearingBetween(previousPoint, currentPoint)) : null;
  const activeHeading = compassHeading ?? routeBearing;
  const currentAltitude = currentPoint?.altitude != null ? Math.round(currentPoint.altitude) : null;
  const mapPoints = useMemo(() => getMapPoints(routePoints), [routePoints]);

  const recordLocation = useCallback((location: Location.LocationObject) => {
    const nextPoint = toTrackPoint(location);

    if (lastPointRef.current && lastPointRef.current.timestamp === nextPoint.timestamp) return;
    if (lastPointRef.current) {
      const dist = distanceBetween(lastPointRef.current, nextPoint);
      setCurrentDistance((current) => current + dist);
    }
    lastPointRef.current = nextPoint;

    setRoutePoints((points) => {
      return [...points, nextPoint].slice(-120);
    });
  }, []);

  useEffect(() => {
    if (activeHeading == null) return;

    // Calculate shortest path to prevent the 359° -> 1° spin-around glitch
    let delta = activeHeading - ((prevHeading.current % 360 + 360) % 360);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    prevHeading.current += delta;
    Animated.timing(rotationAnim, {
      toValue: prevHeading.current,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeHeading, rotationAnim]);

  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = await AsyncStorage.getItem('forge:ruck_route');
        if (stored) {
          const points: TrackPoint[] = JSON.parse(stored);
          if (points.length > 0) {
            setRoutePoints(points.slice(-120));
            
            let dist = 0;
            for (let i = 1; i < points.length; i++) {
              dist += distanceBetween(points[i - 1], points[i]);
            }
            setCurrentDistance(dist);
          lastPointRef.current = points[points.length - 1];

            const start = new Date(points[0].timestamp);
            setStartTime(start);
            setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));

            if (supportsBackgroundLocation) {
              const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
              if (hasStarted) setIsTracking(true);
            }
          }
        }
      } catch (e) {
        console.error('Failed to restore ruck session', e);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    let isMounted = true;
    Location.watchHeadingAsync((heading) => {
      const nextHeading = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
      if (nextHeading >= 0) setCompassHeading(Math.round(nextHeading));
    }).then((subscription) => {
      if (isMounted) {
        headingSubscription.current = subscription;
      } else {
        // Component unmounted before the promise resolved
        subscription.remove();
      }
    }).catch((error) => {
      console.warn('Compass heading unavailable', error);
    });

    return () => {
      isMounted = false;
      headingSubscription.current?.remove();
      headingSubscription.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      foregroundLocationSubscription.current?.remove();
      foregroundLocationSubscription.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isTracking || !startTime) return undefined;

    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [isTracking, startTime]);

  useEffect(() => {
    if (!isTracking) return;

    const subscription = DeviceEventEmitter.addListener('onLocationUpdate', (locations: Location.LocationObject[]) => {
      locations.forEach(recordLocation);
    });

    return () => subscription.remove();
  }, [isTracking, recordLocation]);

  const stopTracking = async () => {
    setIsTracking(false);
    foregroundLocationSubscription.current?.remove();
    foregroundLocationSubscription.current = null;

    try {
      if (!supportsBackgroundLocation) return;
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (error) {
      console.error('Failed to stop background tracking', error);
    }
  };

  const startTracking = async () => {
    if (!footCareChecked) {
      Alert.alert('Pre-Flight Check', 'Acknowledge foot-care checklist before stepping off.');
      return;
    }
    if (isTracking || isStarting) return;
    setIsStarting(true);

    try {
      const fgResponse = await Location.requestForegroundPermissionsAsync();
      if (fgResponse.status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for GPS tracking.');
        return;
      }

      const isPrecise = Platform.OS === 'ios' ? fgResponse.ios?.scope === 'fine' : fgResponse.android?.accuracy === 'fine';
      if (!isPrecise && Platform.OS !== 'web') {
        Alert.alert('Precise Location Required', 'Ruck tracking requires precise GPS. Your route map and distance will be highly inaccurate.');
      }

      const firstPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      await AsyncStorage.setItem('forge:ruck_route', JSON.stringify([toTrackPoint(firstPosition)]));

      let useBackground = false;
      if (supportsBackgroundLocation) {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus === 'granted') {
          useBackground = true;
        } else {
          Alert.alert('Background Restricted', 'App will only track your ruck while the screen is open.');
        }
      }

      if (useBackground) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
          deferredUpdatesDistance: 25,
          deferredUpdatesInterval: 10000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'FORGE Ruck Tracker',
            notificationBody: 'GPS tracking active',
            notificationColor: colours.cyan,
          },
        });
      } else {
        foregroundLocationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          recordLocation
        );
      }

      setIsTracking(true);
      setCurrentDistance(0);
      lastPointRef.current = toTrackPoint(firstPosition);
      setElapsedSeconds(0);
      setRoutePoints([toTrackPoint(firstPosition)]);
      setStartTime(new Date(firstPosition.timestamp));
    } catch (error) {
      console.error('Failed to start GPS tracking', error);
      stopTracking();
      Alert.alert('GPS unavailable', 'Unable to start GPS tracking on this device.');
    } finally {
      setIsStarting(false);
    }
  };

  const saveTrackedRuck = () => {
    if (!startTime) return;
    stopTracking();

    const duration = Math.max(1, (new Date().getTime() - startTime.getTime()) / (1000 * 60)); // minutes
    
    const loadFraction = weight / bodyWeightKg;
    const highLoadPenalty = loadFraction > 0.3 ? (loadFraction - 0.3) * 60 : 0;
    const baseScore = 95 - (weight * 0.5) - (currentDistance * 0.4);
    const terrainAdjusted = baseScore - ((terrainMultiplier - 1) * 30);
    const trackedScore = Math.max(55, Math.round((terrainAdjusted - highLoadPenalty) * calibrationFactor));

    const session: TrainingSession = {
      id: Date.now().toString(),
      type: 'Ruck',
      title: `${currentDistance.toFixed(1)}km GPS Ruck`,
      score: trackedScore,
      durationMinutes: Math.round(duration),
      rpe: weight > 22 ? 8 : 6,
      loadKg: weight,
      routePoints: routePoints.length > 0 ? routePoints : undefined,
    };
    addSession(session);
    Alert.alert('Ruck saved', 'Your GPS-tracked ruck has been logged.');
    setCurrentDistance(0);
    setElapsedSeconds(0);
    setRoutePoints([]);
    lastPointRef.current = null;
    setStartTime(null);
    AsyncStorage.removeItem('forge:ruck_route');
  };

  const discardTrackedRuck = () => {
    stopTracking();
    setCurrentDistance(0);
    setElapsedSeconds(0);
    setRoutePoints([]);
    lastPointRef.current = null;
    setStartTime(null);
    setFootCareChecked(false);
    AsyncStorage.removeItem('forge:ruck_route');
  };

  const pace = useMemo(() => (7.4 + weight / 25).toFixed(1), [weight]);
  const naismithMinutes = useMemo(
    () => Math.round(distance * 12 + plannedAscentM / 10),
    [distance, plannedAscentM]
  );
  const score = useMemo(
    () => {
      const loadFraction = weight / bodyWeightKg;
      const highLoadPenalty = loadFraction > 0.3 ? (loadFraction - 0.3) * 60 : 0;
      const baseScore = 95 - (weight * 0.5) - (distance * 0.4) - (plannedAscentM / 160);
      const terrainAdjusted = baseScore - ((terrainMultiplier - 1) * 30);
      const calibrated = (terrainAdjusted - highLoadPenalty) * calibrationFactor;
      return Math.max(55, Math.round(calibrated));
    },
    [weight, distance, plannedAscentM, terrainMultiplier, calibrationFactor]
  );
  const activePace = currentDistance > 0.02 ? (elapsedSeconds / 60 / currentDistance).toFixed(1) : '--';

  function changeWeight(amount: number) {
    setWeight((current) => Math.min(35, Math.max(5, current + amount)));
  }

  function changeDistance(amount: number) {
    setDistance((current) => Math.min(30, Math.max(2, current + amount)));
  }

  function changeAscent(amount: number) {
    setPlannedAscentM((current) => Math.min(2500, Math.max(0, current + amount)));
  }

  function saveRuck() {
    const session: TrainingSession = {
      id: Date.now().toString(),
      type: 'Ruck',
      title: `${distance}km Loaded Ruck`,
      score,
      durationMinutes: naismithMinutes,
      rpe: weight > 22 ? 8 : 6,
      loadKg: weight,
    };

    addSession(session);
    Alert.alert('Ruck saved', 'Your ruck session has been added to your training log.');
  }

  return (
    <Screen>
      <Text style={styles.muted}>Loaded movement</Text>
      <Text style={styles.title}>Ruck Tracker</Text>
      {!supportsBackgroundLocation && (
        <Text style={styles.platformNote}>Web tracking runs while this tab stays open. Use the native app for locked-screen GPS.</Text>
      )}

      <Card style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <View>
            <Text style={styles.mapLabel}>LIVE GPS</Text>
            <Text style={styles.mapText}>{isTracking ? 'Tracking active' : startTime ? 'Track paused' : 'Ready to acquire signal'}</Text>
          </View>
          <View style={[styles.signalBadge, isTracking && styles.signalBadgeLive]}>
            <View style={[styles.signalDot, isTracking && styles.signalDotLive]} />
            <Text style={[styles.signalText, isTracking && styles.signalTextLive]}>
              {isTracking ? 'LIVE' : 'IDLE'}
            </Text>
          </View>
        </View>

        <View style={styles.mapStage}>
          <View style={styles.mapGridHorizontal} />
          <View style={styles.mapGridVertical} />
          <View style={[styles.mapRing, styles.mapRingOuter]} />
          <View style={[styles.mapRing, styles.mapRingInner]} />

          {mapPoints.length === 0 ? (
            <View style={styles.mapEmpty}>
              <Ionicons name="navigate-circle-outline" size={42} color={colours.cyan} />
              <Text style={styles.mapEmptyText}>Start GPS to draw your route</Text>
            </View>
          ) : (
            mapPoints.map((point: TrackPoint & { x: number; y: number }, index: number) => {
              const isCurrent = index === mapPoints.length - 1;
              return (
                <View
                  key={`${point.timestamp}-${index}`}
                  style={[
                    styles.trailDot,
                    isCurrent && styles.currentDot,
                    { left: `${point.x}%`, top: `${point.y}%` },
                  ]}
                />
              );
            })
          )}
        </View>

        <View style={styles.liveStats}>
          <View style={styles.liveStat}>
            <Text style={styles.liveValue}>{currentDistance.toFixed(2)}</Text>
            <Text style={styles.liveLabel}>KM</Text>
          </View>
          <View style={styles.liveStat}>
            <Text style={styles.liveValue}>{formatElapsed(elapsedSeconds)}</Text>
            <Text style={styles.liveLabel}>TIME</Text>
          </View>
          <View style={styles.liveStat}>
            <Text style={styles.liveValue}>{activePace}</Text>
            <Text style={styles.liveLabel}>MIN/KM</Text>
          </View>
        </View>

        {currentPoint && (
          <Text style={styles.coordinateText}>
            {currentPoint.latitude.toFixed(5)}, {currentPoint.longitude.toFixed(5)}
            {currentPoint.accuracy ? ` · ±${Math.round(currentPoint.accuracy)}m` : ''}
          </Text>
        )}
      </Card>

      <View style={styles.trackingControls}>
        {isTracking ? (
          <View style={styles.trackingActive}>
            <Pressable style={[styles.trackButton, styles.stopButton]} onPress={stopTracking}>
              <Ionicons name="stop" size={20} color={colours.background} />
              <Text style={styles.trackButtonText}>Stop Tracking</Text>
            </Pressable>
          </View>
        ) : startTime ? (
          <View style={styles.trackingActive}>
            <Pressable style={styles.saveButton} onPress={saveTrackedRuck}>
              <Text style={styles.saveButtonText}>Save GPS Session</Text>
            </Pressable>
            <Pressable style={[styles.trackButton, styles.discardButton]} onPress={discardTrackedRuck}>
              <Ionicons name="close" size={20} color={colours.text} />
              <Text style={[styles.trackButtonText, { color: colours.text }]}>Discard</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.trackButton, isStarting && styles.trackButtonDisabled]}
            onPress={startTracking}
            disabled={isStarting}
          >
            <Ionicons name={isStarting ? 'sync' : 'play'} size={20} color={colours.background} />
            <Text style={styles.trackButtonText}>{isStarting ? 'Starting GPS...' : 'Start GPS Tracking'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        <MetricCard icon="barbell" label="Pack" value={`${weight}kg`} sub="ruck load" />
        <MetricCard icon="footsteps" label="Distance" value={`${distance}km`} sub={`${pace}/km est.`} tone={colours.amber} />
      </View>

      <View style={styles.grid}>
        <MetricCard icon="trail-sign" label="Naismith" value={formatDuration(naismithMinutes)} sub={`${distance}km + ${plannedAscentM}m ascent`} tone={colours.green} />
        <MetricCard icon="compass" label="Heading" value={activeHeading == null ? '--' : formatHeading(activeHeading)} sub={activeHeading == null ? 'compass standby' : cardinalDirection(activeHeading)} tone={colours.cyan} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Session Setup</Text>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Ruck Weight</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeWeight(-1)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{weight}kg</Text>
            <Pressable style={styles.smallButton} onPress={() => changeWeight(1)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Distance</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeDistance(-1)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{distance}km</Text>
            <Pressable style={styles.smallButton} onPress={() => changeDistance(1)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Ascent</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeAscent(-50)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{plannedAscentM}m</Text>
            <Pressable style={styles.smallButton} onPress={() => changeAscent(50)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Weather</Text>
          <View style={styles.pills}>
            {(['Hot', 'Mild', 'Cold', 'Wet'] as const).map(w => (
              <Pressable key={w} style={[styles.pill, weather === w && styles.pillActive]} onPress={() => setWeather(w)}>
                <Text style={[styles.pillText, weather === w && styles.pillTextActive]}>{w}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Terrain</Text>
          <View style={styles.pills}>
            {(['Pavement', 'Mixed', 'Sand', 'Heavy Brush'] as const).map(t => (
              <Pressable key={t} style={[styles.pill, terrain === t && styles.pillActive]} onPress={() => setTerrain(t)}>
                <Text style={[styles.pillText, terrain === t && styles.pillTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Calibrate Estimate</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => setCalibrationFactor(c => Math.max(0.8, c - 0.05))}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={[styles.controlValue, { fontSize: 13 }]}>{(calibrationFactor * 100).toFixed(0)}%</Text>
            <Pressable style={styles.smallButton} onPress={() => setCalibrationFactor(c => Math.min(1.2, c + 0.05))}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        {weight >= 20 && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={16} color={colours.amber} />
            <Text style={styles.warningText}>Heavy load. Ensure progressive overload and monitor recovery.</Text>
          </View>
        )}

        <Pressable style={styles.checklist} onPress={() => setFootCareChecked(!footCareChecked)}>
          <Ionicons name={footCareChecked ? 'checkbox' : 'square-outline'} size={22} color={footCareChecked ? colours.green : colours.muted} />
          <Text style={[styles.checklistText, footCareChecked && { color: colours.text }]}>Pre-ruck foot care complete (tape, dry socks, boots checked)</Text>
        </Pressable>
      </Card>

      <Card>
        <View style={styles.navHeader}>
          <View>
            <Text style={styles.cardTitle}>Navigation Guide</Text>
            <Text style={styles.muted}>Metric mountain planning</Text>
          </View>
          <View style={styles.compassDial}>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: rotationAnim.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="navigate" size={24} color={colours.background} />
            </Animated.View>
            <Text style={styles.compassText}>{activeHeading == null ? '---' : formatHeading(activeHeading)}</Text>
          </View>
        </View>
        <View style={styles.navGrid}>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{formatDuration(naismithMinutes)}</Text>
            <Text style={styles.navLabel}>Naismith time</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{plannedAscentM}m</Text>
            <Text style={styles.navLabel}>Total ascent</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{routeBearing == null ? '--' : formatHeading(routeBearing)}</Text>
            <Text style={styles.navLabel}>Route bearing</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{currentAltitude == null ? '--' : `${currentAltitude}m`}</Text>
            <Text style={styles.navLabel}>Altitude</Text>
          </View>
        </View>
        <Text style={styles.navGuide}>
          Naismith's Rule estimates 12 minutes per kilometre plus 10 minutes for every 100m of ascent. Add time for heavy load, rough ground, weather, stops, and navigation checks.
        </Text>
        <Text style={styles.navGuide}>
          Compass basics: set the map, take a bearing, follow the direction of travel arrow, tick off distance in metres, and re-check at every handrail, attack point, and junction.
        </Text>
      </Card>

      <Card style={{ backgroundColor: 'rgba(103,232,249,0.08)' }}>
        <Text style={styles.muted}>Projected session score</Text>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.muted}>
          LCDA-adjusted estimate. High-load fraction ({((weight / bodyWeightKg) * 100).toFixed(0)}% BW) and {terrain.toLowerCase()} terrain multipliers applied. Adjust calibration if HR/RPE indicates a different zone.
        </Text>
      </Card>

      <Pressable style={styles.primaryButton} onPress={saveRuck}>
        <Text style={styles.primaryButtonText}>Save Ruck Session</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colours.muted, fontSize: 13 },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: 16 },
  platformNote: { color: colours.amber, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 8 },
  mapCard: { backgroundColor: '#0F1F35' },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  mapLabel: { color: colours.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  mapText: { color: colours.text, fontWeight: '900', marginTop: 2 },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  signalBadgeLive: { borderColor: `${colours.green}55`, backgroundColor: colours.greenDim },
  signalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colours.muted },
  signalDotLive: { backgroundColor: colours.green },
  signalText: { color: colours.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  signalTextLive: { color: colours.green },
  mapStage: {
    height: 190,
    marginTop: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: 'rgba(4,8,15,0.72)',
    position: 'relative',
  },
  mapGridHorizontal: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(103,232,249,0.12)',
  },
  mapGridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(103,232,249,0.12)',
  },
  mapRing: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.10)',
  },
  mapRingOuter: { width: 170, height: 170, borderRadius: 85, top: 10 },
  mapRingInner: { width: 92, height: 92, borderRadius: 46, top: 49 },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mapEmptyText: { color: colours.muted, fontWeight: '700' },
  trailDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    marginLeft: -3,
    marginTop: -3,
    backgroundColor: colours.cyan,
    opacity: 0.72,
  },
  currentDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    marginTop: -8,
    opacity: 1,
    backgroundColor: colours.green,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  liveStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  liveStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  liveValue: { color: colours.cyan, fontSize: 18, fontWeight: '900' },
  liveLabel: { color: colours.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.3, marginTop: 2 },
  coordinateText: { color: colours.muted, fontSize: 11, textAlign: 'center', marginTop: 10 },
  trackingControls: { marginBottom: 16 },
  trackButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colours.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  trackButtonDisabled: { opacity: 0.62 },
  trackButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  stopButton: { backgroundColor: colours.red },
  trackingActive: { flexDirection: 'row', gap: 12 },
  saveButton: { backgroundColor: colours.cyan, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  saveButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  discardButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colours.border, borderWidth: 1 },
  grid: { flexDirection: 'row', gap: 12 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 12 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, gap: 12 },
  controlLabel: { color: colours.text, fontWeight: '800' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: colours.cyan, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#07111E', fontSize: 20, fontWeight: '900' },
  controlValue: { color: colours.text, fontWeight: '900', width: 55, textAlign: 'center' },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, marginLeft: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colours.borderSoft, backgroundColor: 'rgba(255,255,255,0.04)' },
  pillActive: { borderColor: colours.cyan, backgroundColor: colours.cyanDim },
  pillText: { fontSize: 11, fontWeight: '800', color: colours.muted },
  pillTextActive: { color: colours.cyan },
  checklist: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 12, borderWidth: 1, borderColor: colours.borderSoft },
  checklistText: { color: colours.muted, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
  warningBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: 12, backgroundColor: 'rgba(255,176,32,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,176,32,0.2)' },
  warningText: { color: colours.amber, fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  compassDial: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyan,
  },
  compassText: { color: colours.background, fontSize: 10, fontWeight: '900', marginTop: 1 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  navItem: {
    width: '47%',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  navValue: { color: colours.cyan, fontSize: 17, fontWeight: '900' },
  navLabel: { color: colours.muted, fontSize: 10, fontWeight: '900', marginTop: 3 },
  navGuide: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 12 },
  score: { color: colours.cyan, fontSize: 52, fontWeight: '900', marginVertical: 4 },
  primaryButton: { backgroundColor: colours.cyan, borderRadius: 22, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
