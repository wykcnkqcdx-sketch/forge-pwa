import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

type TrackPoint = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

function distanceBetween(a: TrackPoint, b: TrackPoint) {
  const p = 0.017453292519943295; // Math.PI / 180
  const c = Math.cos;
  const haversine = 0.5 - c((b.latitude - a.latitude) * p) / 2
    + c(a.latitude * p) * c(b.latitude * p)
    * (1 - c((b.longitude - a.longitude) * p)) / 2;

  return 12742 * Math.asin(Math.sqrt(haversine)); // 2 * R; R = 6371 km
}

function formatElapsed(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function toTrackPoint(location: Location.LocationObject): TrackPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

export function RuckScreen({ addSession }: { addSession: (session: TrainingSession) => void }) {
  const [weight, setWeight] = useState(18);
  const [distance, setDistance] = useState(8);
  const [isTracking, setIsTracking] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [routePoints, setRoutePoints] = useState<TrackPoint[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isTracking || !startTime) return undefined;

    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [isTracking, startTime]);

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
  };

  const startTracking = async () => {
    if (isTracking || isStarting) return;
    setIsStarting(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for GPS tracking.');
        return;
      }

      const recordPoint = (location: Location.LocationObject) => {
        const nextPoint = toTrackPoint(location);

        setRoutePoints((points) => {
          const previousPoint = points[points.length - 1];
          if (previousPoint) {
            setCurrentDistance((current) => current + distanceBetween(previousPoint, nextPoint));
          }

          return [...points, nextPoint].slice(-120);
        });
      };

      const firstPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      recordPoint(firstPosition);

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        recordPoint
      );

      locationSubscription.current = subscription;
      setIsTracking(true);
      setCurrentDistance(0);
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
    const session: TrainingSession = {
      id: Date.now().toString(),
      type: 'Ruck',
      title: `${currentDistance.toFixed(1)}km GPS Ruck`,
      score: Math.max(55, Math.round(95 - weight * 0.6 - currentDistance * 0.4)),
      durationMinutes: Math.round(duration),
      rpe: weight > 22 ? 8 : 6,
      loadKg: weight,
    };
    addSession(session);
    Alert.alert('Ruck saved', 'Your GPS-tracked ruck has been logged.');
    setCurrentDistance(0);
    setElapsedSeconds(0);
    setRoutePoints([]);
    setStartTime(null);
  };

  const discardTrackedRuck = () => {
    stopTracking();
    setCurrentDistance(0);
    setElapsedSeconds(0);
    setRoutePoints([]);
    setStartTime(null);
  };

  const pace = useMemo(() => (7.4 + weight / 25).toFixed(1), [weight]);
  const score = useMemo(() => Math.max(55, Math.round(95 - weight * 0.6 - distance * 0.4)), [weight, distance]);
  const activePace = currentDistance > 0.02 ? (elapsedSeconds / 60 / currentDistance).toFixed(1) : '--';
  const currentPoint = routePoints[routePoints.length - 1];
  const mapPoints = useMemo(() => {
    if (routePoints.length === 0) return [];

    const lats = routePoints.map((point) => point.latitude);
    const lons = routePoints.map((point) => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latRange = Math.max(maxLat - minLat, 0.0005);
    const lonRange = Math.max(maxLon - minLon, 0.0005);

    return routePoints.map((point) => ({
      ...point,
      x: 8 + ((point.longitude - minLon) / lonRange) * 84,
      y: 92 - ((point.latitude - minLat) / latRange) * 84,
    }));
  }, [routePoints]);

  function changeWeight(amount: number) {
    setWeight((current) => Math.min(35, Math.max(5, current + amount)));
  }

  function changeDistance(amount: number) {
    setDistance((current) => Math.min(30, Math.max(2, current + amount)));
  }

  function saveRuck() {
    const session: TrainingSession = {
      id: Date.now().toString(),
      type: 'Ruck',
      title: `${distance}km Loaded Ruck`,
      score,
      durationMinutes: Math.round(distance * Number(pace)),
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
            mapPoints.map((point, index) => {
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
  score: { color: colours.cyan, fontSize: 52, fontWeight: '900', marginVertical: 4 },
  primaryButton: { backgroundColor: colours.cyan, borderRadius: 22, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
