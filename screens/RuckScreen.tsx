import React, { useCallback, useMemo, useState, useEffect, useRef, useReducer } from 'react';
import { Text, View, StyleSheet, Pressable, DeviceEventEmitter, Animated, Platform, TextInput, SafeAreaView, PanResponder, StyleProp, TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Screen } from '../components/Screen';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { colours, touchTarget, shadow, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';
import { showAlert, showConfirm } from '../lib/dialogs';
import { TrainingSession, TrackPoint } from '../data/mockData';
import type { RuckCheckpoint, RuckMissionPlan, RuckSplit } from '../data/domain';
import { distanceBetween, bearingBetween } from '../utils/mapUtils';
import { decimateRouteForMap, evaluateRoutePoint, sanitizeRoutePoints, WEAK_ACCURACY_METERS } from '../utils/routeQuality';
import { CoordinateFormat, coordinateFormatOptions, formatCoordinate, parseCoordinate } from '../utils/coordinates';
import { buildVisibleTiles, getMercatorRoutePoints, latLonToWorldPixel, MapLayerKey, mapLayerOptions, MapViewport, worldPixelToLatLon } from '../utils/mapTiles';
import { appendActiveRoutePoints, clearActiveRoute, clearActiveRuckPlan, loadActiveRoute, loadActiveRuckPlan, replaceActiveRoute, resetActiveRoute, saveActiveRuckPlan } from '../lib/ruckRouteStore';
import { calculateEnhancedPandolf } from '../lib/h2f';
import { secureGetItem, secureSetItem } from '../lib/secureStorage';
import { LOCATION_TASK_NAME } from '../lib/backgroundTasks';

function formatElapsed(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function sessionTime(session: TrainingSession) {
  return session.completedAt ? new Date(session.completedAt).getTime() : Number(session.id) || 0;
}

function formatSessionDate(session: TrainingSession) {
  if (!session.completedAt) return 'Date unknown';
  return new Date(session.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function estimateRuckSessionDistanceKm(session: TrainingSession) {
  if (session.routePoints && session.routePoints.length > 1) {
    return session.routePoints.slice(1).reduce((total, point, index) => (
      total + distanceBetween(session.routePoints![index], point)
    ), 0);
  }

  const titleMatch = session.title.match(/([\d.]+)\s*km/i);
  if (titleMatch) return Number(titleMatch[1]);
  return session.ruckMission?.targetDistanceKm ?? 0;
}

function formatDuration(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs <= 0) return `${mins} min`;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function formatSignedMinutes(minutes: number) {
  const rounded = Math.round(minutes);
  if (rounded === 0) return 'On time';
  return `${Math.abs(rounded)} min ${rounded > 0 ? 'behind' : 'ahead'}`;
}

function cardinalDirection(degrees: number) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(degrees / 45) % labels.length];
}

function formatHeading(degrees: number) {
  return `${String(Math.round(degrees)).padStart(3, '0')}deg`;
}

function headingDifferenceDegrees(current: number, target: number) {
  return ((target - current + 540) % 360) - 180;
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

const supportsBackgroundLocation = Platform.OS !== 'web';
const CHECKPOINT_ARRIVAL_RADIUS_METERS = 50;
const BEARING_CAUTION_DEGREES = 20;
const BEARING_OFF_DEGREES = 45;
type TrackingStatus = 'idle' | 'starting' | 'tracking' | 'paused';
type FinishMode = 'target' | 'finalCheckpoint' | 'selectedCheckpoint';

type RuckTemplate = {
  id: string;
  label: string;
  detail: string;
  targetDistanceKm: number;
  targetMinutes: number;
  checkpointIntervalKm: number;
  finishMode: FinishMode;
  checkpointLabels: string[];
  checkpoints?: RuckCheckpoint[];
  custom?: boolean;
};

const ruckTemplates: RuckTemplate[] = [
  {
    id: 'assessment',
    label: 'Fitness Assessment',
    detail: '12 mile / 19.3km standard',
    targetDistanceKm: 19.3,
    targetMinutes: 180,
    checkpointIntervalKm: 4.8,
    finishMode: 'target',
    checkpointLabels: ['Start', '3 Mile', '6 Mile', '9 Mile', 'Finish'],
  },
  {
    id: 'navigation',
    label: 'Navigation Practice',
    detail: 'checkpoint-led route',
    targetDistanceKm: 8,
    targetMinutes: 120,
    checkpointIntervalKm: 2,
    finishMode: 'finalCheckpoint',
    checkpointLabels: ['Start', 'CP 1', 'CP 2', 'CP 3', 'Finish'],
  },
  {
    id: 'loaded',
    label: 'Loaded Training',
    detail: 'pace and split focused',
    targetDistanceKm: 8,
    targetMinutes: 105,
    checkpointIntervalKm: 2,
    finishMode: 'target',
    checkpointLabels: [],
  },
  {
    id: 'patrol',
    label: 'Patrol Route',
    detail: 'RV and finish control',
    targetDistanceKm: 10,
    targetMinutes: 150,
    checkpointIntervalKm: 2.5,
    finishMode: 'finalCheckpoint',
    checkpointLabels: ['Start', 'RV 1', 'RV 2', 'RV 3', 'Finish'],
  },
];

const CUSTOM_RUCK_TEMPLATES_KEY = 'forge:ruck_templates';

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
  | { type: 'resume_requested' }
  | { type: 'resume_succeeded' }
  | { type: 'restore'; points: TrackPoint[]; currentDistance: number; elapsedSeconds: number; isTracking: boolean; rejectedPointCount: number; lastRejectedReason: string | null }
  | { type: 'point_recorded'; point: TrackPoint }
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

function trackingReducer(state: TrackingState, action: TrackingAction): TrackingState {
  switch (action.type) {
    case 'start_requested':
      return { ...state, status: 'starting' };

    case 'resume_requested':
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

    case 'resume_succeeded':
      return {
        ...state,
        status: 'tracking',
        startTime: new Date(Date.now() - state.elapsedSeconds * 1000),
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
      if (state.routePoints.length === 0) {
        return {
          ...state,
          routePoints: [action.point],
          startTime: state.startTime ?? new Date(action.point.timestamp),
        };
      }
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
        elapsedSeconds: state.startTime ? Math.max(0, Math.floor((action.point.timestamp - state.startTime.getTime()) / 1000)) : state.elapsedSeconds,
      };
    }

    case 'stopped':
      return { 
        ...state, 
        status: state.startTime ? 'paused' : 'idle',
        elapsedSeconds: state.startTime && state.status === 'tracking' ? Math.max(0, Math.floor((Date.now() - state.startTime.getTime()) / 1000)) : state.elapsedSeconds 
      };

    case 'reset':
      return initialTrackingState;

    default:
      return state;
  }
}

function LiveTimerText({ startTime, isTracking, staticSeconds, style }: { startTime: Date | null; isTracking: boolean; staticSeconds: number; style: StyleProp<TextStyle> }) {
  const [elapsed, setElapsed] = useState(staticSeconds);

  useEffect(() => {
    if (!isTracking || !startTime) {
      setElapsed(staticSeconds);
      return;
    }
    setElapsed(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)));
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [isTracking, startTime, staticSeconds]);

  return <Text style={style}>{formatElapsed(elapsed)}</Text>;
}

export function RuckScreen({
  addSession,
  sessions = [],
}: {
  addSession: (session: TrainingSession) => void;
  sessions?: TrainingSession[];
}) {
  const [weight, setWeight] = useState(18);
  const [bodyMassKg, setBodyMassKg] = useState(82);
  const [distance, setDistance] = useState(8);
  const [plannedAscentM, setPlannedAscentM] = useState(300);
  const [terrainFactor, setTerrainFactor] = useState(1.2);
  const [trackingState, dispatchTracking] = useReducer(trackingReducer, initialTrackingState);
  const [coordinateFormat, setCoordinateFormat] = useState<CoordinateFormat>('mgrs');
  const [mapLayer, setMapLayer] = useState<MapLayerKey>('topo');
  const [mapViewport, setMapViewport] = useState<MapViewport>({ width: 0, height: 0 });
  const [mapZoom, setMapZoom] = useState(15);
  const [mapCenter, setMapCenter] = useState<TrackPoint | null>(null);
  const [isPanning, setIsPanning] = useState(false);
const [gpsFollowMode, setGpsFollowMode] = useState(true); // true = follow GPS, false = pan free
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapNorthUp, setMapNorthUp] = useState(true);
  const [targetDistanceKm, setTargetDistanceKm] = useState(8);
  const [targetMinutes, setTargetMinutes] = useState(105);
  const [checkpointIntervalKm, setCheckpointIntervalKm] = useState(2);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [plannedCheckpoints, setPlannedCheckpoints] = useState<RuckCheckpoint[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [checkpointCoordinateInput, setCheckpointCoordinateInput] = useState('');
  const [checkpointLabelInput, setCheckpointLabelInput] = useState('');
  const [checkpointBulkInput, setCheckpointBulkInput] = useState('');
  const [finishMode, setFinishMode] = useState<FinishMode>('target');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<RuckTemplate[]>([]);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [planRestored, setPlanRestored] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ruckReviewNote, setRuckReviewNote] = useState('');
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const foregroundLocationSubscription = useRef<Location.LocationSubscription | null>(null);
  const announcedCheckpointArrivals = useRef<Set<string>>(new Set());
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const prevHeading = useRef(0);
  const { currentDistance, elapsedSeconds, routePoints, startTime, status, rejectedPointCount, lastRejectedReason } = trackingState;
  const isTracking = status === 'tracking';
  const isStarting = status === 'starting';
  const allRuckTemplates = useMemo(() => [...ruckTemplates, ...customTemplates], [customTemplates]);
  const ruckHistory = useMemo(
    () => sessions.filter((session) => session.type === 'Ruck').sort((a, b) => sessionTime(b) - sessionTime(a)).slice(0, 6),
    [sessions]
  );
  const selectedHistoryRuck = ruckHistory.find((session) => session.id === selectedHistoryId) ?? ruckHistory[0];

  const currentPoint = routePoints[routePoints.length - 1];
  const effectiveMapCenter = mapCenter ?? currentPoint;
  const currentCoordinate = currentPoint
    ? formatCoordinate(currentPoint.latitude, currentPoint.longitude, coordinateFormat)
    : null;
  const mapCenterCoordinate = effectiveMapCenter
    ? formatCoordinate(effectiveMapCenter.latitude, effectiveMapCenter.longitude, coordinateFormat)
    : null;
  const previousPoint = routePoints[routePoints.length - 2];
  const routeBearing = previousPoint && currentPoint ? Math.round(bearingBetween(previousPoint, currentPoint)) : null;
  const activeHeading = compassHeading ?? routeBearing;
  const currentAltitude = currentPoint?.altitude != null ? Math.round(currentPoint.altitude) : null;
  const displayRoutePoints = useMemo(() => decimateRouteForMap(routePoints), [routePoints]);

  // When rotating, the viewport must be oversized to fill the corners
  const renderViewport = useMemo(() => {
    const maxDim = Math.max(mapViewport.width, mapViewport.height) * 1.5;
    return { width: maxDim, height: maxDim };
  }, [mapViewport]);

  const mapPoints = useMemo(
    () => getMercatorRoutePoints(displayRoutePoints, effectiveMapCenter, renderViewport, mapZoom),
    [displayRoutePoints, effectiveMapCenter, renderViewport, mapZoom]
  );
  const placedCheckpoints = useMemo(
    () => plannedCheckpoints.filter((checkpoint): checkpoint is RuckCheckpoint & TrackPoint => (
      checkpoint.latitude != null && checkpoint.longitude != null
    )),
    [plannedCheckpoints]
  );
  const checkpointMapPoints = useMemo(
    () => getMercatorRoutePoints(placedCheckpoints, effectiveMapCenter, renderViewport, mapZoom),
    [effectiveMapCenter, renderViewport, placedCheckpoints, mapZoom]
  );
  const mapTiles = useMemo(
    () => buildVisibleTiles(effectiveMapCenter, renderViewport, mapLayer, mapZoom),
    [effectiveMapCenter, mapLayer, renderViewport, mapZoom]
  );
  const activeMapLayer = mapLayerOptions.find((option) => option.key === mapLayer) ?? mapLayerOptions[0];
  const routeLinePoints = useMemo(() => mapPoints.map((point) => `${point.x},${point.y}`).join(' '), [mapPoints]);
  const firstMapPoint = mapPoints[0];
  const lastMapPoint = mapPoints[mapPoints.length - 1];
  const hasActiveGpsSession = startTime != null;
  const showExpandedMap = hasActiveGpsSession || mapExpanded;
  const displayBearing = routeBearing ?? activeHeading;
  const displayHeading = activeHeading ?? routeBearing;
  const gpsQuality = useMemo(() => {
    if (!currentPoint) return { label: 'IDLE', tone: colours.muted, detail: 'awaiting fix' };
    if (currentPoint.accuracy == null) return { label: 'GOOD', tone: colours.green, detail: 'accuracy unknown' };
    if (currentPoint.accuracy <= WEAK_ACCURACY_METERS) return { label: 'GOOD', tone: colours.green, detail: `+/-${Math.round(currentPoint.accuracy)}m` };
    return { label: 'WEAK', tone: colours.amber, detail: `+/-${Math.round(currentPoint.accuracy)}m` };
  }, [currentPoint]);
  const trackingStatus = useMemo(() => {
    if (isStarting) {
      return {
        label: 'ACQUIRING GPS',
        detail: 'Allow location access and wait for the first fix.',
        tone: colours.amber,
      };
    }
    if (isTracking) {
      return {
        label: gpsQuality.label === 'WEAK' ? 'WEAK SIGNAL' : 'TRACKING',
        detail: supportsBackgroundLocation
          ? 'GPS active. Background tracking depends on device permission.'
          : 'Web tracking active. Keep this tab open.',
        tone: gpsQuality.label === 'WEAK' ? colours.amber : colours.green,
      };
    }
    if (startTime) {
      return {
        label: 'PAUSED',
        detail: 'Save, resume, or discard this ruck.',
        tone: colours.amber,
      };
    }
    return {
      label: 'READY',
      detail: supportsBackgroundLocation
        ? 'GPS uses more battery during tracking.'
        : 'GPS uses more battery and only tracks while this tab stays open.',
      tone: colours.cyan,
    };
  }, [gpsQuality.label, isStarting, isTracking, startTime, supportsBackgroundLocation]);
  const targetPace = useMemo(() => targetMinutes / Math.max(0.1, targetDistanceKm), [targetDistanceKm, targetMinutes]);
  const targetPaceLabel = `${targetPace.toFixed(1)}/km`;
  const targetProjectedMinutes = currentDistance > 0.02 && elapsedSeconds > 0
    ? (elapsedSeconds / 60 / currentDistance) * targetDistanceKm
    : null;
  const targetDeltaMinutes = currentDistance > 0.02 ? elapsedSeconds / 60 - currentDistance * targetPace : 0;
  const targetRemainingKm = Math.max(0, targetDistanceKm - currentDistance);
  const targetEtaMinutes = currentDistance > 0.02 && elapsedSeconds > 0
    ? targetRemainingKm * (elapsedSeconds / 60 / currentDistance)
    : targetRemainingKm * targetPace;
  const checkpointCount = Math.max(1, Math.ceil(targetDistanceKm / checkpointIntervalKm));
  const nextCheckpointIndex = Math.min(checkpointCount, checkpointIndex + 1);
  const nextCheckpointKm = Math.min(targetDistanceKm, nextCheckpointIndex * checkpointIntervalKm);
  const checkpointRemainingKm = Math.max(0, nextCheckpointKm - currentDistance);
  const checkpointEtaMinutes = currentDistance > 0.02 && elapsedSeconds > 0
    ? checkpointRemainingKm * (elapsedSeconds / 60 / currentDistance)
    : checkpointRemainingKm * targetPace;
  const checkpointStatus = checkpointIndex >= checkpointCount
    ? 'All checkpoints complete'
    : `CP ${nextCheckpointIndex}/${checkpointCount}`;
  const selectedCheckpoint = plannedCheckpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? plannedCheckpoints[0] ?? null;
  const selectedCheckpointPlaced = selectedCheckpoint?.latitude != null && selectedCheckpoint.longitude != null;
  const selectedCheckpointPoint = selectedCheckpointPlaced ? selectedCheckpoint as RuckCheckpoint & TrackPoint : null;
  const selectedCheckpointDistanceKm = currentPoint && selectedCheckpointPoint ? distanceBetween(currentPoint, selectedCheckpointPoint) : null;
  const selectedCheckpointBearing = currentPoint && selectedCheckpointPoint ? Math.round(bearingBetween(currentPoint, selectedCheckpointPoint)) : null;
  const selectedCheckpointEtaMinutes = selectedCheckpointDistanceKm == null
    ? null
    : selectedCheckpointDistanceKm * (currentDistance > 0.02 && elapsedSeconds > 0 ? elapsedSeconds / 60 / currentDistance : targetPace);
  const bearingGuidance = useMemo(() => {
    if (!selectedCheckpoint || selectedCheckpointBearing == null) {
      return { label: 'NO CP', detail: 'select checkpoint', tone: colours.muted };
    }
    if (selectedCheckpointDistanceKm != null && selectedCheckpointDistanceKm * 1000 <= CHECKPOINT_ARRIVAL_RADIUS_METERS) {
      return { label: 'ARRIVED', detail: selectedCheckpoint.label, tone: colours.green };
    }
    if (activeHeading == null) {
      return { label: 'NO HDG', detail: 'compass standby', tone: colours.muted };
    }

    const delta = headingDifferenceDegrees(activeHeading, selectedCheckpointBearing);
    const absoluteDelta = Math.abs(delta);
    if (absoluteDelta <= BEARING_CAUTION_DEGREES) {
      return { label: 'ON BEARING', detail: `${formatHeading(selectedCheckpointBearing)} to ${selectedCheckpoint.label}`, tone: colours.green };
    }
    if (absoluteDelta <= BEARING_OFF_DEGREES) {
      return {
        label: delta > 0 ? 'CHECK RIGHT' : 'CHECK LEFT',
        detail: `${Math.round(absoluteDelta)}deg off ${formatHeading(selectedCheckpointBearing)}`,
        tone: colours.amber,
      };
    }
    return {
      label: 'OFF BEARING',
      detail: `${Math.round(absoluteDelta)}deg off ${formatHeading(selectedCheckpointBearing)}`,
      tone: colours.red,
    };
  }, [activeHeading, selectedCheckpoint, selectedCheckpointBearing, selectedCheckpointDistanceKm]);
  const nearestCheckpoint = useMemo(() => {
    if (!currentPoint || plannedCheckpoints.length === 0) return null;

    return placedCheckpoints
      .filter((checkpoint) => checkpoint.status !== 'skipped')
      .map((checkpoint) => ({
        checkpoint,
        distanceKm: distanceBetween(currentPoint, checkpoint),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
  }, [currentPoint, placedCheckpoints]);
  const arrivalCheckpoint = nearestCheckpoint && nearestCheckpoint.distanceKm * 1000 <= CHECKPOINT_ARRIVAL_RADIUS_METERS
    ? nearestCheckpoint.checkpoint
    : null;
  const finishCheckpoint = finishMode === 'selectedCheckpoint'
    ? selectedCheckpointPoint
    : finishMode === 'finalCheckpoint'
      ? [...placedCheckpoints].reverse()[0] ?? null
      : null;
  const finishDistanceRemainingKm = finishCheckpoint && currentPoint
    ? Math.max(0, distanceBetween(currentPoint, finishCheckpoint))
    : targetRemainingKm;
  const finishEtaMinutes = currentDistance > 0.02 && elapsedSeconds > 0
    ? finishDistanceRemainingKm * (elapsedSeconds / 60 / currentDistance)
    : finishDistanceRemainingKm * targetPace;
  const finishTargetRemainingMinutes = Math.max(0, targetMinutes - elapsedSeconds / 60);
  const finishRequiredPace = finishDistanceRemainingKm > 0.02
    ? finishTargetRemainingMinutes / finishDistanceRemainingKm
    : 0;
  const finishProjectedTotalMinutes = elapsedSeconds / 60 + finishEtaMinutes;
  const finishOnTarget = finishProjectedTotalMinutes <= targetMinutes;
  const finishLabel = finishCheckpoint?.label ?? `${targetDistanceKm.toFixed(1)}km target`;
  const missingGridCount = plannedCheckpoints.length - placedCheckpoints.length;
  const loadRatio = weight / Math.max(1, bodyMassKg);
  const routeReadinessChecks = useMemo(() => {
    const targetPaceRisk = targetPace < 8.5;
    const finishMissing = finishMode === 'finalCheckpoint' && !finishCheckpoint;
    const selectedFinishMissing = finishMode === 'selectedCheckpoint' && !selectedCheckpointPoint;
    const checks = [
      {
        label: 'Checkpoint grids',
        value: missingGridCount === 0 ? 'Ready' : `${missingGridCount} need grid`,
        tone: missingGridCount === 0 ? colours.green : colours.amber,
        ready: missingGridCount === 0,
      },
      {
        label: 'Finish setup',
        value: finishMissing ? 'Final CP missing' : selectedFinishMissing ? 'Selected CP missing' : 'Ready',
        tone: finishMissing || selectedFinishMissing ? colours.amber : colours.green,
        ready: !finishMissing && !selectedFinishMissing,
      },
      {
        label: 'Target pace',
        value: targetPaceRisk ? `${targetPace.toFixed(1)}/km aggressive` : `${targetPace.toFixed(1)}/km`,
        tone: targetPaceRisk ? colours.amber : colours.green,
        ready: !targetPaceRisk,
      },
      {
        label: 'Load ratio',
        value: `${Math.round(loadRatio * 100)}% body mass`,
        tone: loadRatio >= 0.3 ? colours.red : loadRatio >= 0.25 ? colours.amber : colours.green,
        ready: loadRatio < 0.3,
      },
      {
        label: 'GPS fix',
        value: currentPoint ? gpsQuality.detail : 'Requested on start',
        tone: currentPoint ? gpsQuality.tone : colours.amber,
        ready: true,
      },
      {
        label: 'Background',
        value: supportsBackgroundLocation ? 'Native ready' : 'Web tab only',
        tone: supportsBackgroundLocation ? colours.green : colours.amber,
        ready: true,
      },
    ];
    const blockingIssues = checks.filter((check) => !check.ready).length;
    return {
      checks,
      status: blockingIssues === 0 ? 'READY' : 'CHECK PLAN',
      tone: blockingIssues === 0 ? colours.green : blockingIssues >= 3 ? colours.red : colours.amber,
      blockingIssues,
    };
  }, [bodyMassKg, currentPoint, finishCheckpoint, finishMode, gpsQuality.detail, gpsQuality.tone, loadRatio, missingGridCount, selectedCheckpointPoint, targetPace, weight]);
  const splits = useMemo<RuckSplit[]>(() => {
    if (routePoints.length < 2) return [];

    const completed: RuckSplit[] = [];
    let cumulativeKm = 0;
    let nextKm = 1;
    let previousElapsed = 0;
    const firstTimestamp = routePoints[0].timestamp;

    for (let i = 1; i < routePoints.length; i += 1) {
      const start = routePoints[i - 1];
      const end = routePoints[i];
      const segmentKm = distanceBetween(start, end);
      const segmentStartKm = cumulativeKm;
      cumulativeKm += segmentKm;

      while (cumulativeKm >= nextKm) {
        const ratio = segmentKm > 0 ? (nextKm - segmentStartKm) / segmentKm : 1;
        const timestamp = start.timestamp + (end.timestamp - start.timestamp) * Math.max(0, Math.min(1, ratio));
        const elapsedForSplit = Math.max(0, Math.round((timestamp - firstTimestamp) / 1000));
        completed.push({
          km: nextKm,
          elapsedSeconds: elapsedForSplit,
          splitSeconds: elapsedForSplit - previousElapsed,
        });
        previousElapsed = elapsedForSplit;
        nextKm += 1;
      }
    }

    return completed;
  }, [routePoints]);
  const latestSplit = splits[splits.length - 1] ?? null;

  const recordLocation = useCallback((location: Location.LocationObject) => {
    const nextPoint = toTrackPoint(location);
    dispatchTracking({ type: 'point_recorded', point: nextPoint });
  }, []);

  useEffect(() => {
    if (gpsFollowMode && mapCenter !== null) {
      setMapCenter(null);
    }
  }, [gpsFollowMode, mapCenter]);

  const mapViewportRef = useRef(mapViewport);
  mapViewportRef.current = mapViewport;

  const effectiveMapCenterRef = useRef(effectiveMapCenter);
  effectiveMapCenterRef.current = effectiveMapCenter;

  const mapZoomRef = useRef(mapZoom);
  mapZoomRef.current = mapZoom;

  const mapNorthUpRef = useRef(mapNorthUp);
  mapNorthUpRef.current = mapNorthUp;

  const activeHeadingRef = useRef(activeHeading);
  activeHeadingRef.current = activeHeading;

  const panStartCenter = useRef<TrackPoint | null>(null);
  const pinchStartZoom = useRef(mapZoom);
  const zoomAnimFrame = useRef<number | null>(null);

  const mapGestures = useMemo(() => {
    const panGesture = Gesture.Pan()
      .enabled(Boolean(effectiveMapCenterRef.current))
      .onStart(() => {
        if (zoomAnimFrame.current) {
          cancelAnimationFrame(zoomAnimFrame.current);
          zoomAnimFrame.current = null;
        }
        setIsPanning(true);
        setGpsFollowMode(false);
        panStartCenter.current = effectiveMapCenterRef.current ?? null;
      })
      .onUpdate((event) => {
        const start = panStartCenter.current;
        const viewport = mapViewportRef.current;
        if (!start || viewport.width <= 0 || viewport.height <= 0) return;

        let dx = event.translationX;
        let dy = event.translationY;

        // Counter-rotate the finger pan vectors when the map is rotated
        if (!mapNorthUpRef.current && activeHeadingRef.current != null) {
          const rad = (activeHeadingRef.current * Math.PI) / 180;
          dx = event.translationX * Math.cos(rad) - event.translationY * Math.sin(rad);
          dy = event.translationX * Math.sin(rad) + event.translationY * Math.cos(rad);
        }

        const dxBound = Math.max(-viewport.width * 2, Math.min(viewport.width * 2, dx));
        const dyBound = Math.max(-viewport.height * 2, Math.min(viewport.height * 2, dy));

        const startPixel = latLonToWorldPixel(start.latitude, start.longitude, mapZoomRef.current);
        const next = worldPixelToLatLon(startPixel.x - dxBound, startPixel.y - dyBound, mapZoomRef.current);
        setMapCenter({
          latitude: next.latitude,
          longitude: next.longitude,
          altitude: null,
          accuracy: null,
          timestamp: Date.now(),
        });
      })
      .onEnd(() => {
        setIsPanning(false);
        panStartCenter.current = null;
      })
      .runOnJS(true);

    const pinchGesture = Gesture.Pinch()
      .enabled(Boolean(effectiveMapCenterRef.current))
      .onStart(() => {
        if (zoomAnimFrame.current) {
          cancelAnimationFrame(zoomAnimFrame.current);
          zoomAnimFrame.current = null;
        }
        pinchStartZoom.current = mapZoomRef.current;
      })
      .onUpdate((event) => {
        const newZoom = Math.max(2, Math.min(18, pinchStartZoom.current + Math.log2(event.scale)));
        setMapZoom(newZoom);
      })
      .runOnJS(true);

    const doubleTapGesture = Gesture.Tap()
      .numberOfTaps(2)
      .enabled(Boolean(effectiveMapCenterRef.current))
      .onEnd(() => {
        if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current);
        const startZoom = mapZoomRef.current;
        const endZoom = 15;
        const durationMs = 250;
        const startTime = Date.now();

        function step() {
          const progress = Math.min(1, (Date.now() - startTime) / durationMs);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          setMapZoom(startZoom + (endZoom - startZoom) * easeOut);

          if (progress < 1) {
            zoomAnimFrame.current = requestAnimationFrame(step);
          } else {
            zoomAnimFrame.current = null;
          }
        }
        zoomAnimFrame.current = requestAnimationFrame(step);
      })
      .runOnJS(true);

    return Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture);
  }, []);

  useEffect(() => {
    if (activeHeading == null) return;

    // Calculate shortest path to prevent the 359deg -> 1deg spin-around glitch
    let delta = activeHeading - ((prevHeading.current % 360 + 360) % 360);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    prevHeading.current += delta;
    const anim = Animated.timing(rotationAnim, {
      toValue: prevHeading.current,
      duration: 300,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [activeHeading, rotationAnim]);

  useEffect(() => {
    async function restoreSession() {
      try {
        const points = await loadActiveRoute();
        const plan = await loadActiveRuckPlan();
        const storedTemplates = await secureGetItem(CUSTOM_RUCK_TEMPLATES_KEY);
        if (storedTemplates) {
          try {
            setCustomTemplates(JSON.parse(storedTemplates) as RuckTemplate[]);
          } catch {
            console.error('Failed to parse custom ruck templates');
          }
        }

        if (plan) {
          setTargetDistanceKm(plan.targetDistanceKm);
          setTargetMinutes(plan.targetMinutes);
          setCheckpointIntervalKm(plan.checkpointIntervalKm);
          setCheckpointIndex(plan.checkpointIndex);
          setFinishMode(plan.finishMode ?? 'target');
          setPlannedCheckpoints(plan.plannedCheckpoints.map((checkpoint) => ({
            ...checkpoint,
            status: checkpoint.status ?? 'planned',
          })));
          setSelectedCheckpointId(plan.selectedCheckpointId);
        }

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
      } catch (e) {
        console.error('Failed to restore ruck session', e);
      } finally {
        setPlanRestored(true);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    if (!planRestored) return;
    secureSetItem(CUSTOM_RUCK_TEMPLATES_KEY, JSON.stringify(customTemplates)).catch((error) => {
      console.error('Failed to persist custom ruck templates', error);
    });
  }, [customTemplates, planRestored]);

  useEffect(() => {
    setCheckpointLabelInput(selectedCheckpoint?.label ?? '');
  }, [selectedCheckpoint?.id, selectedCheckpoint?.label]);

  useEffect(() => {
    let isMounted = true;
    Location.watchHeadingAsync((heading) => {
      const nextHeading = heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading;
      if (nextHeading >= 0 && isMounted) setCompassHeading(Math.round(nextHeading));
    }).then((subscription) => {
      if (!isMounted) {
        subscription.remove();
      } else {
        headingSubscription.current = subscription;
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
    if (!startTime || routePoints.length === 0) return;
    replaceActiveRoute(routePoints).catch((error) => {
      console.error('Failed to persist filtered ruck route', error);
    });
  }, [routePoints, startTime]);

  useEffect(() => {
    if (!planRestored) return;

    const plan: RuckMissionPlan = {
      targetDistanceKm,
      targetMinutes,
      checkpointIntervalKm,
      checkpointIndex,
      finishMode,
      plannedCheckpoints,
      selectedCheckpointId,
    };

    saveActiveRuckPlan(plan).catch((error) => {
      console.error('Failed to persist active ruck plan', error);
    });
  }, [checkpointIndex, checkpointIntervalKm, finishMode, planRestored, plannedCheckpoints, selectedCheckpointId, targetDistanceKm, targetMinutes]);

  useEffect(() => {
    if (!isTracking) return;

    const subscription = DeviceEventEmitter.addListener('onLocationUpdate', (locations: Location.LocationObject[]) => {
      locations.forEach(recordLocation);
    });

    return () => subscription.remove();
  }, [isTracking, recordLocation]);

  useEffect(() => {
    const reachedIndex = Math.min(checkpointCount, Math.floor(currentDistance / checkpointIntervalKm));
    setCheckpointIndex((current) => Math.max(current, reachedIndex));
  }, [checkpointCount, checkpointIntervalKm, currentDistance]);

  useEffect(() => {
    if (!currentPoint || plannedCheckpoints.length === 0) return;

    const arrived = placedCheckpoints.filter((checkpoint) => (
      checkpoint.status === 'planned' &&
      distanceBetween(currentPoint, checkpoint) * 1000 <= CHECKPOINT_ARRIVAL_RADIUS_METERS
    ));

    if (arrived.length === 0) return;

    setPlannedCheckpoints((current) => current.map((checkpoint) => (
      arrived.some((arrivedCheckpoint) => arrivedCheckpoint.id === checkpoint.id)
        ? { ...checkpoint, status: 'reached' }
        : checkpoint
    )));

    const firstNewArrival = arrived.find((checkpoint) => !announcedCheckpointArrivals.current.has(checkpoint.id));
    arrived.forEach((checkpoint) => announcedCheckpointArrivals.current.add(checkpoint.id));
    if (firstNewArrival) {
      setSelectedCheckpointId(firstNewArrival.id);
    }
  }, [currentPoint, placedCheckpoints]);

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

  const startLocationSubscription = async () => {
    if (supportsBackgroundLocation) {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus === 'granted') {
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
        return 'background';
      }

      showAlert('Foreground tracking active', 'Background permission was not granted, so GPS will track while this screen stays open.');
    }

    foregroundLocationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      recordLocation
    );
    return 'foreground';
  };

  const startTracking = async (overrideReadiness = false) => {
    if (isTracking || isStarting) return;

    if (!overrideReadiness && routeReadinessChecks.blockingIssues > 0) {
      const issues = routeReadinessChecks.checks
        .filter((check) => !check.ready)
        .map((check) => `${check.label}: ${check.value}`)
        .join('\n');

      showConfirm(
        'Check route plan',
        issues,
        () => startTracking(true),
        'Start Anyway'
      );
      return;
    }

    setMapFullscreen(true);
    dispatchTracking({ type: 'start_requested' });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission denied', 'Location permission is required for GPS tracking.');
        dispatchTracking({ type: 'stopped' });
        setMapFullscreen(false);
        return;
      }

      const firstPosition = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const firstPoint = toTrackPoint(firstPosition);

      await resetActiveRoute(firstPoint);
      await startLocationSubscription();

      dispatchTracking({ type: 'start_succeeded', firstPoint });
    } catch (error) {
      console.error('Failed to start GPS tracking', error);
      stopTracking();
      setMapFullscreen(false);
      showAlert('GPS unavailable', 'Unable to start GPS tracking on this device.');
    }
  };

  const resumeTracking = async () => {
    if (isTracking || isStarting || !startTime) return;

    setReviewOpen(false);
    setMapFullscreen(true);
    dispatchTracking({ type: 'resume_requested' });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission denied', 'Location permission is required to resume GPS tracking.');
        dispatchTracking({ type: 'stopped' });
        return;
      }

      await startLocationSubscription();
      dispatchTracking({ type: 'resume_succeeded' });
    } catch (error) {
      console.error('Failed to resume GPS tracking', error);
      stopTracking();
      showAlert('GPS unavailable', 'Unable to resume GPS tracking on this device.');
    }
  };

  const openRuckReview = () => {
    if (!startTime) return;
    stopTracking();
    setMapFullscreen(false);
    setReviewOpen(true);
  };

  const saveTrackedRuck = () => {
    if (!startTime) return;
    stopTracking();

    const duration = Math.max(1, elapsedSeconds / 60);
    const ruckMission: RuckMissionPlan = {
      targetDistanceKm,
      targetMinutes,
      checkpointIntervalKm,
      checkpointIndex,
      finishMode,
      plannedCheckpoints,
      selectedCheckpointId,
      splits,
    };
    const session: TrainingSession = {
      id: Date.now().toString(),
      type: 'Ruck',
      title: `${currentDistance.toFixed(1)}km GPS Ruck`,
      score: Math.max(55, Math.round(95 - weight * 0.6 - currentDistance * 0.4)),
      durationMinutes: Math.round(duration),
      rpe: weight > 22 ? 8 : 6,
      loadKg: weight,
      routePoints: routePoints.length > 0 ? routePoints : undefined,
      ruckMission,
      note: ruckReviewNote.trim() || undefined,
      routeConfidence: routeReview.confidence,
      rejectedPointCount,
      averageAccuracyMeters: routeReview.averageAccuracyMeters,
      completedAt: new Date().toISOString(),
    };
    addSession(session);
    showAlert('Ruck saved', 'Your GPS-tracked ruck has been logged.');
    dispatchTracking({ type: 'reset' });
    setCheckpointIndex(0);
    setPlannedCheckpoints([]);
    setSelectedCheckpointId(null);
    setMapFullscreen(false);
    setReviewOpen(false);
    setRuckReviewNote('');
    clearActiveRoute();
    clearActiveRuckPlan();
  };

  const discardTrackedRuck = () => {
    stopTracking();
    dispatchTracking({ type: 'reset' });
    setCheckpointIndex(0);
    setPlannedCheckpoints([]);
    setSelectedCheckpointId(null);
    setMapFullscreen(false);
    setReviewOpen(false);
    setRuckReviewNote('');
    clearActiveRoute();
    clearActiveRuckPlan();
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
  const routeReview = useMemo(() => {
    const accuracyValues = routePoints
      .map((point) => point.accuracy)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const averageAccuracyMeters = accuracyValues.length > 0
      ? Math.round(accuracyValues.reduce((total, value) => total + value, 0) / accuracyValues.length)
      : undefined;
    const weakPointCount = accuracyValues.filter((value) => value > WEAK_ACCURACY_METERS).length;
    const confidence: 'High' | 'Medium' | 'Low' = routePoints.length < 2 || rejectedPointCount >= 8 || weakPointCount > accuracyValues.length / 2
      ? 'Low'
      : rejectedPointCount >= 3 || (averageAccuracyMeters ?? 0) > WEAK_ACCURACY_METERS
        ? 'Medium'
        : 'High';
    const reachedCheckpoints = plannedCheckpoints.filter((checkpoint) => checkpoint.status === 'reached').length;

    return {
      averageAccuracyMeters,
      confidence,
      reachedCheckpoints,
      totalCheckpoints: plannedCheckpoints.length,
    };
  }, [elapsedSeconds, plannedCheckpoints, rejectedPointCount, routePoints]);

  function changeTargetDistance(amount: number) {
    setTargetDistanceKm((current) => Math.round(Math.min(40, Math.max(1, current + amount)) * 10) / 10);
    setCheckpointIndex(0);
  }

  function changeTargetMinutes(amount: number) {
    setTargetMinutes((current) => Math.min(360, Math.max(20, current + amount)));
  }

  function changeCheckpointInterval(amount: number) {
    setCheckpointIntervalKm((current) => Math.round(Math.min(10, Math.max(0.5, current + amount)) * 10) / 10);
    setCheckpointIndex(0);
  }

  function applyTemplate(template: RuckTemplate) {
    setActiveTemplateId(template.id);
    setTargetDistanceKm(template.targetDistanceKm);
    setTargetMinutes(template.targetMinutes);
    setCheckpointIntervalKm(template.checkpointIntervalKm);
    setCheckpointIndex(0);
    setFinishMode(template.finishMode);

    if (template.checkpoints) {
      const createdAt = Date.now();
      const checkpoints = template.checkpoints.map((checkpoint, index) => ({
        ...checkpoint,
        id: `cp-custom-${template.id}-${createdAt}-${index}`,
        status: 'planned' as const,
        timestamp: createdAt,
      }));
      setPlannedCheckpoints(checkpoints);
      setSelectedCheckpointId(checkpoints[0]?.id ?? null);
      return;
    }

    if (template.checkpointLabels.length > 0) {
      const createdAt = Date.now();
      const templateCheckpoints: RuckCheckpoint[] = template.checkpointLabels.map((label, index) => ({
        id: `cp-template-${template.id}-${createdAt}-${index}`,
        label,
        source: 'manual',
        status: 'planned',
        latitude: null,
        longitude: null,
        altitude: null,
        accuracy: null,
        timestamp: createdAt,
      }));

      setPlannedCheckpoints((current) => {
        if (current.length > 0) {
          return current.map((checkpoint, index) => ({
            ...checkpoint,
            label: template.checkpointLabels[index] ?? checkpoint.label,
          }));
        }

        return templateCheckpoints;
      });
      setSelectedCheckpointId((current) => current ?? templateCheckpoints[0]?.id ?? null);
    }
  }

  function saveCustomTemplate() {
    const label = templateNameInput.trim() || `Custom Route ${customTemplates.length + 1}`;
    const id = `custom-${Date.now()}`;
    const template: RuckTemplate = {
      id,
      label,
      detail: `${targetDistanceKm.toFixed(1)}km | ${plannedCheckpoints.length} CP`,
      targetDistanceKm,
      targetMinutes,
      checkpointIntervalKm,
      finishMode,
      checkpointLabels: plannedCheckpoints.map((checkpoint) => checkpoint.label),
      checkpoints: plannedCheckpoints.map((checkpoint, index) => ({
        ...checkpoint,
        id: `template-${id}-${index}`,
        status: 'planned',
      })),
      custom: true,
    };

    setCustomTemplates((current) => [...current, template]);
    setTemplateNameInput('');
    setActiveTemplateId(id);
  }

  function deleteCustomTemplate(templateId: string) {
    showConfirm(
      'Delete Template',
      'Remove this saved route card template?',
      () => {
        setCustomTemplates((current) => current.filter((template) => template.id !== templateId));
        setActiveTemplateId((current) => current === templateId ? null : current);
      },
      'Delete'
    );
  }

  function markCheckpointReached() {
    setCheckpointIndex((current) => Math.min(checkpointCount, current + 1));
  }

  function undoCheckpointMark() {
    setCheckpointIndex((current) => Math.max(0, current - 1));
  }

  function addCheckpoint(point: Pick<TrackPoint, 'latitude' | 'longitude' | 'altitude' | 'accuracy'>, source: RuckCheckpoint['source']) {
    const checkpoint: RuckCheckpoint = {
      id: `cp-${Date.now()}-${plannedCheckpoints.length + 1}`,
      label: `CP ${plannedCheckpoints.length + 1}`,
      source,
      status: 'planned',
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude ?? null,
      accuracy: point.accuracy ?? null,
      timestamp: Date.now(),
    };
    setPlannedCheckpoints((current) => [...current, checkpoint]);
    setSelectedCheckpointId(checkpoint.id);
  }

  function updateSelectedCheckpoint(updates: Partial<RuckCheckpoint>) {
    if (!selectedCheckpoint) return;
    setPlannedCheckpoints((current) => current.map((checkpoint) => (
      checkpoint.id === selectedCheckpoint.id ? { ...checkpoint, ...updates } : checkpoint
    )));
  }

function addCheckpointHere() {
    if (!effectiveMapCenter) {
      showAlert('No map position', 'Start GPS tracking or wait for a location fix before adding a checkpoint here.');
      return;
    }
    addCheckpoint(effectiveMapCenter, mapCenter ? 'manual' : 'current');
  }

  function addCheckpointFromInput() {
    const parsed = parseCoordinate(checkpointCoordinateInput, coordinateFormat);
    if (!parsed) {
      showAlert('Coordinate not recognised', 'Use LAT/LON, DMS, UTM, or MGRS. Example: 29U 682123E 5912345N or 29U PV 82123 12345.');
      return;
    }

    addCheckpoint({ ...parsed, altitude: null, accuracy: null }, 'manual');
    setCheckpointCoordinateInput('');
  }

  function updateSelectedCheckpointFromInput() {
    if (!selectedCheckpoint) return;
    const parsed = parseCoordinate(checkpointCoordinateInput, coordinateFormat);
    if (!parsed) {
      showAlert('Coordinate not recognised', 'Use LAT/LON, DMS, UTM, or MGRS. Example: 29U 682123E 5912345N or 29U PV 82123 12345.');
      return;
    }

    updateSelectedCheckpoint({
      ...parsed,
      source: 'manual',
      altitude: null,
      accuracy: null,
      timestamp: Date.now(),
    });
    setCheckpointCoordinateInput('');
  }

function updateSelectedCheckpointHere() {
    if (!selectedCheckpoint) return;
    if (!effectiveMapCenter) {
      showAlert('No map position', 'Start GPS tracking or wait for a location fix before moving the checkpoint here.');
      return;
    }

    updateSelectedCheckpoint({
      latitude: effectiveMapCenter.latitude,
      longitude: effectiveMapCenter.longitude,
      altitude: effectiveMapCenter.altitude,
      accuracy: effectiveMapCenter.accuracy,
      timestamp: Date.now(),
      source: mapCenter ? 'manual' : 'current',
    });
  }

  function recenterMapOnGps() {
    if (!currentPoint) {
      showAlert('No GPS fix', 'Start GPS tracking or wait for a location fix before recentring.');
      return;
    }
    setGpsFollowMode(true);
    setMapCenter(null);
  }

  function saveSelectedCheckpointLabel() {
    if (!selectedCheckpoint) return;
    const label = checkpointLabelInput.trim();
    updateSelectedCheckpoint({ label: label || selectedCheckpoint.label });
  }

  function setSelectedCheckpointStatus(status: RuckCheckpoint['status']) {
    updateSelectedCheckpoint({ status });
  }

  function importCheckpoints() {
    const lines = checkpointBulkInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    const imported: RuckCheckpoint[] = [];
    const failed: string[] = [];

    lines.forEach((line, index) => {
      const [maybeLabel, maybeCoordinate] = line.includes(':')
        ? line.split(/:(.+)/).map((part) => part.trim())
        : ['', line];
      const parsed = parseCoordinate(maybeCoordinate || line);
      if (!parsed) {
        failed.push(line);
        return;
      }

      imported.push({
        id: `cp-${Date.now()}-${plannedCheckpoints.length + index + 1}`,
        label: maybeLabel || `CP ${plannedCheckpoints.length + imported.length + 1}`,
        source: 'manual',
        status: 'planned',
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        altitude: null,
        accuracy: null,
        timestamp: Date.now(),
      });
    });

    if (imported.length > 0) {
      setPlannedCheckpoints((current) => [...current, ...imported]);
      setSelectedCheckpointId(imported[0].id);
      setCheckpointBulkInput('');
    }

    if (failed.length > 0) {
      showAlert('Some checkpoints were skipped', `${failed.length} line(s) could not be parsed.`);
    }
  }

  function clearSelectedCheckpoint() {
    if (!selectedCheckpoint) return;
    setPlannedCheckpoints((current) => current.filter((checkpoint) => checkpoint.id !== selectedCheckpoint.id));
    setSelectedCheckpointId(null);
  }

  function undoLastCheckpoint() {
    setPlannedCheckpoints((current) => {
      const next = current.slice(0, -1);
      setSelectedCheckpointId(next[next.length - 1]?.id ?? null);
      return next;
    });
  }

  function clearAllCheckpoints() {
    setPlannedCheckpoints([]);
    setSelectedCheckpointId(null);
  }

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
    showAlert('Ruck saved', 'Your ruck session has been added to your training log.');
  }

  function checkpointTone(checkpoint: RuckCheckpoint) {
    if (selectedCheckpoint?.id === checkpoint.id) return colours.amber;
    if (checkpoint.status === 'reached') return colours.green;
    if (checkpoint.status === 'skipped') return colours.red;
    return colours.cyan;
  }

  function renderMapStage(fullscreen: boolean) {
    const showOverlays = showExpandedMap || fullscreen;
    return (
      <GestureDetector gesture={mapGestures}>
        <View
          style={fullscreen ? styles.fullscreenMapStage : [styles.mapStage, showExpandedMap && styles.mapStageExpanded]}
          onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setMapViewport((current) => (
            Math.round(current.width) === Math.round(width) && Math.round(current.height) === Math.round(height)
              ? current
              : { width, height }
          ));
        }}
      >
          {mapTiles.length === 0 ? (
            <View style={styles.mapEmpty}>
              <Ionicons name="navigate-circle-outline" size={42} color={colours.cyan} />
              <Text style={styles.mapEmptyText}>Start GPS to draw your route</Text>
            </View>
          ) : (
            <Animated.View
              style={{
                position: 'absolute',
                width: renderViewport.width,
                height: renderViewport.height,
                top: (mapViewport.height - renderViewport.height) / 2,
                left: (mapViewport.width - renderViewport.width) / 2,
                transform: [
                  {
                    rotate: mapNorthUp ? '0deg' : rotationAnim.interpolate({
                      inputRange: [-720, 0, 360, 720],
                      outputRange: ['720deg', '0deg', '-360deg', '-720deg'],
                    })
                  }
                ]
              }}
            >
              {mapTiles.map((tile) => (
                <Image 
                  key={tile.id} 
                  source={{ uri: tile.url }} 
                  style={tile.style} 
                  cachePolicy="disk" 
                />
              ))}
              <View style={styles.mapShade} pointerEvents="none" />
              <View style={styles.mapGridHorizontal} />
              <View style={styles.mapGridVertical} />
              <View style={[styles.mapRing, styles.mapRingOuter]} />
              <View style={[styles.mapRing, styles.mapRingInner]} />

              <Svg
                style={StyleSheet.absoluteFill}
                viewBox={`0 0 ${Math.max(1, renderViewport.width)} ${Math.max(1, renderViewport.height)}`}
                pointerEvents="none"
              >
                {routeLinePoints && (
                  <Polyline
                    points={routeLinePoints}
                    fill="none"
                    stroke={colours.cyan}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                )}
                {firstMapPoint && (
                  <Circle cx={firstMapPoint.x} cy={firstMapPoint.y} r={5} fill={colours.background} stroke={colours.cyan} strokeWidth={2} />
                )}
                {lastMapPoint && (
                  <Circle cx={lastMapPoint.x} cy={lastMapPoint.y} r={8} fill={colours.green} stroke="rgba(255,255,255,0.75)" strokeWidth={2} />
                )}
                {checkpointMapPoints.map((checkpoint, index) => (
                  <React.Fragment key={checkpoint.id}>
                    <Circle
                      cx={checkpoint.x}
                      cy={checkpoint.y}
                      r={selectedCheckpoint?.id === checkpoint.id ? 10 : 8}
                      fill={checkpointTone(checkpoint)}
                      stroke="rgba(7,17,30,0.86)"
                      strokeWidth={2}
                    />
                    <SvgText 
                      x={checkpoint.x} 
                      y={checkpoint.y + 3} 
                      textAnchor="middle" 
                      fontSize="9" 
                      fontWeight="900" 
                      fill={colours.background}
                      transform={!mapNorthUp && activeHeading != null ? `rotate(${activeHeading}, ${checkpoint.x}, ${checkpoint.y})` : undefined}
                    >
                      {index + 1}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
            </Animated.View>
          )}

        <View style={styles.crosshair} pointerEvents="none">
          <View style={styles.crosshairHorizontal} />
          <View style={styles.crosshairVertical} />
        </View>

        {showOverlays && (
          <>
            <View style={[styles.mapGridOverlay, shadow.subtle]} pointerEvents="none">
              <Text style={styles.mapOverlayLabel}>{gpsFollowMode ? 'GPS GRID' : 'MAP CENTER'}</Text>
              <Text style={styles.mapOverlayValue}>{gpsFollowMode ? currentCoordinate ?? 'Awaiting fix' : mapCenterCoordinate ?? 'Awaiting fix'}</Text>
            </View>
            <View style={[styles.mapCompassOverlay, shadow.subtle]} pointerEvents="none">
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: mapNorthUp 
                        ? rotationAnim.interpolate({
                            inputRange: [-720, 0, 360, 720],
                            outputRange: ['-720deg', '0deg', '360deg', '720deg'],
                          })
                        : rotationAnim.interpolate({
                            inputRange: [-720, 0, 360, 720],
                            outputRange: ['720deg', '0deg', '-360deg', '-720deg'],
                          })
                    }
                  ],
                }}
              >
                <Ionicons name="navigate" size={22} color={colours.background} />
              </Animated.View>
              <Text style={styles.mapCompassValue}>{displayHeading == null ? '---' : formatHeading(displayHeading)}</Text>
              <Text style={styles.mapCompassLabel}>{displayHeading == null ? 'HDG' : cardinalDirection(displayHeading)}</Text>
            </View>
            <View style={[styles.mapTelemetry, fullscreen && styles.mapTelemetryFullscreen, shadow.subtle]} pointerEvents="none">
              <View style={styles.mapTelemetryItem}>
                <Text style={styles.mapTelemetryValue}>{currentDistance.toFixed(2)}</Text>
                <Text style={styles.mapTelemetryLabel}>KM</Text>
              </View>
              <View style={styles.mapTelemetryItem}>
                <Text style={styles.mapTelemetryValue}>{activePace}</Text>
                <Text style={styles.mapTelemetryLabel}>MIN/KM</Text>
              </View>
              <View style={styles.mapTelemetryItem}>
                <Text style={styles.mapTelemetryValue}>{displayBearing == null ? '--' : formatHeading(displayBearing)}</Text>
                <Text style={styles.mapTelemetryLabel}>BRG</Text>
              </View>
              <View style={styles.mapTelemetryItem}>
                <Text style={styles.mapTelemetryValue}>{currentAltitude == null ? '--' : `${currentAltitude}`}</Text>
                <Text style={styles.mapTelemetryLabel}>ALT M</Text>
              </View>
            </View>
            <View style={[styles.mapMissionStrip, fullscreen && styles.mapMissionStripFullscreen, shadow.subtle]} pointerEvents="none">
              <Text style={styles.mapMissionText}>{arrivalCheckpoint ? 'ARRIVED' : formatSignedMinutes(targetDeltaMinutes)}</Text>
              <Text style={styles.mapMissionText}>{selectedCheckpoint?.label ?? checkpointStatus}</Text>
              <Text style={styles.mapMissionText}>
                {selectedCheckpointDistanceKm == null ? `${checkpointRemainingKm.toFixed(1)}km to CP` : `${selectedCheckpointDistanceKm.toFixed(1)}km to CP`}
              </Text>
            </View>
            <View style={[styles.finishStrip, fullscreen && styles.finishStripFullscreen, shadow.subtle]} pointerEvents="none">
              <Text style={styles.finishStripText}>FINISH {finishDistanceRemainingKm.toFixed(1)}km</Text>
              <Text style={styles.finishStripText}>REQ {finishRequiredPace > 0 ? `${finishRequiredPace.toFixed(1)}/km` : '--'}</Text>
              <Text style={[styles.finishStripText, { color: finishOnTarget ? colours.green : colours.amber }]}>
                {finishOnTarget ? 'ON TARGET' : 'AT RISK'}
              </Text>
            </View>
            <View style={[styles.bearingGuidanceStrip, fullscreen && styles.bearingGuidanceStripFullscreen, { borderColor: statusColors(bearingGuidance.tone).borderMed, backgroundColor: statusColors(bearingGuidance.tone).bgMed }, shadow.subtle]} pointerEvents="none">
              <Text style={[styles.bearingGuidanceLabel, { color: bearingGuidance.tone }]}>{bearingGuidance.label}</Text>
              <Text style={styles.bearingGuidanceDetail}>{bearingGuidance.detail}</Text>
            </View>
          </>
        )}
        {mapTiles.length > 0 && (
          <Text style={styles.mapAttribution}>{activeMapLayer.attribution}</Text>
        )}
        {showOverlays && (
          <View style={styles.mapSelectControls}>
            <Pressable
              style={[styles.mapSelectButton, !gpsFollowMode && styles.mapSelectButtonActive, shadow.subtle]}
              onPress={() => {
                if (gpsFollowMode) {
                  setGpsFollowMode(false);
                  setMapCenter(effectiveMapCenter);
                } else {
                  setGpsFollowMode(true);
                  setMapCenter(null);
                }
              }}
            >
              <Ionicons name={!gpsFollowMode ? "locate-outline" : 'locate'} size={14} color={!gpsFollowMode ? colours.background : colours.cyan} />
              <Text style={[styles.mapSelectButtonText, !gpsFollowMode && styles.mapSelectButtonTextActive]}>
                {gpsFollowMode ? 'Pan Free' : 'GPS Follow'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.mapSelectButton, !mapNorthUp && styles.mapSelectButtonActive, shadow.subtle]}
              onPress={() => setMapNorthUp(v => !v)}
            >
              <Ionicons name="compass" size={14} color={!mapNorthUp ? colours.background : colours.cyan} />
              <Text style={[styles.mapSelectButtonText, !mapNorthUp && styles.mapSelectButtonTextActive]}>
                {mapNorthUp ? 'North Up' : 'Heading Up'}
              </Text>
            </Pressable>
            <Pressable style={[styles.mapSelectButton, shadow.subtle]} onPress={recenterMapOnGps}>
              <Ionicons name="locate" size={14} color={colours.cyan} />
              <Text style={styles.mapSelectButtonText}>My Position</Text>
            </Pressable>
            <Pressable style={[styles.mapSelectButton, shadow.subtle]} onPress={addCheckpointHere}>
              <Ionicons name="flag" size={14} color={colours.cyan} />
              <Text style={styles.mapSelectButtonText}>Add CP</Text>
            </Pressable>
            {selectedCheckpoint ? (
              <Pressable style={[styles.mapSelectButton, shadow.subtle]} onPress={updateSelectedCheckpointHere}>
                <Ionicons name="pin" size={14} color={colours.cyan} />
                <Text style={styles.mapSelectButtonText}>Move CP</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.mapSelectButton, shadow.subtle]} onPress={() => {
              if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current);
              setMapZoom((z) => Math.max(2, z - 1));
            }}>
              <Ionicons name="remove" size={16} color={colours.cyan} />
            </Pressable>
            <Pressable style={[styles.mapSelectButton, shadow.subtle]} onPress={() => {
              if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current);
              setMapZoom((z) => Math.min(18, z + 1));
            }}>
              <Ionicons name="add" size={16} color={colours.cyan} />
            </Pressable>
          </View>
        )}
      </View>
      </GestureDetector>
    );
  }

  if (mapFullscreen) {
    return (
      <SafeAreaView style={styles.fullscreenContainer}>
        {renderMapStage(true)}
        <View style={styles.fullscreenBottomBar}>
          <View style={[styles.fullscreenStatusPanel, { borderColor: statusColors(trackingStatus.tone).borderMed, backgroundColor: statusColors(trackingStatus.tone).bgMed }]}>
            <Text style={[styles.fullscreenStatusLabel, { color: trackingStatus.tone }]}>{trackingStatus.label}</Text>
            <Text style={styles.fullscreenStatusDetail}>{trackingStatus.detail}</Text>
          </View>
          <Pressable style={styles.fullscreenCollapseBtn} onPress={() => setMapFullscreen(false)}>
            <Ionicons name="contract" size={18} color={colours.text} />
          </Pressable>
          {isStarting ? (
            <Pressable style={[styles.trackButton, styles.trackButtonDisabled, { flex: 1 }]} disabled>
              <Ionicons name="sync" size={20} color={colours.background} />
              <Text style={styles.trackButtonText}>Acquiring GPS...</Text>
            </Pressable>
          ) : isTracking ? (
            <Pressable style={[styles.trackButton, styles.stopButton, { flex: 1 }]} onPress={stopTracking}>
              <Ionicons name="stop" size={20} color={colours.background} />
              <Text style={styles.trackButtonText}>Stop Tracking</Text>
            </Pressable>
          ) : startTime ? (
            <>
              <Pressable style={[styles.trackButton, { flex: 1 }]} onPress={resumeTracking}>
                <Ionicons name="play" size={20} color={colours.background} />
                <Text style={styles.trackButtonText}>Resume</Text>
              </Pressable>
              <Pressable style={[styles.saveButton, { flex: 1 }]} onPress={openRuckReview}>
                <Text style={styles.saveButtonText}>Review Ruck</Text>
              </Pressable>
              <Pressable style={[styles.trackButton, styles.discardButton]} onPress={discardTrackedRuck}>
                <Ionicons name="close" size={20} color={colours.text} />
                <Text style={[styles.trackButtonText, { color: colours.text }]}>Discard</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </SafeAreaView>
    );
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
              {rejectedPointCount > 0 ? ` | ${rejectedPointCount} rejected${lastRejectedReason ? ` (${lastRejectedReason})` : ''}` : ''}
            </Text>
          </View>
          <View style={[styles.signalBadge, { borderColor: statusColors(gpsQuality.tone).borderMed, backgroundColor: statusColors(gpsQuality.tone).bgMed }]}>
            <View style={[styles.signalDot, { backgroundColor: gpsQuality.tone }]} />
            <Text style={[styles.signalText, { color: gpsQuality.tone }]}>
              {isTracking ? gpsQuality.label : 'IDLE'}
            </Text>
          </View>
        </View>

        <View style={styles.coordinateSelector}>
          {coordinateFormatOptions.map((option) => {
            const selected = coordinateFormat === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.coordinateOption, selected && styles.coordinateOptionActive]}
                onPress={() => setCoordinateFormat(option.key)}
              >
                <Text style={[styles.coordinateOptionText, selected && styles.coordinateOptionTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.layerSelector}>
          {mapLayerOptions.map((option) => {
            const selected = mapLayer === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.layerOption, selected && styles.layerOptionActive]}
                onPress={() => setMapLayer(option.key)}
              >
                <Text style={[styles.layerOptionText, selected && styles.layerOptionTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {renderMapStage(false)}

        <Pressable
          style={[styles.expandMapButton, showExpandedMap && styles.expandMapButtonActive, hasActiveGpsSession && styles.expandMapButtonLocked]}
          onPress={() => setMapExpanded((current) => !current)}
          disabled={hasActiveGpsSession}
        >
          <Ionicons name={showExpandedMap ? 'contract' : 'expand'} size={17} color={showExpandedMap ? colours.background : colours.cyan} />
          <Text style={[styles.expandMapButtonText, showExpandedMap && styles.expandMapButtonTextActive]}>
            {hasActiveGpsSession ? 'Field map active' : showExpandedMap ? 'Compact map' : 'Field map'}
          </Text>
        </Pressable>

        <View style={styles.liveStats}>
          <View style={styles.liveStat}>
            <Text style={styles.liveValue}>{currentDistance.toFixed(2)}</Text>
            <Text style={styles.liveLabel}>KM</Text>
          </View>
          <View style={styles.liveStat}>
            <LiveTimerText startTime={startTime} isTracking={isTracking} staticSeconds={elapsedSeconds} style={styles.liveValue} />
            <Text style={styles.liveLabel}>TIME</Text>
          </View>
          <View style={styles.liveStat}>
            <Text style={styles.liveValue}>{displayBearing == null ? '--' : formatHeading(displayBearing)}</Text>
            <Text style={styles.liveLabel}>BRG</Text>
          </View>
          <View style={styles.liveStat}>
            <Text style={styles.liveValue}>{activePace}</Text>
            <Text style={styles.liveLabel}>MIN/KM</Text>
          </View>
        </View>

        {currentPoint && currentCoordinate && (
        <Text style={styles.coordinateText}>
          {!gpsFollowMode && mapCenter ? `Map centre: ${mapCenterCoordinate}` : currentCoordinate}
          {currentPoint.accuracy ? ` | +/-${Math.round(currentPoint.accuracy)}m` : ''}
        </Text>
        )}
      </Card>

      {reviewOpen && startTime ? (
        <Card style={styles.reviewCard}>
          <View style={styles.navHeader}>
            <View>
              <Text style={styles.cardTitle}>Ruck Review</Text>
              <Text style={styles.muted}>Confirm the session before it hits your log.</Text>
            </View>
            <View style={[styles.signalBadge, { borderColor: statusColors(routeReview.confidence === 'High' ? colours.green : routeReview.confidence === 'Medium' ? colours.amber : colours.red).borderMed, backgroundColor: statusColors(routeReview.confidence === 'High' ? colours.green : routeReview.confidence === 'Medium' ? colours.amber : colours.red).bgMed }]}>
              <Text style={[styles.signalText, { color: routeReview.confidence === 'High' ? colours.green : routeReview.confidence === 'Medium' ? colours.amber : colours.red }]}>
                {routeReview.confidence.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.reviewGrid}>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{currentDistance.toFixed(2)}km</Text>
              <Text style={styles.reviewLabel}>Distance</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{formatElapsed(elapsedSeconds)}</Text>
              <Text style={styles.reviewLabel}>Time</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{activePace}</Text>
              <Text style={styles.reviewLabel}>Min/km</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{weight}kg</Text>
              <Text style={styles.reviewLabel}>Load</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{routeReview.averageAccuracyMeters ? `+/-${routeReview.averageAccuracyMeters}m` : 'Unknown'}</Text>
              <Text style={styles.reviewLabel}>Avg GPS</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{rejectedPointCount}</Text>
              <Text style={styles.reviewLabel}>Rejected</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{routeReview.reachedCheckpoints}/{routeReview.totalCheckpoints}</Text>
              <Text style={styles.reviewLabel}>Checkpoints</Text>
            </View>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewValue}>{splits.length}</Text>
              <Text style={styles.reviewLabel}>Splits</Text>
            </View>
          </View>

          <TextInput
            value={ruckReviewNote}
            onChangeText={setRuckReviewNote}
            placeholder="Session note, kit issue, terrain, pain, weather..."
            placeholderTextColor={colours.soft}
            style={styles.reviewNoteInput}
            multiline
          />

          <View style={styles.reviewActions}>
            <Pressable style={styles.saveButton} onPress={saveTrackedRuck}>
              <Text style={styles.saveButtonText}>Save Ruck</Text>
            </Pressable>
            <Pressable style={styles.trackButton} onPress={resumeTracking}>
              <Ionicons name="play" size={18} color={colours.background} />
              <Text style={styles.trackButtonText}>Resume</Text>
            </Pressable>
            <Pressable style={[styles.trackButton, styles.discardButton]} onPress={discardTrackedRuck}>
              <Ionicons name="close" size={18} color={colours.text} />
              <Text style={[styles.trackButtonText, { color: colours.text }]}>Discard</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      {!reviewOpen ? (
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
            <Pressable style={styles.trackButton} onPress={resumeTracking}>
              <Ionicons name="play" size={20} color={colours.background} />
              <Text style={styles.trackButtonText}>Resume</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={openRuckReview}>
              <Text style={styles.saveButtonText}>Review Ruck</Text>
            </Pressable>
            <Pressable style={[styles.trackButton, styles.discardButton]} onPress={discardTrackedRuck}>
              <Ionicons name="close" size={20} color={colours.text} />
              <Text style={[styles.trackButtonText, { color: colours.text }]}>Discard</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.trackButton, isStarting && styles.trackButtonDisabled]}
            onPress={() => startTracking()}
            disabled={isStarting}
          >
            <Ionicons name={isStarting ? 'sync' : 'play'} size={20} color={colours.background} />
            <Text style={styles.trackButtonText}>{isStarting ? 'Starting GPS...' : 'Start GPS Tracking'}</Text>
          </Pressable>
        )}
      </View>
      ) : null}

      <Card>
        <View style={styles.navHeader}>
          <View>
            <Text style={styles.cardTitle}>Ruck History</Text>
            <Text style={styles.muted}>Saved loaded movement, GPS quality, and field notes</Text>
          </View>
          <View style={styles.historyCountBadge}>
            <Text style={styles.historyCountText}>{ruckHistory.length}</Text>
          </View>
        </View>

        {selectedHistoryRuck ? (
          <>
            <View style={styles.historyDetail}>
              <View style={styles.historyDetailHeader}>
                <View style={styles.sessionIcon}>
                  <Ionicons name="footsteps-outline" size={18} color={colours.cyan} />
                </View>
                <View style={styles.historyDetailCopy}>
                  <Text style={styles.historyTitle}>{selectedHistoryRuck.title}</Text>
                  <Text style={styles.historyMeta}>
                    {formatSessionDate(selectedHistoryRuck)} | {selectedHistoryRuck.durationMinutes} min | RPE {selectedHistoryRuck.rpe}
                  </Text>
                </View>
              </View>

              <View style={styles.historyMetricGrid}>
                <View style={styles.historyMetric}>
                  <Text style={styles.historyMetricValue}>{estimateRuckSessionDistanceKm(selectedHistoryRuck).toFixed(2)}km</Text>
                  <Text style={styles.historyMetricLabel}>Distance</Text>
                </View>
                <View style={styles.historyMetric}>
                  <Text style={styles.historyMetricValue}>{selectedHistoryRuck.loadKg ?? 0}kg</Text>
                  <Text style={styles.historyMetricLabel}>Load</Text>
                </View>
                <View style={styles.historyMetric}>
                  <Text style={styles.historyMetricValue}>
                    {estimateRuckSessionDistanceKm(selectedHistoryRuck) > 0
                      ? (selectedHistoryRuck.durationMinutes / estimateRuckSessionDistanceKm(selectedHistoryRuck)).toFixed(1)
                      : '--'}
                  </Text>
                  <Text style={styles.historyMetricLabel}>Min/km</Text>
                </View>
                <View style={styles.historyMetric}>
                  <Text style={[
                    styles.historyMetricValue,
                    {
                      color: selectedHistoryRuck.routeConfidence === 'Low'
                        ? colours.red
                        : selectedHistoryRuck.routeConfidence === 'Medium'
                          ? colours.amber
                          : colours.green,
                    },
                  ]}>
                    {selectedHistoryRuck.routeConfidence ?? 'Manual'}
                  </Text>
                  <Text style={styles.historyMetricLabel}>GPS</Text>
                </View>
              </View>

              {selectedHistoryRuck.note ? (
                <Text style={styles.historyNote}>{selectedHistoryRuck.note}</Text>
              ) : null}

              <Text style={styles.historyQuality}>
                {selectedHistoryRuck.averageAccuracyMeters ? `Average GPS +/-${selectedHistoryRuck.averageAccuracyMeters}m` : 'No GPS accuracy saved'}
                {selectedHistoryRuck.rejectedPointCount != null ? ` | ${selectedHistoryRuck.rejectedPointCount} rejected point${selectedHistoryRuck.rejectedPointCount === 1 ? '' : 's'}` : ''}
                {selectedHistoryRuck.ruckMission?.plannedCheckpoints?.length ? ` | ${selectedHistoryRuck.ruckMission.plannedCheckpoints.filter((checkpoint) => checkpoint.status === 'reached').length}/${selectedHistoryRuck.ruckMission.plannedCheckpoints.length} checkpoints` : ''}
              </Text>
            </View>

            <View style={styles.historyList}>
              {ruckHistory.map((session) => {
                const selected = session.id === selectedHistoryRuck.id;
                return (
                  <Pressable
                    key={session.id}
                    style={[styles.historyRow, selected && styles.historyRowActive]}
                    onPress={() => setSelectedHistoryId(session.id)}
                  >
                    <View style={styles.historyRowCopy}>
                      <Text style={styles.historyRowTitle}>{session.title}</Text>
                      <Text style={styles.historyRowMeta}>
                        {formatSessionDate(session)} | {session.durationMinutes} min | {session.loadKg ?? 0}kg
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={selected ? colours.cyan : colours.muted} />
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyHistory}>
            <Text style={styles.historyTitle}>No rucks saved yet</Text>
            <Text style={styles.historyMeta}>Track a GPS ruck or save a planned ruck to build your loaded movement history.</Text>
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.navHeader}>
          <View>
            <Text style={styles.cardTitle}>Mission Pace</Text>
            <Text style={styles.muted}>Target, splits, checkpoints</Text>
          </View>
          <View style={[styles.signalBadge, { borderColor: statusColors(targetDeltaMinutes <= 0 ? colours.green : colours.amber).borderMed, backgroundColor: statusColors(targetDeltaMinutes <= 0 ? colours.green : colours.amber).bgMed }]}>
            <Text style={[styles.signalText, { color: targetDeltaMinutes <= 0 ? colours.green : colours.amber }]}>
              {currentDistance > 0.02 ? formatSignedMinutes(targetDeltaMinutes).toUpperCase() : 'READY'}
            </Text>
          </View>
        </View>

        <View style={styles.templateGrid}>
          {allRuckTemplates.map((template) => {
            const selected = activeTemplateId === template.id;
            return (
              <Pressable
                key={template.id}
                style={[styles.templateButton, selected && styles.templateButtonActive]}
                onPress={() => applyTemplate(template)}
              >
                {template.custom && (
                  <Pressable style={styles.templateDelete} onPress={() => deleteCustomTemplate(template.id)}>
                    <Ionicons name="close" size={13} color={colours.text} />
                  </Pressable>
                )}
                <Text style={[styles.templateTitle, selected && styles.templateTitleActive]}>{template.label}</Text>
                <Text style={styles.templateDetail}>{template.detail}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.templateSaveRow}>
          <TextInput
            value={templateNameInput}
            onChangeText={setTemplateNameInput}
            placeholder="Template name"
            placeholderTextColor={colours.soft}
            style={styles.templateNameInput}
          />
          <Pressable style={styles.templateSaveButton} onPress={saveCustomTemplate}>
            <Ionicons name="save" size={16} color={colours.background} />
            <Text style={styles.templateSaveText}>Save</Text>
          </Pressable>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Target Distance</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeTargetDistance(-0.5)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{targetDistanceKm.toFixed(1)}km</Text>
            <Pressable style={styles.smallButton} onPress={() => changeTargetDistance(0.5)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Target Time</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeTargetMinutes(-5)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{formatDuration(targetMinutes)}</Text>
            <Pressable style={styles.smallButton} onPress={() => changeTargetMinutes(5)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.navGrid}>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{targetPaceLabel}</Text>
            <Text style={styles.navLabel}>Target pace</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{targetRemainingKm.toFixed(1)}km</Text>
            <Text style={styles.navLabel}>Remaining</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{formatDuration(targetEtaMinutes)}</Text>
            <Text style={styles.navLabel}>ETA at current pace</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{targetProjectedMinutes == null ? '--' : formatDuration(targetProjectedMinutes)}</Text>
            <Text style={styles.navLabel}>Projected finish</Text>
          </View>
        </View>

        <View style={styles.finishModeRow}>
          {([
            ['target', 'Target'],
            ['finalCheckpoint', 'Final CP'],
            ['selectedCheckpoint', 'Selected CP'],
          ] as const).map(([mode, label]) => {
            const selected = finishMode === mode;
            return (
              <Pressable
                key={mode}
                style={[styles.finishModeButton, selected && styles.finishModeButtonActive]}
                onPress={() => setFinishMode(mode)}
              >
                <Text style={[styles.finishModeText, selected && styles.finishModeTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.finishPanel, { borderColor: statusColors(finishOnTarget ? colours.green : colours.amber).borderMed, backgroundColor: statusColors(finishOnTarget ? colours.green : colours.amber).bgMed }]}>
          <View>
            <Text style={[styles.finishPanelTitle, { color: finishOnTarget ? colours.green : colours.amber }]}>
              {finishOnTarget ? 'Finish on target' : 'Finish at risk'}
            </Text>
            <Text style={styles.finishPanelDetail}>{finishLabel}</Text>
          </View>
          <View style={styles.finishPanelMetrics}>
            <View style={styles.finishMetric}>
              <Text style={styles.finishMetricValue}>{finishDistanceRemainingKm.toFixed(1)}km</Text>
              <Text style={styles.finishMetricLabel}>LEFT</Text>
            </View>
            <View style={styles.finishMetric}>
              <Text style={styles.finishMetricValue}>{formatDuration(finishEtaMinutes)}</Text>
              <Text style={styles.finishMetricLabel}>ETA</Text>
            </View>
            <View style={styles.finishMetric}>
              <Text style={styles.finishMetricValue}>{finishRequiredPace > 0 ? finishRequiredPace.toFixed(1) : '--'}</Text>
              <Text style={styles.finishMetricLabel}>REQ /KM</Text>
            </View>
          </View>
        </View>
      </Card>

      <Card>
        <View style={styles.navHeader}>
          <View>
            <Text style={styles.cardTitle}>Route Readiness</Text>
            <Text style={styles.muted}>{routeReadinessChecks.blockingIssues === 0 ? 'Plan checks clear' : `${routeReadinessChecks.blockingIssues} item(s) need attention`}</Text>
          </View>
          <View style={[styles.readinessBadge, { borderColor: statusColors(routeReadinessChecks.tone).borderMed, backgroundColor: statusColors(routeReadinessChecks.tone).bgMed }]}>
            <Text style={[styles.readinessBadgeText, { color: routeReadinessChecks.tone }]}>{routeReadinessChecks.status}</Text>
          </View>
        </View>

        <View style={styles.readinessList}>
          {routeReadinessChecks.checks.map((check) => (
            <View key={check.label} style={styles.readinessRow}>
              <View style={[styles.readinessDot, { backgroundColor: check.tone }]} />
              <Text style={styles.readinessLabel}>{check.label}</Text>
              <Text style={[styles.readinessValue, { color: check.tone }]}>{check.value}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.navHeader}>
          <View>
            <Text style={styles.cardTitle}>1km Splits</Text>
            <Text style={styles.muted}>{splits.length > 0 ? `${splits.length} completed` : 'Auto records while GPS moves'}</Text>
          </View>
          <View style={styles.splitBadge}>
            <Text style={styles.splitBadgeValue}>{latestSplit ? `${Math.round(latestSplit.splitSeconds / 60)}m` : '--'}</Text>
            <Text style={styles.splitBadgeLabel}>LAST</Text>
          </View>
        </View>

        {splits.length === 0 ? (
          <Text style={styles.navGuide}>Your first split appears when the tracked route reaches 1km.</Text>
        ) : (
          <View style={styles.splitList}>
            {splits.slice(-5).map((split) => (
              <View key={split.km} style={styles.splitRow}>
                <Text style={styles.splitKm}>KM {split.km}</Text>
                <Text style={styles.splitValue}>{formatElapsed(split.splitSeconds)}</Text>
                <Text style={styles.splitMeta}>{formatElapsed(split.elapsedSeconds)} total</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <View style={styles.navHeader}>
          <View>
            <Text style={styles.cardTitle}>Checkpoint Planner</Text>
            <Text style={styles.muted}>
              {arrivalCheckpoint
                ? `${arrivalCheckpoint.label} reached inside ${CHECKPOINT_ARRIVAL_RADIUS_METERS}m`
                : plannedCheckpoints.length > 0
                  ? `${plannedCheckpoints.length} mapped${nearestCheckpoint ? ` | nearest ${Math.round(nearestCheckpoint.distanceKm * 1000)}m` : ''}`
                  : 'Add current GPS or enter grid'}
            </Text>
          </View>
          <Pressable style={styles.checkpointButton} onPress={addCheckpointHere}>
            <Ionicons name="locate" size={16} color={colours.background} />
            <Text style={styles.checkpointButtonText}>Here</Text>
          </Pressable>
        </View>

        <View style={[styles.bearingPanel, { borderColor: statusColors(bearingGuidance.tone).borderMed, backgroundColor: statusColors(bearingGuidance.tone).bgMed }]}>
          <View>
            <Text style={[styles.bearingPanelTitle, { color: bearingGuidance.tone }]}>{bearingGuidance.label}</Text>
            <Text style={styles.bearingPanelDetail}>{bearingGuidance.detail}</Text>
          </View>
          <View style={styles.bearingPanelMetric}>
            <Text style={styles.bearingPanelValue}>{selectedCheckpointBearing == null ? '--' : formatHeading(selectedCheckpointBearing)}</Text>
            <Text style={styles.bearingPanelLabel}>TO CP</Text>
          </View>
        </View>

        <View style={styles.coordinateEntry}>
          <TextInput
            value={checkpointCoordinateInput}
            onChangeText={setCheckpointCoordinateInput}
            placeholder={coordinateFormat === 'mgrs' ? '29U PV 82123 12345' : coordinateFormat === 'utm' ? '29U 682123E 5912345N' : '53.34981, -6.26031'}
            placeholderTextColor={colours.soft}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.coordinateInput}
          />
          <Pressable style={styles.coordinateAddButton} onPress={addCheckpointFromInput}>
            <Ionicons name="add" size={18} color={colours.background} />
          </Pressable>
        </View>
        <View style={styles.checkpointActions}>
          <Pressable style={styles.clearCheckpointButton} onPress={updateSelectedCheckpointFromInput} disabled={!selectedCheckpoint}>
            <Text style={styles.clearCheckpointText}>Move to grid</Text>
          </Pressable>
          <Pressable style={styles.clearCheckpointButton} onPress={updateSelectedCheckpointHere} disabled={!selectedCheckpoint}>
            <Text style={styles.clearCheckpointText}>Move here</Text>
          </Pressable>
        </View>

        {selectedCheckpoint ? (
          <>
            <View style={styles.coordinateEntry}>
              <TextInput
                value={checkpointLabelInput}
                onChangeText={setCheckpointLabelInput}
                placeholder="Checkpoint label"
                placeholderTextColor={colours.soft}
                autoCapitalize="words"
                style={styles.coordinateInput}
              />
              <Pressable style={styles.coordinateAddButton} onPress={saveSelectedCheckpointLabel}>
                <Ionicons name="checkmark" size={18} color={colours.background} />
              </Pressable>
            </View>

            <View style={styles.statusRow}>
              {(['planned', 'reached', 'skipped'] as const).map((statusOption) => {
                const selected = selectedCheckpoint.status === statusOption;
                return (
                  <Pressable
                    key={statusOption}
                    style={[styles.statusButton, selected && styles.statusButtonActive]}
                    onPress={() => setSelectedCheckpointStatus(statusOption)}
                  >
                    <Text style={[styles.statusButtonText, selected && styles.statusButtonTextActive]}>{statusOption.toUpperCase()}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.navGrid}>
              <View style={styles.navItem}>
                <Text style={styles.navValue}>{selectedCheckpoint.label}</Text>
                <Text style={styles.navLabel}>{selectedCheckpoint.status} | {selectedCheckpoint.source === 'current' ? 'GPS checkpoint' : 'Manual checkpoint'}</Text>
              </View>
              <View style={styles.navItem}>
                <Text style={styles.navValue}>{selectedCheckpointDistanceKm == null ? '--' : `${selectedCheckpointDistanceKm.toFixed(2)}km`}</Text>
                <Text style={styles.navLabel}>Distance to CP</Text>
              </View>
              <View style={styles.navItem}>
                <Text style={styles.navValue}>{selectedCheckpointBearing == null ? '--' : formatHeading(selectedCheckpointBearing)}</Text>
                <Text style={styles.navLabel}>Bearing to CP</Text>
              </View>
              <View style={styles.navItem}>
                <Text style={styles.navValue}>{selectedCheckpointEtaMinutes == null ? '--' : formatDuration(selectedCheckpointEtaMinutes)}</Text>
                <Text style={styles.navLabel}>ETA to CP</Text>
              </View>
            </View>
            <Text style={styles.coordinateText}>
              {selectedCheckpointPoint
                ? formatCoordinate(selectedCheckpointPoint.latitude, selectedCheckpointPoint.longitude, coordinateFormat)
                : 'NEEDS GRID'}
            </Text>
            <View style={styles.checkpointList}>
              {plannedCheckpoints.map((checkpoint) => {
                const selected = selectedCheckpoint.id === checkpoint.id;
                return (
                  <Pressable
                    key={checkpoint.id}
                    style={[styles.checkpointPill, selected && styles.checkpointPillActive]}
                    onPress={() => setSelectedCheckpointId(checkpoint.id)}
                  >
                    <Text style={[styles.checkpointPillText, selected && styles.checkpointPillTextActive]}>{checkpoint.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.checkpointActions}>
              <Pressable style={styles.clearCheckpointButton} onPress={clearSelectedCheckpoint}>
                <Text style={styles.clearCheckpointText}>Remove selected</Text>
              </Pressable>
              <Pressable style={styles.clearCheckpointButton} onPress={undoLastCheckpoint}>
                <Text style={styles.clearCheckpointText}>Undo last</Text>
              </Pressable>
              <Pressable style={styles.clearCheckpointButton} onPress={clearAllCheckpoints}>
                <Text style={styles.clearCheckpointText}>Clear all</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.navGuide}>Use the active coordinate format selector above the map. LAT/LON, DMS, UTM, and MGRS are accepted.</Text>
        )}

        <TextInput
          value={checkpointBulkInput}
          onChangeText={setCheckpointBulkInput}
          placeholder={'Bulk import, one per line\nRV: 29U PV 82123 12345\nBridge: 29U 682123E 5912345N'}
          placeholderTextColor={colours.soft}
          autoCapitalize="characters"
          autoCorrect={false}
          multiline
          style={styles.bulkInput}
        />
        <Pressable style={styles.importButton} onPress={importCheckpoints}>
          <Ionicons name="download" size={16} color={colours.background} />
          <Text style={styles.checkpointButtonText}>Import checkpoints</Text>
        </Pressable>
      </Card>

      <Card>
        <View style={styles.navHeader}>
          <View>
            <Text style={styles.cardTitle}>Checkpoint Mode</Text>
            <Text style={styles.muted}>{checkpointStatus}</Text>
          </View>
          <Pressable
            style={[styles.checkpointButton, checkpointIndex >= checkpointCount && styles.checkpointButtonDisabled]}
            onPress={markCheckpointReached}
            disabled={checkpointIndex >= checkpointCount}
          >
            <Ionicons name="flag" size={16} color={colours.background} />
            <Text style={styles.checkpointButtonText}>Mark</Text>
          </Pressable>
          <Pressable
            style={[styles.undoMarkButton, checkpointIndex <= 0 && styles.checkpointButtonDisabled]}
            onPress={undoCheckpointMark}
            disabled={checkpointIndex <= 0}
          >
            <Ionicons name="arrow-undo" size={16} color={colours.text} />
          </Pressable>
        </View>

        <View style={styles.controlRow}>
          <Text style={styles.controlLabel}>Checkpoint Every</Text>
          <View style={styles.buttons}>
            <Pressable style={styles.smallButton} onPress={() => changeCheckpointInterval(-0.5)}>
              <Text style={styles.smallButtonText}>-</Text>
            </Pressable>
            <Text style={styles.controlValue}>{checkpointIntervalKm.toFixed(1)}km</Text>
            <Pressable style={styles.smallButton} onPress={() => changeCheckpointInterval(0.5)}>
              <Text style={styles.smallButtonText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.navGrid}>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{nextCheckpointKm.toFixed(1)}km</Text>
            <Text style={styles.navLabel}>Next checkpoint</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{checkpointRemainingKm.toFixed(1)}km</Text>
            <Text style={styles.navLabel}>Distance to CP</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{formatDuration(checkpointEtaMinutes)}</Text>
            <Text style={styles.navLabel}>ETA to CP</Text>
          </View>
          <View style={styles.navItem}>
            <Text style={styles.navValue}>{displayBearing == null ? '--' : formatHeading(displayBearing)}</Text>
            <Text style={styles.navLabel}>Current bearing</Text>
          </View>
        </View>
      </Card>

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
  muted: { ...typography.caption, color: colours.muted },
  title: { color: colours.text, fontSize: 32, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  platformNote: { ...typography.caption, color: colours.amber, lineHeight: 18, marginTop: -8, marginBottom: 8 },
  mapCard: { backgroundColor: '#0F1F35' },
  mapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: responsiveSpacing('md') },
  mapLabel: { ...typography.label, color: colours.cyan, letterSpacing: 1.8 },
  mapText: { color: colours.text, fontWeight: '900', marginTop: 2 },
  mapSubText: { ...typography.caption, color: colours.muted, marginTop: 3 },
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
  signalText: { ...typography.label, color: colours.muted, letterSpacing: 1 },
  coordinateSelector: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  coordinateOption: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  coordinateOptionActive: { backgroundColor: colours.cyan },
  coordinateOptionText: { ...typography.label, color: colours.muted },
  coordinateOptionTextActive: { color: colours.background },
  layerSelector: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  layerOption: {
    flex: 1,
    minHeight: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 4,
  },
  layerOptionActive: {
    borderColor: statusColors(colours.green).borderMed,
    backgroundColor: statusColors(colours.green).bgMed,
  },
  layerOptionText: { ...typography.label, color: colours.muted },
  layerOptionTextActive: { color: colours.green },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#0F1F35',
  },
  fullscreenMapStage: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(4,8,15,0.72)',
  },
  fullscreenBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: 'rgba(4,8,15,0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(103,232,249,0.14)',
  },
  fullscreenStatusPanel: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fullscreenStatusLabel: { ...typography.caption, fontWeight: '900', letterSpacing: 0.8 },
  fullscreenStatusDetail: { ...typography.caption, color: colours.textSoft, fontWeight: '800', marginTop: 2 },
  fullscreenCollapseBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colours.border,
    flexShrink: 0,
  },
  mapTelemetryFullscreen: { bottom: 142 },
  mapMissionStripFullscreen: { bottom: 198 },
  finishStripFullscreen: { bottom: 238 },
  bearingGuidanceStripFullscreen: { bottom: 278 },
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
  mapStageExpanded: {
    height: 360,
  },
  mapShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,8,15,0.16)',
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
  mapRingOuter: { width: 170, height: 170, borderRadius: 85, top: '50%', marginTop: -85 },
  mapRingInner: { width: 92, height: 92, borderRadius: 46, top: '50%', marginTop: -46 },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  mapEmptyText: { color: colours.muted, fontWeight: '700' },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairHorizontal: { width: 30, height: 1, backgroundColor: 'rgba(255,255,255,0.82)' },
  crosshairVertical: { position: 'absolute', width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.82)' },
  mapAttribution: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.32)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapSelectControls: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 88,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mapSelectButton: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    backgroundColor: 'rgba(4,8,15,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 9,
  },
  mapSelectButtonActive: {
    backgroundColor: colours.cyan,
    borderColor: colours.cyan,
  },
  mapSelectButtonText: { ...typography.label, color: colours.cyan },
  mapSelectButtonTextActive: { color: colours.background },
  mapGridOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 88,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(4,8,15,0.72)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  mapOverlayLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.4 },
  mapOverlayValue: { color: colours.text, fontSize: 12, fontWeight: '900', marginTop: 2 },
  mapCompassOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyan,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.44)',
  },
  mapCompassValue: { ...typography.label, color: colours.background, marginTop: 1 },
  mapCompassLabel: { color: 'rgba(7,17,30,0.72)', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  mapTelemetry: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 26,
    flexDirection: 'row',
    gap: 6,
  },
  mapTelemetryItem: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    backgroundColor: 'rgba(4,8,15,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  mapTelemetryValue: { color: colours.text, fontSize: 14, fontWeight: '900' },
  mapTelemetryLabel: { ...typography.label, color: colours.muted, letterSpacing: 1, marginTop: 2 },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  templateButton: {
    width: '48%',
    flexGrow: 1,
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    position: 'relative',
  },
  templateButtonActive: {
    borderColor: statusColors(colours.cyan).borderMed,
    backgroundColor: statusColors(colours.cyan).bgMed,
  },
  templateTitle: { color: colours.text, fontSize: 12, fontWeight: '900' },
  templateTitleActive: { color: colours.cyan },
  templateDetail: { ...typography.caption, color: colours.muted, fontWeight: '800', marginTop: 3 },
  templateDelete: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  templateSaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  templateNameInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...typography.caption, color: colours.text,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  templateSaveButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  templateSaveText: { ...typography.caption, color: colours.background, fontWeight: '900' },
  mapMissionStrip: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 82,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(4,8,15,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 6,
    paddingHorizontal: 8,
  },
  mapMissionText: { ...typography.label, color: colours.text },
  bearingGuidanceStrip: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 162,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
  },
  bearingGuidanceLabel: { ...typography.caption, fontWeight: '900' },
  bearingGuidanceDetail: { ...typography.label, color: colours.text, flex: 1, textAlign: 'right' },
  finishStrip: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 122,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(4,8,15,0.74)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: 6,
    paddingHorizontal: 8,
  },
  finishStripText: { ...typography.label, color: colours.text },
  expandMapButton: {
    minHeight: 40,
    marginTop: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  expandMapButtonActive: {
    borderColor: `${colours.cyan}66`,
    backgroundColor: colours.cyan,
  },
  expandMapButtonLocked: { opacity: 0.92 },
  expandMapButtonText: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  expandMapButtonTextActive: { color: colours.background },
  liveStats: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('md') },
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
  liveLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.3, marginTop: 2 },
  coordinateText: { ...typography.caption, color: colours.muted, textAlign: 'center', marginTop: 10 },
  trackingControls: { marginBottom: 16 },
  trackButton: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colours.green, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  trackButtonDisabled: { opacity: 0.62 },
  trackButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  stopButton: { backgroundColor: colours.red },
  trackingActive: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  saveButton: { minHeight: touchTarget, backgroundColor: colours.cyan, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flex: 1 },
  saveButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },
  discardButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colours.border, borderWidth: 1 },
  reviewCard: { borderColor: 'rgba(103,232,249,0.28)' },
  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  reviewItem: {
    width: '47%',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 11,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  reviewValue: { color: colours.text, fontSize: 17, fontWeight: '900' },
  reviewLabel: { ...typography.label, color: colours.muted, marginTop: 3 },
  reviewNoteInput: {
    minHeight: 86,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    textAlignVertical: 'top',
  },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  historyCountBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderHot,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyanDim,
  },
  historyCountText: { color: colours.cyan, fontWeight: '900', fontSize: 14 },
  historyDetail: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: responsiveSpacing('md'),
    marginTop: responsiveSpacing('md'),
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  historyDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: colours.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyDetailCopy: { flex: 1 },
  historyTitle: { color: colours.text, fontSize: 15, fontWeight: '900' },
  historyMeta: { ...typography.caption, color: colours.muted, fontWeight: '800', marginTop: 3 },
  historyMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('md') },
  historyMetric: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 9,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  historyMetricValue: { color: colours.text, fontSize: 15, fontWeight: '900' },
  historyMetricLabel: { ...typography.label, color: colours.muted, marginTop: 2 },
  historyNote: {
    ...typography.caption, color: colours.textSoft,
    lineHeight: 18,
    borderLeftWidth: 2,
    borderLeftColor: colours.cyan,
    paddingLeft: 10,
    marginTop: 12,
  },
  historyQuality: { ...typography.caption, color: colours.muted, fontWeight: '800', lineHeight: 16, marginTop: 10 },
  historyList: { gap: 8, marginTop: 12 },
  historyRow: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  historyRowActive: { borderColor: statusColors(colours.cyan).borderMed, backgroundColor: statusColors(colours.cyan).bgMed },
  historyRowCopy: { flex: 1 },
  historyRowTitle: { color: colours.text, fontSize: 12, fontWeight: '900' },
  historyRowMeta: { ...typography.label, color: colours.muted, marginTop: 2 },
  emptyHistory: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('md') },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: responsiveSpacing('sm'), gap: responsiveSpacing('md') },
  controlLabel: { color: colours.text, fontWeight: '800' },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallButton: { width: touchTarget, height: touchTarget, borderRadius: 8, backgroundColor: colours.cyan, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { color: '#07111E', fontSize: 20, fontWeight: '900' },
  controlValue: { color: colours.text, fontWeight: '900', width: 55, textAlign: 'center' },
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  compassDial: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.cyan,
  },
  compassText: { ...typography.label, color: colours.background, marginTop: 1 },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: responsiveSpacing('sm'), marginTop: responsiveSpacing('md') },
  navItem: {
    width: '47%',
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    padding: responsiveSpacing('md'),
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  navValue: { color: colours.cyan, fontSize: 17, fontWeight: '900' },
  navLabel: { ...typography.label, color: colours.muted, marginTop: 3 },
  navGuide: { color: colours.textSoft, fontSize: 13, lineHeight: 19, marginTop: 12 },
  splitBadge: {
    minWidth: 58,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  splitBadgeValue: { color: colours.cyan, fontSize: 15, fontWeight: '900' },
  splitBadgeLabel: { ...typography.label, color: colours.muted, letterSpacing: 1 },
  splitList: { marginTop: 12, gap: 8 },
  splitRow: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
  },
  splitKm: { ...typography.caption, color: colours.text, fontWeight: '900', width: 52 },
  splitValue: { color: colours.cyan, fontSize: 15, fontWeight: '900', flex: 1, textAlign: 'center' },
  splitMeta: { ...typography.caption, color: colours.muted, fontWeight: '800', width: 84, textAlign: 'right' },
  finishModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  finishModeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  finishModeButtonActive: {
    borderColor: statusColors(colours.cyan).borderMed,
    backgroundColor: statusColors(colours.cyan).bgMed,
  },
  finishModeText: { ...typography.caption, color: colours.muted, fontWeight: '900' },
  finishModeTextActive: { color: colours.cyan },
  finishPanel: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
    gap: 10,
  },
  finishPanelTitle: { fontSize: 14, fontWeight: '900' },
  finishPanelDetail: { color: colours.textSoft, fontSize: 12, fontWeight: '800', marginTop: 2 },
  finishPanelMetrics: { flexDirection: 'row', gap: 8 },
  finishMetric: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  finishMetricValue: { color: colours.text, fontSize: 13, fontWeight: '900' },
  finishMetricLabel: { ...typography.label, color: colours.muted, letterSpacing: 0.8, marginTop: 2 },
  readinessBadge: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  readinessBadgeText: { ...typography.caption, fontWeight: '900', letterSpacing: 0.8 },
  readinessList: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  readinessRow: {
    minHeight: 42,
    borderTopWidth: 1,
    borderColor: colours.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  readinessDot: { width: 8, height: 8, borderRadius: 4 },
  readinessLabel: { ...typography.caption, color: colours.text, fontWeight: '900', flex: 1 },
  readinessValue: { ...typography.caption, fontWeight: '900', textAlign: 'right' },
  checkpointButton: {
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  checkpointButtonDisabled: { opacity: 0.5 },
  checkpointButtonText: { ...typography.caption, color: colours.background, fontWeight: '900' },
  bearingPanel: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bearingPanelTitle: { fontSize: 13, fontWeight: '900' },
  bearingPanelDetail: { ...typography.caption, color: colours.textSoft, fontWeight: '800', marginTop: 2 },
  bearingPanelMetric: { alignItems: 'flex-end' },
  bearingPanelValue: { color: colours.text, fontSize: 15, fontWeight: '900' },
  bearingPanelLabel: { ...typography.label, color: colours.muted, letterSpacing: 1 },
  coordinateEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  coordinateInput: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...typography.caption, color: colours.text,
    fontWeight: '800',
    paddingHorizontal: 12,
  },
  coordinateAddButton: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulkInput: {
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    ...typography.caption, color: colours.text,
    fontWeight: '800',
    lineHeight: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    textAlignVertical: 'top',
  },
  importButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colours.cyan,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  statusButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  statusButtonActive: {
    borderColor: statusColors(colours.green).borderMed,
    backgroundColor: statusColors(colours.green).bgMed,
  },
  statusButtonText: { ...typography.label, color: colours.muted },
  statusButtonTextActive: { color: colours.green },
  checkpointList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  checkpointPill: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  checkpointPillActive: {
    borderColor: statusColors(colours.amber).borderMed,
    backgroundColor: statusColors(colours.amber).bgMed,
  },
  checkpointPillText: { ...typography.caption, color: colours.muted, fontWeight: '900' },
  checkpointPillTextActive: { color: colours.amber },
  checkpointActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  clearCheckpointButton: {
    minHeight: 40,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  clearCheckpointText: { ...typography.caption, color: colours.muted, fontWeight: '900' },
  undoMarkButton: {
    minHeight: 40,
    width: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: { color: colours.cyan, fontSize: 52, fontWeight: '900', marginVertical: 4 },
  primaryButton: { minHeight: touchTarget, backgroundColor: colours.cyan, borderRadius: 8, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#07111E', fontWeight: '900', fontSize: 16 },
});
