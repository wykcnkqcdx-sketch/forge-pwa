import React, { useCallback, useMemo, useState, useEffect, useRef, useReducer } from 'react';
import { Text, View, StyleSheet, Pressable, Alert, DeviceEventEmitter, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours, touchTarget } from '../theme';
import { TrainingSession, TrackPoint } from '../data/mockData';
import { getMapPoints, distanceBetween, bearingBetween } from '../utils/mapUtils';
import { calculateEnhancedPandolf } from '../lib/h2f';

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
const MAX_MAP_RENDER_POINTS = 160;
const MAX_MAP_SIMPLIFICATION_SOURCE_POINTS = 800;
const MAP_SIMPLIFICATION_TOLERANCE_METERS = 10;
const MAX_ACCEPTED_ACCURACY_METERS = 35;
const WEAK_ACCURACY_METERS = 20;
const MIN_MOVEMENT_METERS = 4;
const MAX_RUCK_SPEED_KPH = 12;

type TrackingStatus = 'idle' | 'starting' | 'tracking' | 'paused';

type TrackingState = {
  status: TrackingStatus;
  currentDistance: number;
  elapsedSeconds: number;
  routePoints: TrackPoint[];
  startTime: Date | null;
  rejectedPointCount: number;
  lastRejectedReason: string | null;
};

type TrackingAction =
  | { type: 'start_requested' }
  | { type: 'start_succeeded'; firstPoint: TrackPoint }
  | { type: 'restore'; points: TrackPoint[]; currentDistance: number; elapsedSeconds: number; isTracking: boolean; rejectedPointCount: number; lastRejectedReason: string | null }
  | { type: 'point_recorded'; point: TrackPoint }
  | { type: 'tick'; elapsedSeconds: number }
  | { type: 'stopped' }
  | { type: 'reset' };

const initialTrackingState: TrackingState = {
  status: 'idle',
  currentDistance: 0,
  elapsedSeconds: 0,
  routePoints: [],
  startTime: null,
  rejectedPointCount: 0,
  lastRejectedReason: null,
};

type RouteQualityResult =
  | { accepted: true; distanceKm: number }
  | { accepted: false; reason: string };

function evaluateRoutePoint(previousPoint: TrackPoint | undefined, point: TrackPoint): RouteQualityResult {
  if (point.accuracy != null && point.accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
    return { accepted: false, reason: 'poor accuracy' };
  }

  if (!previousPoint) return { accepted: true, distanceKm: 0 };
  if (previousPoint.timestamp === point.timestamp) return { accepted: false, reason: 'duplicate timestamp' };

  const distanceKm = distanceBetween(previousPoint, point);
  const distanceMeters = distanceKm * 1000;
  const elapsedHours = Math.max((point.timestamp - previousPoint.timestamp) / 3600000, 0);
  const speedKph = elapsedHours > 0 ? distanceKm / elapsedHours : 0;

  if (distanceMeters < MIN_MOVEMENT_METERS) return { accepted: false, reason: 'gps jitter' };
  if (speedKph > MAX_RUCK_SPEED_KPH) return { accepted: false, reason: 'speed spike' };

  return { accepted: true, distanceKm };
}

function sanitizeRoutePoints(points: TrackPoint[]) {
  let rejectedPointCount = 0;
  let lastRejectedReason: string | null = null;
  let currentDistance = 0;
  const routePoints: TrackPoint[] = [];

  points.forEach((point) => {
    const previousPoint = routePoints[routePoints.length - 1];
    const result = evaluateRoutePoint(previousPoint, point);
    if (!result.accepted) {
      rejectedPointCount += 1;
      lastRejectedReason = result.reason;
      return;
    }

    currentDistance += result.distanceKm;
    routePoints.push(point);
  });

  return { routePoints, currentDistance, rejectedPointCount, lastRejectedReason };
}

function trackingReducer(state: TrackingState, action: TrackingAction): TrackingState {
  switch (action.type) {
    case 'start_requested':
      return { ...state, status: 'starting' };

    case 'start_succeeded':
      return {
        status: 'tracking',
        currentDistance: 0,
        elapsedSeconds: 0,
        routePoints: [action.firstPoint],
        startTime: new Date(action.firstPoint.timestamp),
        rejectedPointCount: 0,
        lastRejectedReason: null,
      };

    case 'restore': {
      const startTime = action.points[0] ? new Date(action.points[0].timestamp) : null;
      return {
        status: action.isTracking ? 'tracking' : 'paused',
        currentDistance: action.currentDistance,
        elapsedSeconds: action.elapsedSeconds,
        routePoints: action.points,
        startTime,
        rejectedPointCount: action.rejectedPointCount,
        lastRejectedReason: action.lastRejectedReason,
      };
    }

    case 'point_recorded': {
      const previousPoint = state.routePoints[state.routePoints.length - 1];
      const result = evaluateRoutePoint(previousPoint, action.point);
      if (!result.accepted) {
        return {
          ...state,
          rejectedPointCount: state.rejectedPointCount + 1,
          lastRejectedReason: result.reason,
        };
      }

      return {
        ...state,
        currentDistance: state.currentDistance + result.distanceKm,
        routePoints: [...state.routePoints, action.point],
        lastRejectedReason: null,
      };
    }

    case 'tick':
      return { ...state, elapsedSeconds: action.elapsedSeconds };

    case 'stopped':
      return { ...state, status: state.startTime ? 'paused' : 'idle' };

    case 'reset':
      return initialTrackingState;

    default:
      return state;
  }
}

function limitRoutePoints(points: TrackPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;

  const stride = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * stride)]);
}

function projectPoint(point: Pick<TrackPoint, 'latitude' | 'longitude'>, origin: Pick<TrackPoint, 'latitude' | 'longitude'>) {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(origin.latitude * (Math.PI / 180));

  return {
    x: (point.longitude - origin.longitude) * metersPerDegreeLon,
    y: (point.latitude - origin.latitude) * metersPerDegreeLat,
  };
}

function perpendicularDistanceMeters(point: TrackPoint, start: TrackPoint, end: TrackPoint) {
  const projectedPoint = projectPoint(point, start);
  const projectedEnd = projectPoint(end, start);
  const segmentLengthSquared = projectedEnd.x ** 2 + projectedEnd.y ** 2;

  if (segmentLengthSquared === 0) return distanceBetween(point, start) * 1000;

  const t = Math.max(
    0,
    Math.min(1, (projectedPoint.x * projectedEnd.x + projectedPoint.y * projectedEnd.y) / segmentLengthSquared)
  );
  const closest = {
    x: t * projectedEnd.x,
    y: t * projectedEnd.y,
  };

  return Math.hypot(projectedPoint.x - closest.x, projectedPoint.y - closest.y);
}

function simplifyRoute(points: TrackPoint[], toleranceMeters: number): TrackPoint[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let splitIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistanceMeters(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }

  if (maxDistance <= toleranceMeters) return [start, end];

  const beforeSplit = simplifyRoute(points.slice(0, splitIndex + 1), toleranceMeters);
  const afterSplit = simplifyRoute(points.slice(splitIndex), toleranceMeters);
  return [...beforeSplit.slice(0, -1), ...afterSplit];
}

function decimateRouteForMap(points: TrackPoint[]) {
  const sourcePoints = limitRoutePoints(points, MAX_MAP_SIMPLIFICATION_SOURCE_POINTS);
  const simplifiedPoints = simplifyRoute(sourcePoints, MAP_SIMPLIFICATION_TOLERANCE_METERS);
  return limitRoutePoints(simplifiedPoints, MAX_MAP_RENDER_POINTS);
}

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
  const [bodyMassKg, setBodyMassKg] = useState(82);
  const [distance, setDistance] = useState(8);
  const [plannedAscentM, setPlannedAscentM] = useState(300);
  const [terrainFactor, setTerrainFactor] = useState(1.2);
  const [trackingState, dispatchTracking] = useReducer(trackingReducer, initialTrackingState);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const foregroundLocationSubscription = useRef<Location.LocationSubscription | null>(null);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const prevHeading = useRef(0);
  const { currentDistance, elapsedSeconds, routePoints, startTime, status, rejectedPointCount, lastRejectedReason } = trackingState;
  const isTracking = status === 'tracking';
  const isStarting = status === 'starting';

  const currentPoint = routePoints[routePoints.length - 1];
  const previousPoint = routePoints[routePoints.length - 2];
  const routeBearing = previousPoint && currentPoint ? Math.round(bearingBetween(previousPoint, currentPoint)) : null;
  const activeHeading = compassHeading ?? routeBearing;
  const currentAltitude = currentPoint?.altitude != null ? Math.round(currentPoint.altitude) : null;
  const mapPoints = useMemo(() => getMapPoints(decimateRouteForMap(routePoints)), [routePoints]);
  const routeLinePoints = useMemo(() => mapPoints.map((point) => `${point.x},${point.y}`).join(' '), [mapPoints]);
  const firstMapPoint = mapPoints[0];
  const lastMapPoint = mapPoints[mapPoints.length - 1];
  const gpsQuality = useMemo(() => {
    if (!currentPoint) return { label: 'IDLE', tone: colours.muted, detail: 'awaiting fix' };
    if (currentPoint.accuracy == null) return { label: 'GOOD', tone: colours.green, detail: 'accuracy unknown' };
    if (currentPoint.accuracy <= WEAK_ACCURACY_METERS) return { label: 'GOOD', tone: colours.green, detail: `±${Math.round(currentPoint.accuracy)}m` };
    return { label: 'WEAK', tone: colours.amber, detail: `±${Math.round(currentPoint.accuracy)}m` };
  }, [currentPoint]);

  const recordLocation = useCallback((location: Location.LocationObject) => {
    const nextPoint = toTrackPoint(location);
    dispatchTracking({ type: 'point_recorded', point: nextPoint });
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
            const sanitized = sanitizeRoutePoints(points);

            const start = new Date(sanitized.routePoints[0]?.timestamp ?? points[0].timestamp);
            const restoredElapsedSeconds = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
            let restoredIsTracking = false;

            if (supportsBackgroundLocation) {
              const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
              restoredIsTracking = hasStarted;
            }

            dispatchTracking({
              type: 'restore',
              points: sanitized.routePoints,
              currentDistance: sanitized.currentDistance,
              elapsedSeconds: restoredElapsedSeconds,
              isTracking: restoredIsTracking,
              rejectedPointCount: sanitized.rejectedPointCount,
              lastRejectedReason: sanitized.lastRejectedReason,
            });
          }
        }
      } catch (e) {
        console.error('Failed to restore ruck session', e);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    Location.watchHeadingAsync((heading) => {
      const nextHeading = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
      if (nextHeading >= 0) setCompassHeading(Math.round(nextHeading));
    }).then((subscription) => {
      headingSubscription.current = subscription;
    }).catch((error) => {
      console.warn('Compass heading unavailable', error);
    });

    return () => {
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
    if (!startTime || routePoints.length === 0) return;
    AsyncStorage.setItem('forge:ruck_route', JSON.stringify(routePoints)).catch((error) => {
      console.error('Failed to persist filtered ruck route', error);
    });
  }, [routePoints, startTime]);

  useEffect(() => {
    if (!isTracking || !startTime) return undefined;

    const timer = setInterval(() => {
      dispatchTracking({
        type: 'tick',
        elapsedSeconds: Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)),
      });
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
    dispatchTracking({ type: 'stopped' });
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
    if (isTracking || isStarting) return;
    dispatchTracking({ type: 'start_requested' });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for GPS tracking.');
        dispatchTracking({ type: 'stopped' });
        return;
      }

      const firstPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const firstPoint = toTrackPoint(firstPosition);

      await AsyncStorage.setItem('forge:ruck_route', JSON.stringify([firstPoint]));

      if (supportsBackgroundLocation) {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          Alert.alert('Permission denied', 'Background location permission is required for locked-screen tracking.');
          dispatchTracking({ type: 'stopped' });
          return;
        }

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
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

      dispatchTracking({ type: 'start_succeeded', firstPoint });
    } catch (error) {
      console.error('Failed to start GPS tracking', error);
      stopTracking();
      Alert.alert('GPS unavailable', 'Unable to start GPS tracking on this device.');
    }
  };

  const saveTrackedRuck = () => {
    if (!startTime) return;
    stopTracking();

    const duration = Math.max(1, (new Date().getTime() - startTime.getTime()) / (1000 * 60)); // minutes
    const session: TrainingSession = {
      id: Date.now().toString(),
      type: 'Ruck',
      title: `${currentDistance.toFixed(1)}km GPS Ruck`,
      score: Math.max(55, Math.round(95 - weight * 0.6 - currentDistance * 0.4)),
      durationMinutes: Math.round(duration),
      rpe: weight > 22 ? 8 : 6,
      loadKg: weight,
      routePoints: routePoints.length > 0 ? routePoints : undefined,
      completedAt: new Date().toISOString(),
    };
    addSession(session);
    Alert.alert('Ruck saved', 'Your GPS-tracked ruck has been logged.');
    dispatchTracking({ type: 'reset' });
    AsyncStorage.removeItem('forge:ruck_route');
  };

  const discardTrackedRuck = () => {
    stopTracking();
    dispatchTracking({ type: 'reset' });
    AsyncStorage.removeItem('forge:ruck_route');
  };

  const speedKph = useMemo(() => Math.max(3.2, Math.min(7.2, 60 / (7.4 + weight / 25))), [weight]);
  const gradePercent = useMemo(() => (distance > 0 ? (plannedAscentM / (distance * 1000)) * 100 : 0), [distance, plannedAscentM]);
  const pandolf = useMemo(
    () => calculateEnhancedPandolf({ bodyMassKg, loadKg: weight, speedKph, gradePercent, terrainFactor }),
    [bodyMassKg, weight, speedKph, gradePercent, terrainFactor]
  );
  const pace = useMemo(() => (60 / speedKph).toFixed(1), [speedKph]);
  const naismithMinutes = useMemo(
    () => Math.round(distance * 12 + plannedAscentM / 10),
    [distance, plannedAscentM]
  );
  const score = useMemo(
    () => Math.max(55, Math.round(95 - weight * 0.6 - distance * 0.4 - plannedAscentM / 160)),
    [weight, distance, plannedAscentM]
  );
  const activePace = currentDistance > 0.02 ? (elapsedSeconds / 60 / currentDistance).toFixed(1) : '--';

  function changeWeight(amount: number) {
    setWeight((current) => Math.min(35, Math.max(5, current + amount)));
  }

  function changeBodyMass(amount: number) {
    setBodyMassKg((current) => Math.min(140, Math.max(45, current + amount)));
  }

  function changeDistance(amount: number) {
    setDistance((current) => Math.min(30, Math.max(2, current + amount)));
  }

  function changeAscent(amount: number) {
    setPlannedAscentM((current) => Math.min(2500, Math.max(0, current + amount)));
  }

  function changeTerrain(amount: number) {
    setTerrainFactor((current) => Math.round(Math.min(2.2, Math.max(1, current + amount)) * 10) / 10);
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
      completedAt: new Date().toISOString(),
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
            <Text style={styles.mapSubText}>
              {gpsQuality.detail}
              {rejectedPointCount > 0 ? ` · ${rejectedPointCount} rejected${lastRejectedReason ? ` (${lastRejectedReason})` : ''}` : ''}
            </Text>
          </View>
          <View style={[styles.signalBadge, { borderColor: `${gpsQuality.tone}55`, backgroundColor: `${gpsQuality.tone}14` }]}>
            <View style={[styles.signalDot, { backgroundColor: gpsQuality.tone }]} />
            <Text style={[styles.signalText, { color: gpsQuality.tone }]}>
              {isTracking ? gpsQuality.label : 'IDLE'}
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
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none" pointerEvents="none">
              {routeLinePoints && (
                <Polyline
                  points={routeLinePoints}
                  fill="none"
                  stroke={colours.cyan}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.82}
                />
              )}
              {firstMapPoint && (
                <Circle
                  cx={firstMapPoint.x}
                  cy={firstMapPoint.y}
                  r={1.8}
                  fill={colours.background}
                  stroke={colours.cyan}
                  strokeWidth={0.8}
                />
              )}
              {lastMapPoint && (
                <Circle
                  cx={lastMapPoint.x}
                  cy={lastMapPoint.y}
                  r={3}
                  fill={colours.green}
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth={1}
                />
              )}
            </Svg>
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
        <MetricCard icon="footsteps" label="Loaded" value={`${Math.round(distance * weight)}`} sub={`kg-km | ${pace}/km`} tone={colours.amber} />
      </View>

      <View style={styles.grid}>
        <MetricCard icon="trail-sign" label="Pandolf" value={`${pandolf.wattsCorrected}W`} sub={`${pandolf.metabolicCostKcalHour} kcal/hr`} tone={colours.green} />
        <MetricCard icon="compass" label="Heading" value={activeHeading == null ? '--' : formatHeading(activeHeading)} sub={activeHeading == null ? 'compass standby' : cardinalDirection(activeHeading)} tone={colours.cyan} />
      </View>

      <Card>
        <Text style={styles.cardTitle}>Session Setup</Text>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Body Mass</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeBodyMass(-1)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{bodyMassKg}kg</Text>
            <Pressable style={styles.smallButton} onPress={() => changeBodyMass(1)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

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
          <Text style={styles.controlLabel}>Terrain Factor</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeTerrain(-0.1)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{terrainFactor.toFixed(1)}x</Text>
            <Pressable style={styles.smallButton} onPress={() => changeTerrain(0.1)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <Card accent={colours.cyan}>
        <Text style={styles.cardTitle}>Enhanced Pandolf Load Model</Text>
        <View style={styles.navGrid}>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{pandolf.watts}W</Text>
            <Text style={styles.navLabel}>raw cost</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{pandolf.wattsCorrected}W</Text>
            <Text style={styles.navLabel}>+27% heavy-load correction</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{pandolf.loadRatio}</Text>
            <Text style={styles.navLabel}>load/body ratio</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{Math.round(distance * weight)}</Text>
            <Text style={styles.navLabel}>planned kg-km</Text>
          </View>
        </View>
        <Text style={styles.navGuide}>
          Model uses body mass, carried load, speed, grade, and terrain. The heavy-load correction applies when load reaches 27% of body mass.
        </Text>
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
          Naismith's Rule remains a navigation cross-check; Enhanced Pandolf drives metabolic load because it accounts for body mass, external load, grade, speed, and terrain.
        </Text>
        <Text style={styles.navGuide}>
          Compass basics: set the map, take a bearing, follow the direction of travel arrow, tick off distance in metres, and re-check at every handrail, attack point, and junction.
        </Text>
      </Card>

      <Card style={{ backgroundColor: 'rgba(103,232,249,0.08)' }}>
        <Text style={styles.muted}>Projected session score</Text>
        <Text style={styles.score}>{score}</Text>
        <Text style={styles.muted}>
          Higher distance and heavier load increase training stress. This is a planning estimate, not medical advice.
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
  mapSubText: { color: colours.muted, fontSize: 11, fontWeight: '800', marginTop: 3 },
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
  signalDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colours.muted },
  signalText: { color: colours.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
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
  trackButton: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colours.green, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  trackButtonDisabled: { opacity: 0.62 },
  trackButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  stopButton: { backgroundColor: colours.red },
  trackingActive: { flexDirection: 'row', gap: 12 },
  saveButton: { minHeight: touchTarget, backgroundColor: colours.cyan, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  saveButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  discardButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colours.border, borderWidth: 1 },
  grid: { flexDirection: 'row', gap: 12 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: 12 },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, gap: 12 },
  controlLabel: { color: colours.text, fontWeight: '800' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { width: touchTarget, height: touchTarget, borderRadius: 8, backgroundColor: colours.cyan, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#07111E', fontSize: 20, fontWeight: '900' },
  controlValue: { color: colours.text, fontWeight: '900', width: 55, textAlign: 'center' },
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
  primaryButton: { minHeight: touchTarget, backgroundColor: colours.cyan, borderRadius: 8, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
