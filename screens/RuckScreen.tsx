import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Text, View, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours } from '../theme';
import { TrainingSession } from '../data/mockData';

export function RuckScreen({ addSession }: { addSession: (session: TrainingSession) => void }) {
  const [weight, setWeight] = useState(18);
  const [distance, setDistance] = useState(8);
  const [isTracking, setIsTracking] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastPosition = useRef<Location.LocationObject | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for GPS tracking.');
      }
    })();

    return () => {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
    };
  }, []);

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
  };

  const startTracking = async () => {
    if (isTracking) return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for GPS tracking.');
        return;
      }

      const subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (location) => {
          if (lastPosition.current) {
            const lat1 = lastPosition.current.coords.latitude;
            const lon1 = lastPosition.current.coords.longitude;
            const lat2 = location.coords.latitude;
            const lon2 = location.coords.longitude;
            const p = 0.017453292519943295; // Math.PI / 180
            const c = Math.cos;
            const a = 0.5 - c((lat2 - lat1) * p) / 2
              + c(lat1 * p) * c(lat2 * p)
              * (1 - c((lon2 - lon1) * p)) / 2;
            const distance = 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
            setCurrentDistance((prev) => prev + distance);
          }
          lastPosition.current = location;
        }
      );

      locationSubscription.current = subscription;
      setIsTracking(true);
      setCurrentDistance(0);
      setStartTime(new Date());
      lastPosition.current = null;
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
    };
    addSession(session);
    Alert.alert('Ruck saved', 'Your GPS-tracked ruck has been logged.');
    setCurrentDistance(0);
    setStartTime(null);
    lastPosition.current = null;
  };

  const discardTrackedRuck = () => {
    stopTracking();
    setCurrentDistance(0);
    setStartTime(null);
    lastPosition.current = null;
  };

  const pace = useMemo(() => (7.4 + weight / 25).toFixed(1), [weight]);
  const score = useMemo(() => Math.max(55, Math.round(95 - weight * 0.6 - distance * 0.4)), [weight, distance]);

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
        <Ionicons name="map" size={62} color={colours.cyan} />
        <Text style={styles.mapText}>GPS map placeholder</Text>
        <Text style={styles.muted}>Mixed terrain - elevation +120m</Text>
        {isTracking && (
          <Text style={styles.trackingText}>Tracking: {currentDistance.toFixed(2)}km</Text>
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
          <Pressable style={styles.trackButton} onPress={startTracking}>
            <Ionicons name="play" size={20} color={colours.background} />
            <Text style={styles.trackButtonText}>Start GPS Tracking</Text>
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
  mapCard: { height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1F35' },
  mapText: { color: colours.text, fontWeight: '900', marginTop: 8 },
  trackingText: { color: colours.cyan, fontSize: 16, fontWeight: '700', marginTop: 8 },
  trackingControls: { marginBottom: 16 },
  trackButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colours.green, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
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
