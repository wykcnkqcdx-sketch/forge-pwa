import React, { useCallback, useMemo, useState, useEffect, useRef, useReducer } from 'react';
import { Text, View, StyleSheet, Pressable, DeviceEventEmitter, Animated, Platform, TextInput, SafeAreaView, Modal } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Screen } from '../components/Screen';
import { LiveTimerText } from '../components/LiveTimerText';
import { RuckMissionBriefCard } from '../components/RuckMissionBriefCard';
import { RuckHistoryCard } from '../components/RuckHistoryCard';
import { RuckReviewCard } from '../components/RuckReviewCard';
import { AARScreen } from './AARScreen';
import { RuckTrackingControls } from '../components/RuckTrackingControls';
import { RuckSplitsCard } from '../components/RuckSplitsCard';
import { RuckReadinessCard } from '../components/RuckReadinessCard';
import { RuckNavigationGuideCard } from '../components/RuckNavigationGuideCard';
import { RuckSessionSetupCard } from '../components/RuckSessionSetupCard';
import { RuckMetricSummary } from '../components/RuckMetricSummary';
import { RuckMissionPaceCard } from '../components/RuckMissionPaceCard';
import { RuckPerformancePanel } from '../components/RuckPerformancePanel';
import { RuckCheckpointModeCard } from '../components/RuckCheckpointModeCard';
import { RuckFieldMarksCard } from '../components/RuckFieldMarksCard';
import { RuckTacticalOptionsDrawer } from '../components/RuckTacticalOptionsDrawer';
import { RuckLiveStatsRibbon } from '../components/RuckLiveStatsRibbon';
import { RuckMapHeader } from '../components/RuckMapHeader';
import { RuckMapGuidePanel } from '../components/RuckMapGuidePanel';
import { RuckOpsPanel } from '../components/RuckOpsPanel';
import { colours, touchTarget, shadow, typography } from '../theme';
import { responsiveSpacing, statusColors } from '../utils/styling';
import { showAlert, showConfirm } from '../lib/dialogs';
import { TrainingSession, TrackPoint } from '../data/mockData';
import type { RuckCheckpoint, RuckMissionPlan, RuckSplit } from '../data/domain';
import { distanceBetween, bearingBetween } from '../utils/mapUtils';
import { decimateRouteForMap, sanitizeRoutePoints, WEAK_ACCURACY_METERS } from '../utils/routeQuality';
import { CoordinateFormat, formatCoordinate, parseCoordinate } from '../utils/coordinates';
import { buildVisibleTiles, getMercatorRoutePoints, latLonToWorldPixel, MapLayerKey, mapLayerOptions, MapViewport, worldPixelToLatLon, MapTile } from '../utils/mapTiles';
import { appendActiveRoutePoints, clearActiveRoute, clearActiveRuckPlan, loadActiveRoute, loadActiveRuckPlan, replaceActiveRoute, resetActiveRoute, saveActiveRuckPlan } from '../lib/ruckRouteStore';
import { calculateEnhancedPandolf } from '../lib/h2f';
import { getSessionPRTypes, type PRType } from '../lib/personalRecords';
import { secureGetItem, secureSetItem } from '../lib/secureStorage';
import { LOCATION_TASK_NAME } from '../lib/backgroundTasks';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { parseGpx } from '../lib/gpxParser';
import { useTeamPresence, type SharedFieldObject, type Teammate } from '../lib/teamPresence';
import {
  calculateMeasurementArea,
  calculateMeasurementDistance,
  extractKmlFromKmz,
  formatMeasureArea,
  formatMeasureDistance,
  measurementPointToTrackPoint,
  parseGeoJsonOverlay,
  parseKmlOverlay,
  type MapOverlay,
  type MeasurementMode,
  type MeasurementPoint,
} from '../utils/fieldMapping';
import {
  BEARING_CAUTION_DEGREES,
  BEARING_OFF_DEGREES,
  CHECKPOINT_ARRIVAL_RADIUS_METERS,
  CUSTOM_RUCK_TEMPLATES_KEY,
  RUCK_FIELD_STATE_KEY,
  cardinalDirection,
  formatDuration,
  formatElapsed,
  formatHeading,
  formatSignedMinutes,
  headingDifferenceDegrees,
  initialTrackingState,
  ruckTemplates,
  trackingReducer,
  type FinishMode,
  type RuckMissionMode,
  type RuckTemplate,
} from '../utils/ruck';
import { fieldMarkTypes, formatFieldMarkLabel, getFieldMarkType, type FieldMarkType } from '../utils/ruckFieldMarks';
import { calculateRuckScore } from '../utils/ruckScore';

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
type NavTarget = { type: 'mark' | 'teammate'; id: string };
type TeamEvent = { id: string; time: number; tone: string; title: string; detail: string };
type PersistedFieldState = {
  checkpoints: RuckCheckpoint[];
  drawLines: Array<{ color: string; points: Array<{ lat: number; lon: number }> }>;
  measurementMode: MeasurementMode | null;
  measurementPoints: MeasurementPoint[];
  mapOverlays: MapOverlay[];
  teamEvents: TeamEvent[];
};

export function RuckScreen({
  addSession,
  sessions = [],
  onSessionSaved,
}: {
  addSession: (session: TrainingSession) => void;
  sessions?: TrainingSession[];
  onSessionSaved?: () => void;
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
  const [missionMode, setMissionMode] = useState<RuckMissionMode>('simple');
  const [tacticalOptionsOpen, setTacticalOptionsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'mission' | 'field' | 'metrics' | 'setup' | 'ops'>('mission');
  const [dismissedCallsigns, setDismissedCallsigns] = useState<string[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isDownloadingMap, setIsDownloadingMap] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [targetDistanceKm, setTargetDistanceKm] = useState(8);
  const [targetMinutes, setTargetMinutes] = useState(105);
  const [checkpointIntervalKm, setCheckpointIntervalKm] = useState(2);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [plannedCheckpoints, setPlannedCheckpoints] = useState<RuckCheckpoint[]>([]);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [checkpointCoordinateInput, setCheckpointCoordinateInput] = useState('');
  const [checkpointLabelInput, setCheckpointLabelInput] = useState('');
  const [checkpointBulkInput, setCheckpointBulkInput] = useState('');
  const [activeMarkType, setActiveMarkType] = useState<FieldMarkType>('checkpoint');
  const [tapMarkMode, setTapMarkMode] = useState(false);
  const [finishMode, setFinishMode] = useState<FinishMode>('target');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<RuckTemplate[]>([]);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [planRestored, setPlanRestored] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [ruckReviewNote, setRuckReviewNote] = useState('');
  const [callsign, setCallsign] = useState('LIBERTY');
  const [editingCallsign, setEditingCallsign] = useState(false);
  const [callsignDraft, setCallsignDraft] = useState('');
  const [atakTab, setAtakTab] = useState<'map' | 'cp' | 'offline' | 'nav' | 'ops' | null>(null);
  // GPX import
  const [importedRoute, setImportedRoute] = useState<Array<{ lat: number; lon: number }>>([]);
  const [importedRouteName, setImportedRouteName] = useState<string | null>(null);
  const [mapOverlays, setMapOverlays] = useState<MapOverlay[]>([]);
  // Map drawing
  const [drawMode, setDrawMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#ff4444');
  const [drawLines, setDrawLines] = useState<Array<{ color: string; points: Array<{ lat: number; lon: number }> }>>([]);
  const [currentDrawLine, setCurrentDrawLine] = useState<Array<{ lat: number; lon: number }> | null>(null);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode | null>(null);
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([]);
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);
  // Team PLI
  const [teamEnabled, setTeamEnabled] = useState(false);
  const [emergencyBeacon, setEmergencyBeacon] = useState<{ active: boolean; since: number; message?: string } | null>(null);
  const [teamEvents, setTeamEvents] = useState<TeamEvent[]>([]);
  const [sharedObjects, setSharedObjects] = useState<SharedFieldObject[]>([]);
  const [receivedSharedObjects, setReceivedSharedObjects] = useState<SharedFieldObject[]>([]);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const foregroundLocationSubscription = useRef<Location.LocationSubscription | null>(null);
  const announcedCheckpointArrivals = useRef<Set<string>>(new Set());
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const prevHeading = useRef(0);
  const drawColorRef = useRef(drawColor);
  drawColorRef.current = drawColor;
  const drawModeRef = useRef(drawMode);
  drawModeRef.current = drawMode;
  const tapMarkModeRef = useRef(tapMarkMode);
  tapMarkModeRef.current = tapMarkMode;
  const activeMarkTypeRef = useRef(activeMarkType);
  activeMarkTypeRef.current = activeMarkType;
  const measurementModeRef = useRef(measurementMode);
  measurementModeRef.current = measurementMode;
  const seenEmergencyRef = useRef<Set<string>>(new Set());
  const seenSharedObjectRef = useRef<Set<string>>(new Set());

  // Team PLI
  const { teammates, broadcast: broadcastTeamPosition, connected: teamConnected, messages: teamMessages, sendMessage: sendTeamMessage } = useTeamPresence(callsign, teamEnabled);
  const { currentDistance, elapsedSeconds, routePoints, startTime, status, rejectedPointCount, lastRejectedReason } = trackingState;
  const isTracking = status === 'tracking';
  const isStarting = status === 'starting';
  const allRuckTemplates = useMemo(() => [...ruckTemplates, ...customTemplates], [customTemplates]);
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
  const altitudeFt = currentAltitude != null ? Math.round(currentAltitude * 3.28084) : null;
  const atakPanelHeight = atakTab === 'ops' ? 286 : 168;
  const atakBottomHeight = 46 + (atakTab ? atakPanelHeight : 0); // unified bottom bar + panel

  // Imported GPX route as SVG-ready point string
  const importedRouteLinePoints = useMemo(() => {
    if (!importedRoute.length || !effectiveMapCenter || renderViewport.width <= 0) return null;
    const pts = getMercatorRoutePoints(
      importedRoute.map((p) => ({ latitude: p.lat, longitude: p.lon, altitude: null, accuracy: null, timestamp: 0 })),
      effectiveMapCenter,
      renderViewport,
      mapZoom,
    );
    return pts.map((p) => `${p.x},${p.y}`).join(' ');
  }, [importedRoute, effectiveMapCenter, renderViewport, mapZoom]);
  const speedKmh = useMemo(() => (
    currentDistance > 0.02 && elapsedSeconds > 0
      ? (currentDistance / (elapsedSeconds / 3600)).toFixed(1)
      : '0.0'
  ), [currentDistance, elapsedSeconds]);
  const scaleBar = useMemo(() => {
    if (!effectiveMapCenter || mapViewport.width <= 0) return null;
    const tileZoom = Math.round(mapZoom);
    const metersPerPixel = (156543.03392 * Math.cos(effectiveMapCenter.latitude * Math.PI / 180)) / Math.pow(2, tileZoom);
    const targetPixels = 80;
    const targetMeters = targetPixels * metersPerPixel;
    const niceValues = [1, 2, 5, 10, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    const niceMeters = niceValues.find((n) => n >= targetMeters) ?? 10000;
    const barWidth = Math.round(niceMeters / metersPerPixel);
    return {
      label: niceMeters >= 1000 ? `${(niceMeters / 1000).toFixed(niceMeters >= 10000 ? 0 : 1)} km` : `${niceMeters} m`,
      width: barWidth,
    };
  }, [effectiveMapCenter, mapZoom, mapViewport.width]);
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
  const navTeammateTarget = navTarget?.type === 'teammate'
    ? teammates.find((teammate) => teammate.callsign === navTarget.id) ?? null
    : null;
  const emergencyTeammates = useMemo(() => (
    teammates.filter((teammate) => teammate.emergency?.active)
  ), [teammates]);
  const priorityEmergency = emergencyTeammates[0] ?? null;
  const navMarkTarget = navTarget?.type === 'mark'
    ? plannedCheckpoints.find((checkpoint) => checkpoint.id === navTarget.id) ?? selectedCheckpoint
    : selectedCheckpoint;
  const navTargetPoint: TrackPoint | null = navTeammateTarget
    ? {
        latitude: navTeammateTarget.lat,
        longitude: navTeammateTarget.lon,
        altitude: null,
        accuracy: navTeammateTarget.accuracy ?? null,
        timestamp: navTeammateTarget.updatedAt,
      }
    : navMarkTarget && navMarkTarget.latitude != null && navMarkTarget.longitude != null
      ? navMarkTarget as RuckCheckpoint & TrackPoint
      : null;
  const navTargetLabel = navTeammateTarget?.callsign ?? (navMarkTarget ? formatFieldMarkLabel(navMarkTarget) : 'No target');
  const navTargetKind = navTeammateTarget ? 'TEAM' : getFieldMarkType(navMarkTarget?.markType).shortLabel;
  const navTargetTone = navTeammateTarget?.color ?? getFieldMarkType(navMarkTarget?.markType).tone;
  const navTargetDistanceKm = currentPoint && navTargetPoint ? distanceBetween(currentPoint, navTargetPoint) : null;
  const navTargetBearing = currentPoint && navTargetPoint ? Math.round(bearingBetween(currentPoint, navTargetPoint)) : null;
  const navTargetEtaMinutes = navTargetDistanceKm == null
    ? null
    : navTargetDistanceKm * (currentDistance > 0.02 && elapsedSeconds > 0 ? elapsedSeconds / 60 / currentDistance : targetPace);
  const activeNavLinePoints = useMemo(() => {
    if (!currentPoint || !navTargetPoint) return null;
    const points = getMercatorRoutePoints([currentPoint, navTargetPoint], effectiveMapCenter, renderViewport, mapZoom);
    return points.length === 2 ? points.map((point) => `${point.x},${point.y}`).join(' ') : null;
  }, [currentPoint, navTargetPoint, effectiveMapCenter, renderViewport, mapZoom]);
  const visibleMapOverlays = useMemo(() => mapOverlays.filter((overlay) => overlay.visible), [mapOverlays]);
  const renderedOverlayFeatures = useMemo(() => {
    if (!effectiveMapCenter || renderViewport.width <= 0) return [];

    return visibleMapOverlays.map((overlay) => {
      const pointFeatures = getMercatorRoutePoints(
        overlay.points.map((point) => ({
          ...point,
          altitude: null,
          accuracy: null,
          timestamp: 0,
        })),
        effectiveMapCenter,
        renderViewport,
        mapZoom
      );
      const lineFeatures = overlay.lines.map((line) => {
        const points = getMercatorRoutePoints(
          line.points.map((point) => ({
            latitude: point.lat,
            longitude: point.lon,
            altitude: null,
            accuracy: null,
            timestamp: 0,
          })),
          effectiveMapCenter,
          renderViewport,
          mapZoom
        );
        return { ...line, svgPoints: points.map((point) => `${point.x},${point.y}`).join(' ') };
      });
      const polygonFeatures = overlay.polygons.flatMap((polygon) => polygon.rings.map((ring, ringIndex) => {
        const points = getMercatorRoutePoints(
          ring.map((point) => ({
            latitude: point.lat,
            longitude: point.lon,
            altitude: null,
            accuracy: null,
            timestamp: 0,
          })),
          effectiveMapCenter,
          renderViewport,
          mapZoom
        );
        return { id: `${polygon.id}-r${ringIndex}`, label: polygon.label, svgPoints: points.map((point) => `${point.x},${point.y}`).join(' ') };
      }));

      return { overlay, pointFeatures, lineFeatures, polygonFeatures };
    });
  }, [effectiveMapCenter, renderViewport, visibleMapOverlays, mapZoom]);
  const measurementMapPoints = useMemo(() => getMercatorRoutePoints(
    measurementPoints.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: null,
      accuracy: null,
      timestamp: 0,
    })),
    effectiveMapCenter,
    renderViewport,
    mapZoom
  ), [measurementPoints, effectiveMapCenter, renderViewport, mapZoom]);
  const measurementLinePoints = useMemo(() => {
    if (measurementMapPoints.length < 2) return null;
    const points = measurementMode === 'area' && measurementMapPoints.length >= 3
      ? [...measurementMapPoints, measurementMapPoints[0]]
      : measurementMapPoints;
    return points.map((point) => `${point.x},${point.y}`).join(' ');
  }, [measurementMapPoints, measurementMode]);
  const measurementDistanceKm = useMemo(
    () => calculateMeasurementDistance(measurementPoints, measurementMode === 'area'),
    [measurementPoints, measurementMode]
  );
  const measurementAreaMeters = useMemo(
    () => measurementMode === 'area' ? calculateMeasurementArea(measurementPoints) : 0,
    [measurementPoints, measurementMode]
  );
  const measurementBearing = useMemo(() => {
    if (measurementPoints.length < 2) return null;
    return Math.round(bearingBetween(
      measurementPointToTrackPoint(measurementPoints[0]),
      measurementPointToTrackPoint(measurementPoints[measurementPoints.length - 1])
    ));
  }, [measurementPoints]);
  const bearingGuidance = useMemo(() => {
    if (!navTargetPoint || navTargetBearing == null) {
      return { label: 'NO TARGET', detail: 'select mark or teammate', tone: colours.muted };
    }
    if (navTargetDistanceKm != null && navTargetDistanceKm * 1000 <= CHECKPOINT_ARRIVAL_RADIUS_METERS) {
      return { label: navTeammateTarget ? 'CLOSED' : 'ARRIVED', detail: navTargetLabel, tone: colours.green };
    }
    if (activeHeading == null) {
      return { label: 'NO HDG', detail: 'compass standby', tone: colours.muted };
    }

    const delta = headingDifferenceDegrees(activeHeading, navTargetBearing);
    const absoluteDelta = Math.abs(delta);
    if (absoluteDelta <= BEARING_CAUTION_DEGREES) {
      return { label: 'ON BEARING', detail: `${formatHeading(navTargetBearing)} to ${navTargetLabel}`, tone: colours.green };
    }
    if (absoluteDelta <= BEARING_OFF_DEGREES) {
      return {
        label: delta > 0 ? 'CHECK RIGHT' : 'CHECK LEFT',
        detail: `${Math.round(absoluteDelta)}deg off ${formatHeading(navTargetBearing)}`,
        tone: colours.amber,
      };
    }
    return {
      label: 'OFF BEARING',
      detail: `${Math.round(absoluteDelta)}deg off ${formatHeading(navTargetBearing)}`,
      tone: colours.red,
    };
  }, [activeHeading, navTargetBearing, navTargetDistanceKm, navTargetLabel, navTargetPoint, navTeammateTarget]);
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
  const lastAlertedSplitKm = useRef(0);

  // Haptic pace alert on each completed km split
  useEffect(() => {
    if (!latestSplit || !isTracking) return;
    if (latestSplit.km <= lastAlertedSplitKm.current) return;
    lastAlertedSplitKm.current = latestSplit.km;

    if (Platform.OS === 'web') return;
    const actualPaceMinPerKm = latestSplit.splitSeconds / 60;
    const pace = targetMinutes / Math.max(0.1, targetDistanceKm);
    const diff = actualPaceMinPerKm - pace;
    if (diff > 1.5) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (diff < -1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [latestSplit, isTracking, targetDistanceKm, targetMinutes]);

  const recordLocation = useCallback((location: Location.LocationObject) => {
    const nextPoint = toTrackPoint(location);
    dispatchTracking({ type: 'point_recorded', point: nextPoint });
  }, []);

  // Broadcast position to teammates when GPS tracking is active
  useEffect(() => {
    if (!teamEnabled || !currentPoint) return;
    broadcastTeamPosition({
      lat: currentPoint.latitude,
      lon: currentPoint.longitude,
      heading: activeHeading ?? undefined,
      speed: currentDistance > 0.02 && elapsedSeconds > 0
        ? parseFloat((currentDistance / (elapsedSeconds / 3600)).toFixed(1))
        : undefined,
      accuracy: currentPoint.accuracy ?? undefined,
      emergency: emergencyBeacon ?? { active: false, since: Date.now() },
      sharedObjects,
    });
  }, [activeHeading, broadcastTeamPosition, currentDistance, currentPoint, elapsedSeconds, emergencyBeacon, sharedObjects, teamEnabled]);

  async function handleGpxImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
      const parsed = parseGpx(content);
      if (!parsed.trackPoints.length) {
        showAlert('No Track Found', 'The file contained no track points. Make sure it is a valid .gpx file.');
        return;
      }
      setImportedRoute(parsed.trackPoints.map((p) => ({ lat: p.lat, lon: p.lon })));
      setImportedRouteName(parsed.name ?? result.assets[0].name ?? 'Imported Route');
      if (parsed.trackPoints[0]) {
        setMapCenter({ latitude: parsed.trackPoints[0].lat, longitude: parsed.trackPoints[0].lon, altitude: null, accuracy: null, timestamp: Date.now() });
        setGpsFollowMode(false);
      }
    } catch {
      showAlert('Import Failed', 'Could not read the file. Please select a valid .gpx file.');
    }
  }

  async function handleGeoJsonImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
      const overlay = parseGeoJsonOverlay(content, asset.name ?? 'GeoJSON Overlay', nextOverlayColor());

      addImportedOverlay(overlay);
    } catch (error) {
      console.error('GeoJSON import failed', error);
      showAlert('Import Failed', 'Could not read GeoJSON features. Use a valid .geojson or .json file with Point, LineString, or Polygon geometry.');
    }
  }

  async function handleKmlImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'utf8' });
      const overlay = parseKmlOverlay(content, asset.name ?? 'KML Overlay', nextOverlayColor());

      addImportedOverlay(overlay);
    } catch (error) {
      console.error('KML import failed', error);
      showAlert('Import Failed', 'Could not read KML placemarks. Use a valid .kml file with Point, LineString, or Polygon geometry.');
    }
  }

  async function handleKmzImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const kml = extractKmlFromKmz(content);
      const overlay = parseKmlOverlay(kml, asset.name ?? 'KMZ Overlay', nextOverlayColor(), 'kmz');

      addImportedOverlay(overlay);
    } catch (error) {
      console.error('KMZ import failed', error);
      showAlert('Import Failed', 'Could not read KMZ overlay. Use a valid .kmz file containing a KML document.');
    }
  }

  function nextOverlayColor() {
    const colors = ['#facc15', '#60a5fa', '#34d399', '#f97316', '#a78bfa', colours.red];
    return colors[mapOverlays.length % colors.length];
  }

  function addImportedOverlay(overlay: MapOverlay) {
    setMapOverlays((current) => [...current, overlay]);
    const firstPoint = getOverlayCenterPoint(overlay);
    if (firstPoint) {
      setMapCenter({
        latitude: firstPoint.latitude,
        longitude: firstPoint.longitude,
        altitude: null,
        accuracy: null,
        timestamp: Date.now(),
      });
      setGpsFollowMode(false);
    }
  }

  function getOverlayCenterPoint(overlay: MapOverlay) {
    const point = overlay.points[0];
    if (point) return point;

    const linePoint = overlay.lines[0]?.points[0];
    if (linePoint) return { latitude: linePoint.lat, longitude: linePoint.lon };

    const polygonPoint = overlay.polygons[0]?.rings[0]?.[0];
    if (polygonPoint) return { latitude: polygonPoint.lat, longitude: polygonPoint.lon };

    return null;
  }

  function centerMapOnOverlay(overlay: MapOverlay) {
    const point = getOverlayCenterPoint(overlay);
    if (!point) return;
    setMapCenter({
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: null,
      accuracy: null,
      timestamp: Date.now(),
    });
    setGpsFollowMode(false);
    setMapExpanded(true);
  }

  function toggleOverlayVisibility(overlayId: string) {
    setMapOverlays((current) => current.map((overlay) => (
      overlay.id === overlayId ? { ...overlay, visible: !overlay.visible } : overlay
    )));
  }

  function removeOverlay(overlayId: string) {
    setMapOverlays((current) => current.filter((overlay) => overlay.id !== overlayId));
  }

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

  function mapEventToPoint(x: number, y: number) {
    const center = effectiveMapCenterRef.current;
    const viewport = mapViewportRef.current;
    if (!center || viewport.width <= 0 || viewport.height <= 0) return null;

    const zoom = mapZoomRef.current;
    const tileZoom = Math.round(zoom);
    const centerPixel = latLonToWorldPixel(center.latitude, center.longitude, tileZoom);
    let dx = x - viewport.width / 2;
    let dy = y - viewport.height / 2;

    if (!mapNorthUpRef.current && activeHeadingRef.current != null) {
      const rad = (activeHeadingRef.current * Math.PI) / 180;
      dx = (x - viewport.width / 2) * Math.cos(rad) - (y - viewport.height / 2) * Math.sin(rad);
      dy = (x - viewport.width / 2) * Math.sin(rad) + (y - viewport.height / 2) * Math.cos(rad);
    }

    const { latitude, longitude } = worldPixelToLatLon(centerPixel.x + dx, centerPixel.y + dy, tileZoom);
    return { latitude, longitude, altitude: null, accuracy: null };
  }

  function addCheckpointAtMapEvent(x: number, y: number) {
    const point = mapEventToPoint(x, y);
    if (!point) return;
    addCheckpoint(point, 'manual', activeMarkTypeRef.current);
  }

  function addMeasurementPointAtMapEvent(x: number, y: number) {
    const point = mapEventToPoint(x, y);
    const mode = measurementModeRef.current;
    if (!point || !mode) return;
    const nextPoint = { latitude: point.latitude, longitude: point.longitude };
    setMeasurementPoints((current) => (
      mode === 'range' && current.length >= 2 ? [current[1], nextPoint] : [...current, nextPoint]
    ));
  }

  function setActiveMeasurementMode(mode: MeasurementMode) {
    setTapMarkMode(false);
    setDrawMode(false);
    setMeasurementMode((current) => current === mode ? null : mode);
    setMeasurementPoints([]);
  }

  function focusNavMark(checkpointId: string) {
    setSelectedCheckpointId(checkpointId);
    setNavTarget({ type: 'mark', id: checkpointId });
  }

  function focusTeammate(teammate: Teammate) {
    setNavTarget({ type: 'teammate', id: teammate.callsign });
    setMapCenter({
      latitude: teammate.lat,
      longitude: teammate.lon,
      altitude: null,
      accuracy: teammate.accuracy ?? null,
      timestamp: teammate.updatedAt,
    });
    setGpsFollowMode(false);
  }

  function centerMapOnNavTarget() {
    if (!navTargetPoint) return;
    setMapCenter({
      latitude: navTargetPoint.latitude,
      longitude: navTargetPoint.longitude,
      altitude: navTargetPoint.altitude,
      accuracy: navTargetPoint.accuracy,
      timestamp: Date.now(),
    });
    setGpsFollowMode(false);
  }

  function addTeamEvent(title: string, detail: string, tone: string = colours.cyan) {
    setTeamEvents((current) => [
      { id: `event-${Date.now()}-${current.length}`, time: Date.now(), title, detail, tone },
      ...current,
    ].slice(0, 8));
  }

  function triggerEmergencyBeacon() {
    if (!currentPoint) {
      showAlert('No GPS fix', 'Start tracking or wait for a location fix before sending an emergency beacon.');
      return;
    }
    setTeamEnabled(true);
    const beacon = { active: true, since: Date.now(), message: 'Emergency assistance requested' };
    setEmergencyBeacon(beacon);
    addTeamEvent('Emergency beacon sent', `${callsign} at ${formatCoordinate(currentPoint.latitude, currentPoint.longitude, coordinateFormat)}`, colours.red);
  }

  function clearEmergencyBeacon() {
    setEmergencyBeacon(null);
    addTeamEvent('Emergency beacon cleared', callsign, colours.green);
  }

  function shareSelectedMark() {
    if (!selectedCheckpointPoint || !selectedCheckpoint) {
      showAlert('No mark selected', 'Select a mapped FORGE mark before sharing.');
      return;
    }
    setTeamEnabled(true);
    const shared: SharedFieldObject = {
      id: `shared-mark-${selectedCheckpoint.id}-${Date.now()}`,
      sender: callsign,
      type: 'mark',
      label: formatFieldMarkLabel(selectedCheckpoint),
      sentAt: Date.now(),
      geometry: {
        kind: 'point',
        points: [{ lat: selectedCheckpointPoint.latitude, lon: selectedCheckpointPoint.longitude }],
      },
      meta: { markType: selectedCheckpoint.markType },
    };
    setSharedObjects((current) => [shared, ...current].slice(0, 12));
    addTeamEvent('Mark shared', shared.label, colours.cyan);
  }

  function shareMeasurement() {
    if (!measurementMode || measurementPoints.length < (measurementMode === 'area' ? 3 : 2)) {
      showAlert('No measurement ready', 'Create a range, route, or area measurement before sharing.');
      return;
    }
    setTeamEnabled(true);
    const label = measurementMode === 'area'
      ? `Area ${formatMeasureArea(measurementAreaMeters)}`
      : `${measurementMode === 'range' ? 'Range' : 'Route'} ${formatMeasureDistance(measurementDistanceKm)}`;
    const shared: SharedFieldObject = {
      id: `shared-measure-${Date.now()}`,
      sender: callsign,
      type: 'measurement',
      label,
      sentAt: Date.now(),
      geometry: {
        kind: measurementMode === 'area' ? 'polygon' : 'line',
        points: measurementPoints.map((point) => ({ lat: point.latitude, lon: point.longitude })),
      },
      meta: { measurementMode, distanceKm: measurementDistanceKm, areaSquareMeters: measurementAreaMeters },
    };
    setSharedObjects((current) => [shared, ...current].slice(0, 12));
    addTeamEvent('Measurement shared', label, '#facc15');
  }

  function centerMapOnSharedObject(object: SharedFieldObject) {
    const point = object.geometry.points[0];
    if (!point) return;
    setMapCenter({
      latitude: point.lat,
      longitude: point.lon,
      altitude: null,
      accuracy: null,
      timestamp: Date.now(),
    });
    setGpsFollowMode(false);
  }

  const mapNormalGestures = useMemo(() => {
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
      .onUpdate((event: { translationX: number; translationY: number }) => {
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
      .onUpdate((event: { scale: number }) => {
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

    const markTapGesture = Gesture.Tap()
      .numberOfTaps(1)
      .enabled(Boolean(effectiveMapCenterRef.current))
      .onEnd((event: { x: number; y: number }, success: boolean) => {
        if (!success) return;
        if (measurementModeRef.current) {
          addMeasurementPointAtMapEvent(event.x, event.y);
          return;
        }
        if (!tapMarkModeRef.current) return;
        addCheckpointAtMapEvent(event.x, event.y);
      })
      .runOnJS(true);

    return Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture, markTapGesture);
  }, [!!effectiveMapCenter]);

  const mapDrawGesture = useMemo(() => Gesture.Pan()
    .onStart(() => {
      setCurrentDrawLine([]);
    })
    .onUpdate((event: { x: number; y: number }) => {
      const center = effectiveMapCenterRef.current;
      const viewport = mapViewportRef.current;
      const zoom = mapZoomRef.current;
      if (!center) return;
      const tileZoom = Math.round(zoom);
      const centerPixel = latLonToWorldPixel(center.latitude, center.longitude, tileZoom);
      const worldX = event.x - viewport.width / 2 + centerPixel.x;
      const worldY = event.y - viewport.height / 2 + centerPixel.y;
      const { latitude, longitude } = worldPixelToLatLon(worldX, worldY, tileZoom);
      setCurrentDrawLine((prev) => [...(prev ?? []), { lat: latitude, lon: longitude }]);
    })
    .onEnd(() => {
      setCurrentDrawLine((prev) => {
        if (prev && prev.length > 1) {
          setDrawLines((lines) => [...lines, { color: drawColorRef.current, points: prev }]);
        }
        return null;
      });
    })
    .runOnJS(true),
  []);

  const mapGestures = drawMode ? mapDrawGesture : mapNormalGestures;

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
        const savedCallsign = await secureGetItem('forge:callsign');
        if (savedCallsign) setCallsign(savedCallsign);
        const storedFieldState = await secureGetItem(RUCK_FIELD_STATE_KEY);
        if (storedFieldState) {
          try {
            const parsed = JSON.parse(storedFieldState) as PersistedFieldState;
            setPlannedCheckpoints(parsed.checkpoints ?? []);
            setDrawLines(parsed.drawLines ?? []);
            setMeasurementMode(parsed.measurementMode ?? null);
            setMeasurementPoints(parsed.measurementPoints ?? []);
            setMapOverlays(parsed.mapOverlays ?? []);
            setTeamEvents(parsed.teamEvents ?? []);
            setSelectedCheckpointId(parsed.checkpoints?.[0]?.id ?? null);
          } catch {
            console.error('Failed to parse saved ruck field state');
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
    if (!planRestored) return;
    const state: PersistedFieldState = {
      checkpoints: plannedCheckpoints,
      drawLines,
      measurementMode,
      measurementPoints,
      mapOverlays,
      teamEvents: teamEvents.slice(0, 8),
    };
    secureSetItem(RUCK_FIELD_STATE_KEY, JSON.stringify(state)).catch((error) => {
      console.error('Failed to persist ruck field state', error);
    });
  }, [drawLines, mapOverlays, measurementMode, measurementPoints, plannedCheckpoints, planRestored, teamEvents]);

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

  const prevIsTrackingRef = useRef(isTracking);
  useEffect(() => {
    const wasTracking = prevIsTrackingRef.current;
    prevIsTrackingRef.current = isTracking;
    if (wasTracking === isTracking) return;
    if (isTracking) {
      if (missionMode !== 'simple') setActiveSection('field');
      else setActiveSection((s) => s === 'setup' ? 'mission' : s);
    } else if (startTime) {
      setActiveSection((s) => s === 'field' ? 'mission' : s);
    }
  }, [isTracking, missionMode, startTime]);

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
      setActiveSection('field');
    }
  }, [currentPoint, placedCheckpoints]);

  useEffect(() => {
    if (navTarget?.type === 'teammate' && !teammates.some((teammate) => teammate.callsign === navTarget.id)) {
      setNavTarget(null);
    }
  }, [navTarget, teammates]);

  useEffect(() => {
    emergencyTeammates.forEach((teammate) => {
      if (seenEmergencyRef.current.has(teammate.callsign)) return;
      seenEmergencyRef.current.add(teammate.callsign);
      addTeamEvent('Emergency beacon received', `${teammate.callsign} requested assistance`, colours.red);
      setNavTarget({ type: 'teammate', id: teammate.callsign });
      setMapCenter({
        latitude: teammate.lat,
        longitude: teammate.lon,
        altitude: null,
        accuracy: teammate.accuracy ?? null,
        timestamp: teammate.updatedAt,
      });
      setGpsFollowMode(false);
    });

    const activeCallsigns = new Set(emergencyTeammates.map((teammate) => teammate.callsign));
    seenEmergencyRef.current.forEach((callsignValue) => {
      if (!activeCallsigns.has(callsignValue)) {
        seenEmergencyRef.current.delete(callsignValue);
        addTeamEvent('Emergency beacon cleared', callsignValue, colours.green);
      }
    });
  }, [emergencyTeammates]);

  useEffect(() => {
    const incoming = teammates.flatMap((teammate) => (
      (teammate.sharedObjects ?? []).filter((object) => object.sender !== callsign)
    ));
    setReceivedSharedObjects(incoming.slice(0, 24));
    incoming.forEach((object) => {
      if (seenSharedObjectRef.current.has(object.id)) return;
      seenSharedObjectRef.current.add(object.id);
      addTeamEvent(
        object.type === 'mark' ? 'Mark received' : 'Measurement received',
        `${object.sender}: ${object.label}`,
        object.type === 'mark' ? colours.cyan : '#facc15'
      );
    });
  }, [callsign, teammates]);

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
      score: activeRuckScore.score,
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
    dispatchTracking({ type: 'reset' });
    setCheckpointIndex(0);
    setPlannedCheckpoints([]);
    setSelectedCheckpointId(null);
    setMapFullscreen(false);
    setReviewOpen(false);
    setRuckReviewNote('');
    clearActiveRoute();
    clearActiveRuckPlan();
    onSessionSaved?.();
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
    () => calculateRuckScore({
      distanceKm: distance,
      loadKg: weight,
      bodyMassKg,
      paceMinPerKm: Number(pace),
      ascentM: plannedAscentM,
      terrainFactor,
    }).score,
    [bodyMassKg, distance, pace, plannedAscentM, terrainFactor, weight]
  );
  const activePace = currentDistance > 0.02 ? (elapsedSeconds / 60 / currentDistance).toFixed(1) : '--';
  const projectedRuckScore = useMemo(
    () => calculateRuckScore({
      distanceKm: distance,
      loadKg: weight,
      bodyMassKg,
      paceMinPerKm: Number(pace),
      ascentM: plannedAscentM,
      terrainFactor,
    }),
    [bodyMassKg, distance, pace, plannedAscentM, terrainFactor, weight]
  );
  const activeRuckScore = useMemo(
    () => calculateRuckScore({
      distanceKm: currentDistance > 0.02 ? currentDistance : distance,
      loadKg: weight,
      bodyMassKg,
      paceMinPerKm: activePace === '--' ? Number(pace) : Number(activePace),
      ascentM: currentDistance > 0.02 ? Math.round((plannedAscentM / Math.max(distance, 0.1)) * currentDistance) : plannedAscentM,
      terrainFactor,
      splitCount: splits.length,
      reachedCheckpoints: plannedCheckpoints.filter((checkpoint) => checkpoint.status === 'reached').length,
      totalCheckpoints: plannedCheckpoints.length,
    }),
    [activePace, bodyMassKg, currentDistance, distance, pace, plannedAscentM, plannedCheckpoints, splits.length, terrainFactor, weight]
  );
  const newPRs = useMemo<PRType[]>(() => {
    if (!reviewOpen) return [];
    const duration = Math.max(1, elapsedSeconds / 60);
    const draftSession: TrainingSession = {
      id: '__draft__',
      type: 'Ruck',
      title: `${currentDistance.toFixed(1)}km GPS Ruck`,
      score: activeRuckScore.score,
      durationMinutes: Math.round(duration),
      rpe: weight > 22 ? 8 : 6,
      loadKg: weight,
      ruckMission: {
        targetDistanceKm,
        targetMinutes,
        checkpointIntervalKm,
        checkpointIndex,
        finishMode,
        plannedCheckpoints,
        selectedCheckpointId,
        splits,
      },
      completedAt: new Date().toISOString(),
    };
    return getSessionPRTypes(draftSession, sessions);
  }, [reviewOpen, elapsedSeconds, currentDistance, activeRuckScore.score, weight, targetDistanceKm, targetMinutes, checkpointIntervalKm, checkpointIndex, finishMode, plannedCheckpoints, selectedCheckpointId, splits, sessions]);

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

  function addCheckpoint(
    point: Pick<TrackPoint, 'latitude' | 'longitude' | 'altitude' | 'accuracy'>,
    source: RuckCheckpoint['source'],
    markType: FieldMarkType = activeMarkType
  ) {
    const createdAt = Date.now();
    const meta = getFieldMarkType(markType);
    const id = `cp-${createdAt}-${Math.round(point.latitude * 100000)}-${Math.round(point.longitude * 100000)}`;
    setPlannedCheckpoints((current) => {
      const checkpoint: RuckCheckpoint = {
        id,
        label: `${meta.shortLabel} ${current.length + 1}`,
        markType,
        source,
        status: 'planned',
        latitude: point.latitude,
        longitude: point.longitude,
        altitude: point.altitude ?? null,
        accuracy: point.accuracy ?? null,
        timestamp: createdAt,
      };
      return [...current, checkpoint];
    });
    setSelectedCheckpointId(id);
    setNavTarget({ type: 'mark', id });
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

  async function downloadOfflineMap() {
    if (!effectiveMapCenter) {
      showAlert('No Position', 'Start GPS or pan to a location first.');
      return;
    }

    setIsDownloadingMap(true);
    setDownloadProgress(0);

    try {
      const tilesToDownload: MapTile[] = [];

      // Calculate tiles needed for the current geographical area
      // across zoom levels 13 to 16
      for (let z = 13; z <= 16; z++) {
        const zoomOffset = z - mapZoom;
        const scale = Math.pow(2, zoomOffset);
        const targetViewport = {
          width: renderViewport.width * scale,
          height: renderViewport.height * scale,
        };

        const tiles = buildVisibleTiles(effectiveMapCenter, targetViewport, mapLayer, z);
        tilesToDownload.push(...tiles);
      }

      // Deduplicate tiles by URL
      const uniqueUrls = Array.from(new Set(tilesToDownload.map(t => t.url)));

      const executeDownload = async () => {
        try {
          let downloaded = 0;

          if (Platform.OS === 'web') {
            if ('caches' in window) {
              const cache = await caches.open('forge-map-tiles-v1');
              const batchSize = 10;

              for (let i = 0; i < uniqueUrls.length; i += batchSize) {
                const batch = uniqueUrls.slice(i, i + batchSize);
                await Promise.all(
                  batch.map(async (url) => {
                    try {
                      const match = await cache.match(url);
                      if (!match) await cache.add(url);
                    } catch (err) {
                      console.warn('Failed to cache tile', url, err);
                    }
                  })
                );
                downloaded += batch.length;
                setDownloadProgress(Math.round((downloaded / uniqueUrls.length) * 100));
              }
            }
          } else {
            const batchSize = 10;
            for (let i = 0; i < uniqueUrls.length; i += batchSize) {
              const batch = uniqueUrls.slice(i, i + batchSize);
              try {
                await ExpoImage.prefetch(batch, 'disk');
              } catch (err) {
                console.warn('Failed to prefetch some native tiles', err);
              }
              downloaded += batch.length;
              setDownloadProgress(Math.round((downloaded / uniqueUrls.length) * 100));
            }
          }

          showAlert('Download Complete', `Successfully cached ${uniqueUrls.length.toLocaleString()} map tiles for offline use.`);
        } catch (err) {
          console.error('Offline map download failed', err);
          showAlert('Download Failed', 'There was an error downloading the offline map.');
        } finally {
          setIsDownloadingMap(false);
          setDownloadProgress(0);
        }
      };

      if (uniqueUrls.length > 5000) {
        setIsDownloadingMap(false);
        setDownloadProgress(0);
        showConfirm(
          'Large Download Warning',
          `You are about to download ${uniqueUrls.length.toLocaleString()} tiles. This may consume significant storage space and take a while.\n\nDo you want to proceed?`,
          () => {
            setIsDownloadingMap(true);
            setDownloadProgress(0);
            void executeDownload();
          },
          'Download'
        );
      } else {
        await executeDownload();
      }
    } catch (err) {
      console.error('Offline map preparation failed', err);
      showAlert('Error', 'There was an error calculating map tiles.');
      setIsDownloadingMap(false);
      setDownloadProgress(0);
    }
  }

  function confirmClearOfflineMap() {
    showConfirm(
      'Clear Map Cache',
      'This will delete all downloaded offline map tiles and free up storage space. Proceed?',
      async () => {
        try {
          if (Platform.OS === 'web') {
            if ('caches' in window) {
              await caches.delete('forge-map-tiles-v1');
            }
          } else {
            await ExpoImage.clearDiskCache();
          }
          showAlert('Cache Cleared', 'Offline map tiles have been removed from storage.');
        } catch (err) {
          console.error('Failed to clear map cache', err);
          showAlert('Error', 'Failed to clear map cache.');
        }
      },
      'Clear'
    );
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
    return getFieldMarkType(checkpoint.markType).tone;
  }

  function renderMapStage(fullscreen: boolean) {
    const showOverlays = showExpandedMap || fullscreen || missionMode !== 'simple';
    return (
      <GestureDetector gesture={mapGestures}>
        <View
          style={fullscreen ? styles.fullscreenMapStage : styles.mapStage}
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
                <ExpoImage
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
                  <G transform={`translate(${lastMapPoint.x}, ${lastMapPoint.y}) rotate(${mapNorthUp ? (activeHeading ?? 0) : 0})`}>
                    <Polygon
                      points="0,-15 11,10 0,5 -11,10"
                      fill={colours.cyan}
                      stroke="rgba(255,255,255,0.9)"
                      strokeWidth={2}
                      strokeLinejoin="round"
                    />
                  </G>
                )}
                {/* Imported GPX route — yellow dashed underlay */}
                {importedRouteLinePoints && (
                  <Polyline
                    points={importedRouteLinePoints}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="8,6"
                    opacity={0.8}
                  />
                )}
                {receivedSharedObjects.map((object) => {
                  if (!effectiveMapCenter) return null;
                  const points = getMercatorRoutePoints(
                    object.geometry.points.map((point) => ({
                      latitude: point.lat,
                      longitude: point.lon,
                      altitude: null,
                      accuracy: null,
                      timestamp: 0,
                    })),
                    effectiveMapCenter,
                    renderViewport,
                    mapZoom
                  );
                  const svgPoints = points.map((point) => `${point.x},${point.y}`).join(' ');
                  if (object.geometry.kind === 'point' && points[0]) {
                    return (
                      <G key={object.id} transform={`translate(${points[0].x}, ${points[0].y})`}>
                        <Circle r={9} fill="#facc15" stroke="rgba(7,17,30,0.9)" strokeWidth={2} />
                        <SvgText x={0} y={23} textAnchor="middle" fontSize="8" fontWeight="900" fill="#facc15">{object.sender}</SvgText>
                      </G>
                    );
                  }
                  if (object.geometry.kind === 'polygon' && points.length >= 3) {
                    return <Polygon key={object.id} points={`${svgPoints} ${points[0].x},${points[0].y}`} fill="rgba(250,204,21,0.13)" stroke="#facc15" strokeWidth={2.5} />;
                  }
                  return svgPoints ? <Polyline key={object.id} points={svgPoints} fill="none" stroke="#facc15" strokeWidth={3} strokeDasharray="8,5" /> : null;
                })}
                {renderedOverlayFeatures.map(({ overlay, pointFeatures, lineFeatures, polygonFeatures }) => (
                  <React.Fragment key={overlay.id}>
                    {polygonFeatures.map((polygon) => (
                      <Polygon
                        key={polygon.id}
                        points={polygon.svgPoints}
                        fill={`${overlay.color}22`}
                        stroke={overlay.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        opacity={0.84}
                      />
                    ))}
                    {lineFeatures.map((line) => (
                      <Polyline
                        key={line.id}
                        points={line.svgPoints}
                        fill="none"
                        stroke={overlay.color}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.86}
                      />
                    ))}
                    {pointFeatures.map((point) => (
                      <G key={point.id} transform={`translate(${point.x}, ${point.y})`}>
                        <Circle r={7} fill={overlay.color} stroke="rgba(7,17,30,0.86)" strokeWidth={2} />
                        <SvgText x={0} y={21} textAnchor="middle" fontSize="8" fontWeight="900" fill={overlay.color}>
                          {point.label.slice(0, 10)}
                        </SvgText>
                      </G>
                    ))}
                  </React.Fragment>
                ))}
                {activeNavLinePoints && (
                  <Polyline
                    points={activeNavLinePoints}
                    fill="none"
                    stroke={navTargetTone}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="4,5"
                    opacity={0.86}
                  />
                )}
                {measurementMode === 'area' && measurementLinePoints && measurementMapPoints.length >= 3 && (
                  <Polygon
                    points={measurementLinePoints}
                    fill="rgba(250,204,21,0.16)"
                    stroke="#facc15"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    opacity={0.9}
                  />
                )}
                {measurementMode !== 'area' && measurementLinePoints && (
                  <Polyline
                    points={measurementLinePoints}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={measurementMode === 'range' ? '6,5' : undefined}
                    opacity={0.92}
                  />
                )}
                {measurementMapPoints.map((point, index) => (
                  <G key={`measure-${index}`} transform={`translate(${point.x}, ${point.y})`}>
                    <Circle r={7} fill="#facc15" stroke="rgba(7,17,30,0.92)" strokeWidth={2} />
                    <SvgText x={0} y={4} textAnchor="middle" fontSize="8" fontWeight="900" fill={colours.background}>
                      {index + 1}
                    </SvgText>
                  </G>
                ))}
                {checkpointMapPoints.map((checkpoint) => (
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
                      {getFieldMarkType(checkpoint.markType).shortLabel.slice(0, 3)}
                    </SvgText>
                  </React.Fragment>
                ))}
                {/* Draw annotations */}
                {(() => {
                  if (!effectiveMapCenter) return null;
                  const tileZoom = Math.round(mapZoom);
                  const cp = latLonToWorldPixel(effectiveMapCenter.latitude, effectiveMapCenter.longitude, tileZoom);
                  const toSvg = (p: { lat: number; lon: number }) => {
                    const wp = latLonToWorldPixel(p.lat, p.lon, tileZoom);
                    return { x: wp.x - cp.x + renderViewport.width / 2, y: wp.y - cp.y + renderViewport.height / 2 };
                  };
                  return (
                    <>
                      {drawLines.map((line, i) => {
                        const pts = line.points.map(toSvg).map((p) => `${p.x},${p.y}`).join(' ');
                        return pts ? <Polyline key={i} points={pts} fill="none" stroke={line.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} /> : null;
                      })}
                      {currentDrawLine && currentDrawLine.length > 1 && (
                        <Polyline
                          points={currentDrawLine.map(toSvg).map((p) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke={drawColor}
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity={0.8}
                        />
                      )}
                    </>
                  );
                })()}
                {/* Teammate PLI markers */}
                {teammates.length > 0 && effectiveMapCenter && (() => {
                  const tileZoom = Math.round(mapZoom);
                  const cp = latLonToWorldPixel(effectiveMapCenter.latitude, effectiveMapCenter.longitude, tileZoom);
                  return teammates.map((tm) => {
                    const wp = latLonToWorldPixel(tm.lat, tm.lon, tileZoom);
                    const sx = wp.x - cp.x + renderViewport.width / 2;
                    const sy = wp.y - cp.y + renderViewport.height / 2;
                    const rot = mapNorthUp ? (tm.heading ?? 0) : 0;
                    const emergency = tm.emergency?.active;
                    return (
                      <G key={tm.callsign} transform={`translate(${sx}, ${sy}) rotate(${rot})`}>
                        {emergency && <Circle r={18} fill="none" stroke={colours.red} strokeWidth={3} opacity={0.9} />}
                        <Polygon points="0,-12 9,8 0,4 -9,8" fill={emergency ? colours.red : tm.color} stroke="rgba(7,17,30,0.85)" strokeWidth={1.5} strokeLinejoin="round" />
                        <SvgText x={0} y={22} textAnchor="middle" fontSize="8" fontWeight="900" fill={emergency ? colours.red : tm.color}>{emergency ? `SOS ${tm.callsign}` : tm.callsign}</SvgText>
                      </G>
                    );
                  });
                })()}
              </Svg>
            </Animated.View>
          )}

        <View style={styles.crosshair} pointerEvents="none">
          <View style={styles.crosshairHorizontal} />
          <View style={styles.crosshairVertical} />
        </View>

        {showOverlays && !fullscreen && (
          <>
            {missionMode === 'tactical' || fullscreen ? (
            <View style={[styles.mapGridOverlay, shadow.subtle]} pointerEvents="none">
              <Text style={styles.mapOverlayLabel}>{gpsFollowMode ? 'GPS GRID' : 'MAP CENTER'}</Text>
              <Text style={styles.mapOverlayValue}>{gpsFollowMode ? currentCoordinate ?? 'Awaiting fix' : mapCenterCoordinate ?? 'Awaiting fix'}</Text>
            </View>
            ) : null}
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
            {fullscreen ? (
            <View style={[styles.mapTelemetry, shadow.subtle]} pointerEvents="none">
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
            ) : null}
            {missionMode === 'navigation' || fullscreen ? (
            <View style={[styles.mapMissionStrip, shadow.subtle]} pointerEvents="none">
              <Text style={styles.mapMissionText}>{arrivalCheckpoint ? 'ARRIVED' : formatSignedMinutes(targetDeltaMinutes)}</Text>
              <Text style={styles.mapMissionText}>{selectedCheckpoint?.label ?? checkpointStatus}</Text>
              <Text style={styles.mapMissionText}>
                {selectedCheckpointDistanceKm == null ? `${checkpointRemainingKm.toFixed(1)}km to CP` : `${selectedCheckpointDistanceKm.toFixed(1)}km to CP`}
              </Text>
            </View>
            ) : null}
            {missionMode === 'navigation' || fullscreen ? (
            <View style={[styles.finishStrip, shadow.subtle]} pointerEvents="none">
              <Text style={styles.finishStripText}>FINISH {finishDistanceRemainingKm.toFixed(1)}km</Text>
              <Text style={styles.finishStripText}>REQ {finishRequiredPace > 0 ? `${finishRequiredPace.toFixed(1)}/km` : '--'}</Text>
              <Text style={[styles.finishStripText, { color: finishOnTarget ? colours.green : colours.amber }]}>
                {finishOnTarget ? 'ON TARGET' : 'AT RISK'}
              </Text>
            </View>
            ) : null}
          </>
        )}
        {(missionMode === 'navigation' || fullscreen) && !fullscreen && (
          <View style={[styles.bearingGuidanceStrip, { borderColor: statusColors(bearingGuidance.tone).borderMed, backgroundColor: statusColors(bearingGuidance.tone).bgMed }, shadow.subtle]} pointerEvents="none">
            <Text style={[styles.bearingGuidanceLabel, { color: bearingGuidance.tone }]}>{bearingGuidance.label}</Text>
            <Text style={styles.bearingGuidanceDetail}>{bearingGuidance.detail}</Text>
          </View>
        )}
        {mapTiles.length > 0 && (
          <Text style={styles.mapAttribution}>{activeMapLayer.attribution}</Text>
        )}
        {!fullscreen && (
          <View style={styles.mapSelectControls}>
            <Pressable
              style={[styles.mapIconButton, !mapNorthUp && styles.mapIconButtonActive, shadow.subtle]}
              onPress={() => setMapNorthUp(v => !v)}
            >
              <Ionicons name="compass" size={20} color={!mapNorthUp ? colours.background : colours.cyan} />
            </Pressable>
            <Pressable style={[styles.mapIconButton, shadow.subtle]} onPress={addCheckpointHere}>
              <Ionicons name={getFieldMarkType(activeMarkType).icon} size={20} color={colours.cyan} />
            </Pressable>
            <Pressable
              style={[styles.mapIconButton, !gpsFollowMode && styles.mapIconButtonActive, shadow.subtle]}
              onPress={() => {
                if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current);
                if (gpsFollowMode) {
                  setGpsFollowMode(false);
                  setMapCenter(effectiveMapCenter);
                } else {
                  recenterMapOnGps();
                }
              }}
            >
              <Ionicons name={gpsFollowMode ? 'locate' : 'locate-outline'} size={20} color={!gpsFollowMode ? colours.background : colours.cyan} />
            </Pressable>
          </View>
        )}
      </View>
      </GestureDetector>
    );
  }

  if (mapFullscreen) {
    return (
      <SafeAreaView style={styles.atakContainer}>
        {/* Full-screen map */}
        {renderMapStage(true)}

        {/* ── ATAK Top Toolbar ─────────────────────────────────────── */}
        <View style={styles.atakTopBar}>
          <Pressable style={styles.atakTopBtn} onPress={() => setMapFullscreen(false)}>
            <Ionicons name="menu-outline" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, paddingLeft: 6 }}>
            <Text style={[styles.atakStatusText, { color: trackingStatus.tone }]}>{trackingStatus.label}</Text>
            <Text style={styles.atakStatusDetail} numberOfLines={1}>{trackingStatus.detail}</Text>
          </View>
          <Pressable style={styles.atakTopBtn} onPress={() => {
            const idx = mapLayerOptions.findIndex((o) => o.key === mapLayer);
            setMapLayer(mapLayerOptions[(idx + 1) % mapLayerOptions.length].key);
          }}>
            <Ionicons name="layers-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.atakTopBtn} onPress={addCheckpointHere}>
            <Ionicons name={getFieldMarkType(activeMarkType).icon} size={22} color="#fff" />
          </Pressable>
          <Pressable style={styles.atakTopBtn} onPress={() => setMapNorthUp((v) => !v)}>
            <Ionicons name="compass-outline" size={22} color={mapNorthUp ? colours.cyan : '#fff'} />
          </Pressable>
          <Pressable style={styles.atakTopBtn} onPress={recenterMapOnGps}>
            <Ionicons name={gpsFollowMode ? 'locate' : 'locate-outline'} size={22} color={gpsFollowMode ? colours.cyan : '#fff'} />
          </Pressable>
          <Pressable style={styles.atakTopBtn} onPress={downloadOfflineMap}>
            <Ionicons name="cloud-download-outline" size={22} color={isDownloadingMap ? colours.cyan : '#fff'} />
          </Pressable>
        </View>

        {(emergencyBeacon?.active || priorityEmergency) && (
          <View style={[styles.emergencyStrip, shadow.subtle]}>
            <Ionicons name="alert-circle" size={18} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyStripTitle}>
                {emergencyBeacon?.active ? 'YOUR EMERGENCY BEACON IS ACTIVE' : `${priorityEmergency?.callsign} EMERGENCY BEACON`}
              </Text>
              <Text style={styles.emergencyStripDetail} numberOfLines={1}>
                {emergencyBeacon?.active
                  ? 'Team broadcast is sending your current position.'
                  : `${priorityEmergency?.callsign} requested assistance. NAV target is set.`}
              </Text>
            </View>
            {emergencyBeacon?.active ? (
              <Pressable style={styles.emergencyStripButton} onPress={clearEmergencyBeacon}>
                <Text style={styles.emergencyStripButtonText}>CLEAR</Text>
              </Pressable>
            ) : priorityEmergency ? (
              <Pressable style={styles.emergencyStripButton} onPress={() => focusTeammate(priorityEmergency)}>
                <Text style={styles.emergencyStripButtonText}>FOCUS</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* ── Left Sidebar: Compass + Zoom ─────────────────────────── */}
        <View style={styles.atakLeftBar} pointerEvents="box-none">
          <View style={styles.atakCompass}>
            <Animated.View
              style={{
                transform: [{
                  rotate: mapNorthUp
                    ? rotationAnim.interpolate({ inputRange: [-720, 0, 360, 720], outputRange: ['-720deg', '0deg', '360deg', '720deg'] })
                    : '0deg',
                }],
              }}
            >
              <Ionicons name="navigate" size={20} color={colours.background} />
            </Animated.View>
            <Text style={styles.atakCompassText}>{displayHeading != null ? `${Math.round(displayHeading)}°` : 'N'}</Text>
          </View>
          <Pressable style={styles.atakSideBtn} onPress={() => { if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current); setMapZoom((z) => Math.min(18, z + 1)); }}>
            <Text style={styles.atakSideBtnText}>+</Text>
          </Pressable>
          <Pressable style={styles.atakSideBtn} onPress={() => { if (zoomAnimFrame.current) cancelAnimationFrame(zoomAnimFrame.current); setMapZoom((z) => Math.max(2, z - 1)); }}>
            <Text style={styles.atakSideBtnText}>−</Text>
          </Pressable>
        </View>

        {/* ── Floating timer pill (bottom-left, above bottom bar) ─── */}
        {startTime && (
          <View style={[styles.forgeTimerPill, { bottom: atakBottomHeight + 10 }]} pointerEvents="none">
            <LiveTimerText startTime={startTime} isTracking={isTracking} staticSeconds={elapsedSeconds} style={styles.atakTimerText} />
            <Text style={styles.atakTimerLabel}>{currentDistance.toFixed(2)} km</Text>
          </View>
        )}

        {/* ── Bottom-right MGRS / Telemetry HUD ───────────────────── */}
        <View style={[styles.atakHud, { bottom: atakBottomHeight + 10 }]} pointerEvents="box-none">
          {editingCallsign ? (
            <TextInput
              style={styles.atakHudCallsignInput}
              value={callsignDraft}
              onChangeText={setCallsignDraft}
              autoFocus
              autoCapitalize="characters"
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={async () => {
                const trimmed = callsignDraft.trim().toUpperCase() || callsign;
                setCallsign(trimmed);
                await secureSetItem('forge:callsign', trimmed);
                setEditingCallsign(false);
              }}
              onBlur={async () => {
                const trimmed = callsignDraft.trim().toUpperCase() || callsign;
                setCallsign(trimmed);
                await secureSetItem('forge:callsign', trimmed);
                setEditingCallsign(false);
              }}
            />
          ) : (
            <Pressable onPress={() => { setCallsignDraft(callsign); setEditingCallsign(true); }}>
              <Text style={styles.atakHudCallsign}>{callsign} ✎</Text>
            </Pressable>
          )}
          <Text style={styles.atakHudCoord} numberOfLines={2}>
            {(gpsFollowMode ? currentCoordinate : mapCenterCoordinate) ?? 'Acquiring GPS...'}
          </Text>
          <View style={styles.atakHudRow}>
            <Text style={styles.atakHudLabel}>{altitudeFt != null ? `${altitudeFt} ft MSL` : '--- ft MSL'}</Text>
            <Text style={styles.atakHudLabel}>{displayHeading != null ? `${Math.round(displayHeading)}°M` : '---'}</Text>
          </View>
          <View style={styles.atakHudRow}>
            <Text style={styles.atakHudLabel}>{speedKmh} km/h</Text>
            <Text style={styles.atakHudLabel}>
              {currentPoint?.accuracy != null ? `+/- ${Math.round(currentPoint.accuracy)}m` : '+/- --'}
            </Text>
          </View>
        </View>

        {/* ── Scale bar bottom-left ─────────────────────────────────── */}
        {scaleBar && (
          <View style={[styles.atakScaleBar, { bottom: atakBottomHeight + 10 }]} pointerEvents="none">
            <View style={[styles.atakScaleBarLine, { width: scaleBar.width }]} />
            <Text style={styles.atakScaleBarText}>{scaleBar.label}</Text>
          </View>
        )}

        {/* ── FORGE Tabbed Bottom Panel ─────────────────────────────── */}
        <View style={styles.forgeBottomArea}>
          {/* Expandable Tab Content */}
          {atakTab && (
            <View style={styles.forgePanel}>
              {atakTab === 'map' && (
                <View style={styles.forgePanelContent}>
                  <View style={styles.forgePanelRow}>
                    {mapLayerOptions.map((opt) => (
                      <Pressable
                        key={opt.key}
                        style={[styles.forgePanelBtn, mapLayer === opt.key && styles.forgePanelBtnActive]}
                        onPress={() => setMapLayer(opt.key)}
                      >
                        <Text style={[styles.forgePanelBtnText, mapLayer === opt.key && styles.forgePanelBtnTextActive]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.forgePanelRow}>
                    <Pressable style={[styles.forgePanelBtn, mapNorthUp && styles.forgePanelBtnActive]} onPress={() => setMapNorthUp((v) => !v)}>
                      <Ionicons name="compass-outline" size={13} color={mapNorthUp ? colours.background : colours.text} />
                      <Text style={[styles.forgePanelBtnText, mapNorthUp && styles.forgePanelBtnTextActive]}>{mapNorthUp ? 'North Up' : 'Heading Up'}</Text>
                    </Pressable>
                    <Pressable style={[styles.forgePanelBtn, gpsFollowMode && styles.forgePanelBtnActive]} onPress={() => {
                      if (gpsFollowMode) { setGpsFollowMode(false); }
                      else { setGpsFollowMode(true); setMapCenter(null); }
                    }}>
                      <Ionicons name={gpsFollowMode ? 'locate' : 'locate-outline'} size={13} color={gpsFollowMode ? colours.background : colours.text} />
                      <Text style={[styles.forgePanelBtnText, gpsFollowMode && styles.forgePanelBtnTextActive]}>{gpsFollowMode ? 'GPS Follow' : 'Pan Free'}</Text>
                    </Pressable>
                  </View>
                  {/* Draw mode row */}
                  <View style={styles.forgePanelRow}>
                    <Pressable style={[styles.forgePanelBtn, drawMode && { backgroundColor: drawColor, borderColor: drawColor }]} onPress={() => {
                      setMeasurementMode(null);
                      setDrawMode((v) => !v);
                    }}>
                      <Ionicons name="pencil-outline" size={13} color={drawMode ? colours.background : colours.text} />
                      <Text style={[styles.forgePanelBtnText, drawMode && { color: colours.background }]}>{drawMode ? 'Drawing ON' : 'Draw Mode'}</Text>
                    </Pressable>
                    {(['range', 'route', 'area'] as const).map((mode) => {
                      const selected = measurementMode === mode;
                      return (
                        <Pressable
                          key={mode}
                          style={[styles.forgePanelBtn, selected && { backgroundColor: '#facc15', borderColor: '#facc15' }]}
                          onPress={() => setActiveMeasurementMode(mode)}
                        >
                          <Ionicons
                            name={mode === 'range' ? 'resize-outline' : mode === 'route' ? 'analytics-outline' : 'triangle-outline'}
                            size={13}
                            color={selected ? colours.background : '#facc15'}
                          />
                          <Text style={[styles.forgePanelBtnText, selected && { color: colours.background }]}>
                            {mode === 'range' ? 'Range' : mode === 'route' ? 'Route' : 'Area'}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {measurementPoints.length > 0 && (
                      <Pressable style={[styles.forgePanelBtn, { borderColor: colours.red }]} onPress={() => setMeasurementPoints([])}>
                        <Ionicons name="close" size={13} color={colours.red} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.red }]}>Clear Measure</Text>
                      </Pressable>
                    )}
                    {drawLines.length > 0 && (
                      <Pressable style={[styles.forgePanelBtn, { borderColor: colours.red }]} onPress={() => { setDrawLines([]); setCurrentDrawLine(null); }}>
                        <Ionicons name="trash-outline" size={13} color={colours.red} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.red }]}>Clear</Text>
                      </Pressable>
                    )}
                    {(['#ff4444', '#facc15', '#34d399', '#60a5fa', '#f97316', '#a78bfa'] as const).map((col) => (
                      <Pressable
                        key={col}
                        style={[styles.forgeColorDot, { backgroundColor: col }, drawColor === col && styles.forgeColorDotActive]}
                        onPress={() => setDrawColor(col)}
                      />
                    ))}
                  </View>
                  {measurementMode && (
                    <View style={styles.measurePanel}>
                      <View style={styles.measurePanelItem}>
                        <Text style={styles.measurePanelValue}>{measurementPoints.length}</Text>
                        <Text style={styles.measurePanelLabel}>PTS</Text>
                      </View>
                      <View style={styles.measurePanelItem}>
                        <Text style={styles.measurePanelValue}>{formatMeasureDistance(measurementDistanceKm)}</Text>
                        <Text style={styles.measurePanelLabel}>{measurementMode === 'area' ? 'PERIMETER' : 'DISTANCE'}</Text>
                      </View>
                      <View style={styles.measurePanelItem}>
                        <Text style={styles.measurePanelValue}>{measurementBearing == null ? '--' : formatHeading(measurementBearing)}</Text>
                        <Text style={styles.measurePanelLabel}>BRG</Text>
                      </View>
                      {measurementMode === 'area' && (
                        <View style={styles.measurePanelItem}>
                          <Text style={styles.measurePanelValue}>{formatMeasureArea(measurementAreaMeters)}</Text>
                          <Text style={styles.measurePanelLabel}>AREA</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
              {atakTab === 'cp' && (
                <View style={styles.forgePanelContent}>
                  <View style={styles.forgePanelRow}>
                    {fieldMarkTypes.map((markType) => {
                      const selected = activeMarkType === markType.key;
                      return (
                        <Pressable
                          key={markType.key}
                          style={[styles.forgeMarkTypeBtn, selected && { borderColor: markType.tone, backgroundColor: `${markType.tone}22` }]}
                          onPress={() => setActiveMarkType(markType.key)}
                        >
                          <Ionicons name={markType.icon} size={13} color={selected ? markType.tone : colours.muted} />
                          <Text style={[styles.forgeMarkTypeText, selected && { color: markType.tone }]}>{markType.shortLabel}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.forgePanelRow}>
                    <Pressable style={styles.forgePanelBtn} onPress={addCheckpointHere}>
                      <Ionicons name={getFieldMarkType(activeMarkType).icon} size={13} color={colours.cyan} />
                      <Text style={[styles.forgePanelBtnText, { color: colours.cyan }]}>Drop {getFieldMarkType(activeMarkType).shortLabel}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.forgePanelBtn, tapMarkMode && styles.forgePanelBtnActive]}
                      onPress={() => {
                        setMeasurementMode(null);
                        setTapMarkMode((value) => !value);
                      }}
                    >
                      <Ionicons name="finger-print-outline" size={13} color={tapMarkMode ? colours.background : colours.text} />
                      <Text style={[styles.forgePanelBtnText, tapMarkMode && styles.forgePanelBtnTextActive]}>{tapMarkMode ? 'Tap Drop ON' : 'Tap Drop'}</Text>
                    </Pressable>
                    {selectedCheckpoint && (
                      <Pressable style={styles.forgePanelBtn} onPress={updateSelectedCheckpointHere}>
                        <Ionicons name="pin-outline" size={13} color={colours.amber} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.amber }]}>Move CP</Text>
                      </Pressable>
                    )}
                    {plannedCheckpoints.length > 0 && (
                      <Pressable style={[styles.forgePanelBtn, { borderColor: colours.red }]} onPress={clearAllCheckpoints}>
                        <Ionicons name="trash-outline" size={13} color={colours.red} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.red }]}>Clear All</Text>
                      </Pressable>
                    )}
                  </View>
                  {plannedCheckpoints.length > 0 ? (
                    <View style={styles.forgeCpRow}>
                      {plannedCheckpoints.map((cp) => (
                        <Pressable
                          key={cp.id}
                          style={[styles.forgeCpPill, selectedCheckpointId === cp.id && styles.forgeCpPillActive]}
                          onPress={() => focusNavMark(cp.id)}
                        >
                          <Text style={[styles.forgeCpPillText, selectedCheckpointId === cp.id && styles.forgeCpPillTextActive]}>
                            {formatFieldMarkLabel(cp)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.forgePanelHint}>Pick a mark type, pan or enable Tap Drop, then place it on the field map.</Text>
                  )}
                </View>
              )}
              {atakTab === 'offline' && (
                <View style={styles.forgePanelContent}>
                  <View style={styles.forgePanelRow}>
                    {isDownloadingMap ? (
                      <View style={[styles.forgePanelBtn, { flex: 1 }]}>
                        <Text style={[styles.forgePanelBtnText, { color: colours.cyan }]}>{downloadProgress}% Downloading...</Text>
                      </View>
                    ) : (
                      <Pressable style={[styles.forgePanelBtn, { flex: 1 }]} onPress={downloadOfflineMap}>
                        <Ionicons name="cloud-download-outline" size={13} color={colours.cyan} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.cyan }]}>Download Area</Text>
                      </Pressable>
                    )}
                    <Pressable style={[styles.forgePanelBtn, { borderColor: colours.red }]} onPress={confirmClearOfflineMap}>
                      <Ionicons name="trash-outline" size={13} color={colours.red} />
                      <Text style={[styles.forgePanelBtnText, { color: colours.red }]}>Clear Cache</Text>
                    </Pressable>
                  </View>
                  {/* GPX import */}
                  <View style={styles.forgePanelRow}>
                    <Pressable style={[styles.forgePanelBtn, { flex: 1 }]} onPress={handleGpxImport}>
                      <Ionicons name="document-outline" size={13} color="#facc15" />
                      <Text style={[styles.forgePanelBtnText, { color: '#facc15' }]}>Import GPX Overlay</Text>
                    </Pressable>
                    <Pressable style={[styles.forgePanelBtn, { flex: 1 }]} onPress={handleGeoJsonImport}>
                      <Ionicons name="shapes-outline" size={13} color="#60a5fa" />
                      <Text style={[styles.forgePanelBtnText, { color: '#60a5fa' }]}>Import GeoJSON</Text>
                    </Pressable>
                    <Pressable style={[styles.forgePanelBtn, { flex: 1 }]} onPress={handleKmlImport}>
                      <Ionicons name="map-outline" size={13} color="#34d399" />
                      <Text style={[styles.forgePanelBtnText, { color: '#34d399' }]}>Import KML</Text>
                    </Pressable>
                    <Pressable style={[styles.forgePanelBtn, { flex: 1 }]} onPress={handleKmzImport}>
                      <Ionicons name="archive-outline" size={13} color="#a78bfa" />
                      <Text style={[styles.forgePanelBtnText, { color: '#a78bfa' }]}>Import KMZ</Text>
                    </Pressable>
                    {importedRoute.length > 0 && (
                      <Pressable style={[styles.forgePanelBtn, { borderColor: colours.red }]} onPress={() => { setImportedRoute([]); setImportedRouteName(null); }}>
                        <Ionicons name="close" size={13} color={colours.red} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.red }]}>Clear GPX</Text>
                      </Pressable>
                    )}
                  </View>
                  {importedRouteName && (
                    <Text style={styles.forgePanelHint}>
                      {importedRoute.length > 0
                        ? `Route: ${importedRouteName} — ${importedRoute.length} pts (yellow dashes)`
                        : 'No route loaded'}
                    </Text>
                  )}
                  {!importedRouteName && mapOverlays.length === 0 && (
                    <Text style={styles.forgePanelHint}>Overlay manager supports GPX routes plus GeoJSON, KML, and KMZ points, lines, and areas.</Text>
                  )}
                  {mapOverlays.length > 0 && (
                    <View style={styles.overlayList}>
                      {mapOverlays.map((overlay) => (
                        <View key={overlay.id} style={styles.overlayRow}>
                          <View style={[styles.overlaySwatch, { backgroundColor: overlay.color }]} />
                          <Pressable style={styles.overlayCopy} onPress={() => toggleOverlayVisibility(overlay.id)}>
                            <Text style={styles.overlayTitle} numberOfLines={1}>{overlay.name}</Text>
                            <Text style={styles.overlayMeta}>
                              {overlay.format.toUpperCase()} | {overlay.visible ? 'Visible' : 'Hidden'} | {overlay.points.length} pts | {overlay.lines.length} lines | {overlay.polygons.length} areas
                            </Text>
                          </Pressable>
                          <Pressable style={styles.overlayIconBtn} onPress={() => centerMapOnOverlay(overlay)}>
                            <Ionicons name="scan-outline" size={15} color={colours.cyan} />
                          </Pressable>
                          <Pressable style={styles.overlayIconBtn} onPress={() => toggleOverlayVisibility(overlay.id)}>
                            <Ionicons name={overlay.visible ? 'eye-outline' : 'eye-off-outline'} size={15} color={overlay.visible ? colours.green : colours.muted} />
                          </Pressable>
                          <Pressable style={styles.overlayIconBtn} onPress={() => removeOverlay(overlay.id)}>
                            <Ionicons name="trash-outline" size={15} color={colours.red} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
              {atakTab === 'nav' && (
                <View style={styles.forgePanelContent}>
                  <View style={styles.forgeNavRow}>
                    <View style={styles.forgeNavItem}>
                      <Text style={[styles.forgeNavValue, { color: bearingGuidance.tone }]}>{bearingGuidance.label}</Text>
                      <Text style={styles.forgeNavLabel}>{bearingGuidance.detail}</Text>
                    </View>
                    <View style={styles.forgeNavItem}>
                      <Text style={[styles.forgeNavValue, { color: navTargetTone }]}>{navTargetKind}</Text>
                      <Text style={styles.forgeNavLabel}>{navTargetLabel}</Text>
                    </View>
                    <View style={styles.forgeNavItem}>
                      <Text style={styles.forgeNavValue}>{navTargetDistanceKm == null ? '--' : `${navTargetDistanceKm.toFixed(1)}km`}</Text>
                      <Text style={styles.forgeNavLabel}>To object</Text>
                    </View>
                    <View style={styles.forgeNavItem}>
                      <Text style={styles.forgeNavValue}>{navTargetEtaMinutes == null ? '--' : formatDuration(navTargetEtaMinutes)}</Text>
                      <Text style={styles.forgeNavLabel}>Object ETA</Text>
                    </View>
                  </View>
                  <View style={styles.forgePanelRow}>
                    <Pressable style={styles.forgePanelBtn} onPress={centerMapOnNavTarget} disabled={!navTargetPoint}>
                      <Ionicons name="scan-outline" size={13} color={navTargetPoint ? colours.cyan : colours.muted} />
                      <Text style={[styles.forgePanelBtnText, !navTargetPoint && { color: colours.muted }]}>Center Target</Text>
                    </Pressable>
                    {navTeammateTarget && (
                      <Pressable style={[styles.forgePanelBtn, { borderColor: navTeammateTarget.color }]} onPress={() => focusTeammate(navTeammateTarget)}>
                        <Ionicons name="radio-outline" size={13} color={navTeammateTarget.color} />
                        <Text style={[styles.forgePanelBtnText, { color: navTeammateTarget.color }]}>Bloodhound</Text>
                      </Pressable>
                    )}
                    {teammates.map((tm) => (
                      <Pressable key={tm.callsign} style={[styles.forgePanelBtn, navTarget?.type === 'teammate' && navTarget.id === tm.callsign && { borderColor: tm.color, backgroundColor: `${tm.color}22` }]} onPress={() => focusTeammate(tm)}>
                        <Ionicons name="person-outline" size={13} color={tm.color} />
                        <Text style={[styles.forgePanelBtnText, { color: tm.color }]}>{tm.callsign}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              {atakTab === 'ops' && (
                <View style={styles.forgePanelContent}>
                  <View style={styles.forgePanelRow}>
                    <Pressable
                      style={[styles.forgePanelBtn, teamEnabled && styles.forgePanelBtnActive]}
                      onPress={() => setTeamEnabled((v) => !v)}
                    >
                      <Ionicons name="people-outline" size={13} color={teamEnabled ? colours.background : colours.text} />
                      <Text style={[styles.forgePanelBtnText, teamEnabled && styles.forgePanelBtnTextActive]}>
                        {teamEnabled ? (teamConnected ? `Team ON - ${teammates.length} online` : 'Connecting...') : 'Team PLI'}
                      </Text>
                    </Pressable>
                    {emergencyBeacon?.active ? (
                      <Pressable style={[styles.forgePanelBtn, { borderColor: colours.green }]} onPress={clearEmergencyBeacon}>
                        <Ionicons name="checkmark-circle-outline" size={13} color={colours.green} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.green }]}>Clear Beacon</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={[styles.forgePanelBtn, { borderColor: colours.red }]} onPress={triggerEmergencyBeacon}>
                        <Ionicons name="alert-circle-outline" size={13} color={colours.red} />
                        <Text style={[styles.forgePanelBtnText, { color: colours.red }]}>Emergency</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.forgePanelBtn} onPress={shareSelectedMark} disabled={!selectedCheckpointPoint}>
                      <Ionicons name="share-social-outline" size={13} color={selectedCheckpointPoint ? colours.cyan : colours.muted} />
                      <Text style={[styles.forgePanelBtnText, !selectedCheckpointPoint && { color: colours.muted }]}>Share Mark</Text>
                    </Pressable>
                    <Pressable style={styles.forgePanelBtn} onPress={shareMeasurement} disabled={!measurementMode}>
                      <Ionicons name="git-network-outline" size={13} color={measurementMode ? '#facc15' : colours.muted} />
                      <Text style={[styles.forgePanelBtnText, measurementMode && { color: '#facc15' }, !measurementMode && { color: colours.muted }]}>Share Measure</Text>
                    </Pressable>
                  </View>
                  <View style={styles.forgeNavRow}>
                    <View style={styles.forgeNavItem}>
                      <Text style={styles.forgeNavValue}>{teammates.length}</Text>
                      <Text style={styles.forgeNavLabel}>Team</Text>
                    </View>
                    <View style={styles.forgeNavItem}>
                      <Text style={styles.forgeNavValue}>{receivedSharedObjects.length}</Text>
                      <Text style={styles.forgeNavLabel}>Received</Text>
                    </View>
                    <View style={styles.forgeNavItem}>
                      <Text style={styles.forgeNavValue}>{sharedObjects.length}</Text>
                      <Text style={styles.forgeNavLabel}>Sent</Text>
                    </View>
                    <View style={styles.forgeNavItem}>
                      <Text style={[styles.forgeNavValue, emergencyBeacon?.active && { color: colours.red }]}>{teamEvents.length}</Text>
                      <Text style={styles.forgeNavLabel}>Events</Text>
                    </View>
                  </View>
                  <View style={styles.opsSection}>
                    <View style={styles.opsSectionHeader}>
                      <Text style={styles.opsSectionTitle}>Team</Text>
                      <Text style={styles.opsSectionMeta}>{teamConnected ? `${teammates.length} online` : teamEnabled ? 'connecting' : 'offline'}</Text>
                    </View>
                    {teammates.length > 0 ? (
                      <View style={styles.forgeCpRow}>
                        {teammates.map((tm) => (
                          <Pressable key={tm.callsign} style={[styles.forgeCpPill, { borderColor: tm.color }]} onPress={() => focusTeammate(tm)}>
                            <Text style={[styles.forgeCpPillText, { color: tm.color }]}>{tm.callsign}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.opsEmptyRow}>
                        <Ionicons name="people-outline" size={13} color={colours.muted} />
                        <Text style={styles.opsEmptyText}>Enable Team PLI to populate live teammates.</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.opsSection}>
                    <View style={styles.opsSectionHeader}>
                      <Text style={styles.opsSectionTitle}>Shared Objects</Text>
                      <Text style={styles.opsSectionMeta}>{receivedSharedObjects.length} received | {sharedObjects.length} sent</Text>
                    </View>
                    {receivedSharedObjects.length > 0 ? (
                      <View style={styles.teamSharedList}>
                        {receivedSharedObjects.slice(0, 3).map((object) => (
                          <Pressable key={object.id} style={styles.teamSharedRow} onPress={() => centerMapOnSharedObject(object)}>
                            <Ionicons name={object.type === 'mark' ? 'flag-outline' : 'analytics-outline'} size={13} color="#facc15" />
                            <Text style={styles.teamSharedText} numberOfLines={1}>{object.sender}: {object.label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.opsEmptyRow}>
                        <Ionicons name="share-social-outline" size={13} color={colours.muted} />
                        <Text style={styles.opsEmptyText}>Shared marks and measurements appear here.</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.opsSection}>
                    <View style={styles.opsSectionHeader}>
                      <Text style={styles.opsSectionTitle}>Event Log</Text>
                      <Text style={styles.opsSectionMeta}>{teamEvents.length} alerts</Text>
                    </View>
                    {teamEvents.length > 0 ? (
                      <View style={styles.teamEventList}>
                        {teamEvents.slice(0, 2).map((event) => (
                          <View key={event.id} style={styles.teamEventRow}>
                            <View style={[styles.teamEventDot, { backgroundColor: event.tone }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.teamEventTitle}>{event.title}</Text>
                              <Text style={styles.teamEventDetail} numberOfLines={1}>{event.detail}</Text>
                            </View>
                            <Text style={styles.teamEventTime}>{formatElapsed(Math.max(0, Math.round((Date.now() - event.time) / 1000)))}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.opsEmptyRow}>
                        <Ionicons name="notifications-outline" size={13} color={colours.muted} />
                        <Text style={styles.opsEmptyText}>Emergency beacons and team activity will stack here.</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Unified bottom bar: action control + icon tabs */}
          <View style={styles.forgeBottomBar}>
            <View style={styles.forgeBottomBarAction}>
              {isStarting ? (
                <View style={[styles.atakActionBtnSm, { opacity: 0.6, backgroundColor: colours.cyan }]}>
                  <Ionicons name="sync" size={14} color={colours.background} />
                  <Text style={styles.atakActionBtnTextSm}>GPS...</Text>
                </View>
              ) : isTracking ? (
                <Pressable style={[styles.atakActionBtnSm, styles.atakStopBtn]} onPress={stopTracking}>
                  <Ionicons name="stop-circle" size={15} color="#fff" />
                  <Text style={styles.atakActionBtnTextSm}>Stop</Text>
                </Pressable>
              ) : startTime ? (
                <View style={{ flexDirection: 'row', gap: 5 }}>
                  <Pressable style={[styles.atakActionBtnSm, { backgroundColor: colours.cyan }]} onPress={resumeTracking}>
                    <Ionicons name="play" size={14} color={colours.background} />
                    <Text style={styles.atakActionBtnTextSm}>Resume</Text>
                  </Pressable>
                  <Pressable style={[styles.atakActionBtnSm, styles.atakSaveBtn]} onPress={openRuckReview}>
                    <Ionicons name="checkmark-circle" size={14} color={colours.background} />
                    <Text style={styles.atakActionBtnTextSm}>Review</Text>
                  </Pressable>
                  <Pressable style={[styles.atakActionBtnSm, styles.atakDiscardBtn]} onPress={discardTrackedRuck}>
                    <Ionicons name="close" size={15} color={colours.text} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={[styles.atakActionBtnSm, { backgroundColor: colours.cyan }]} onPress={() => startTracking()}>
                  <Ionicons name="play-circle" size={14} color={colours.background} />
                  <Text style={styles.atakActionBtnTextSm}>Start Track</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.forgeTabGroup}>
              {([
                ['map', 'map-outline', 'MAP'],
                ['cp', 'flag-outline', 'CP'],
                ['offline', 'cloud-download-outline', 'OFFLINE'],
                ['nav', 'navigate-outline', 'NAV'],
                ['ops', 'radio-outline', 'OPS'],
              ] as const).map(([tab, icon, label]) => (
                <Pressable
                  key={tab}
                  style={[styles.forgeTab, atakTab === tab && styles.forgeTabActive]}
                  onPress={() => setAtakTab(atakTab === tab ? null : tab)}
                >
                  <Ionicons name={icon} size={16} color={atakTab === tab ? colours.cyan : colours.muted} />
                  {atakTab === tab && <Text style={styles.forgeTabTextActive}>{label}</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Screen>
      <View style={styles.missionHeader}>
        <Text style={styles.missionLabel}>FORGE RUCK</Text>
        <View style={styles.missionStateBadge}>
          <View style={[styles.missionStateDot, { backgroundColor: isTracking ? colours.green : startTime ? colours.amber : colours.muted }]} />
          <Text style={[styles.missionStateText, { color: isTracking ? colours.green : startTime ? colours.amber : colours.muted }]}>
            {isTracking ? 'TRACKING' : startTime ? 'PAUSED' : 'READY'}
          </Text>
        </View>
      </View>
      {!supportsBackgroundLocation && (
        <Text style={styles.platformNote}>Web tracking runs while this tab stays open. Use the native app for locked-screen GPS.</Text>
      )}

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroTitleBlock}>
            <Text style={styles.heroKicker}>RUCK COMMAND</Text>
            <Text style={styles.heroTitle}>{isTracking ? 'Live Ruck Mode' : startTime ? 'Ruck paused for review' : 'Plan, track, review'}</Text>
            <Text style={styles.heroSub}>
              {isTracking
                ? `${currentDistance.toFixed(2)} km moving - ${activePace} min/km`
                : `${targetDistanceKm.toFixed(1)} km target - ${weight} kg - ${plannedCheckpoints.length} checkpoints`}
            </Text>
          </View>
          <View style={styles.heroScoreBox}>
            <Text style={styles.heroScore}>{(startTime ? activeRuckScore.score : projectedRuckScore.score)}</Text>
            <Text style={styles.heroScoreLabel}>RUCK SCORE</Text>
          </View>
        </View>
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{startTime ? activeRuckScore.loadAdjustedPace : projectedRuckScore.loadAdjustedPace}</Text>
            <Text style={styles.heroStatLabel}>LOAD-ADJ PACE</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{plannedCheckpoints.length}</Text>
            <Text style={styles.heroStatLabel}>FIELD MARKS</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatValue, { color: teamEnabled ? colours.green : colours.muted }]}>{teamEnabled ? 'ON' : 'OFF'}</Text>
            <Text style={styles.heroStatLabel}>BEACON</Text>
          </View>
        </View>
        <View style={styles.heroActions}>
          <Pressable style={styles.heroPrimaryButton} onPress={() => startTime ? openRuckReview() : startTracking()}>
            <Ionicons name={startTime ? 'checkmark-circle-outline' : 'play-circle-outline'} size={18} color={colours.background} />
            <Text style={styles.heroPrimaryText}>{startTime ? 'After Action Review' : 'Start Live Ruck'}</Text>
          </Pressable>
          <Pressable style={styles.heroSecondaryButton} onPress={() => setActiveSection('field')}>
            <Ionicons name="flag-outline" size={17} color={colours.cyan} />
            <Text style={styles.heroSecondaryText}>Route Card</Text>
          </Pressable>
          <Pressable style={styles.heroSecondaryButton} onPress={() => setActiveSection('metrics')}>
            <Ionicons name="bar-chart-outline" size={17} color={colours.cyan} />
            <Text style={styles.heroSecondaryText}>Score</Text>
          </Pressable>
        </View>
        <Text style={styles.heroFinding}>
          {(startTime ? activeRuckScore : projectedRuckScore).finding} {(startTime ? activeRuckScore : projectedRuckScore).recommendation}
        </Text>
      </View>

      <View style={[styles.mapBlock, showExpandedMap && styles.mapBlockExpanded]}>
        {renderMapStage(false)}

        <View style={styles.mapTopOverlay} pointerEvents="box-none">
          <RuckMapHeader
            isTracking={isTracking}
            hasStarted={Boolean(startTime)}
            gpsQuality={gpsQuality}
            rejectedPointCount={rejectedPointCount}
            lastRejectedReason={lastRejectedReason}
            missionMode={missionMode}
            tacticalOptionsOpen={tacticalOptionsOpen}
            onModeChange={setMissionMode}
            onToggleOptions={() => setTacticalOptionsOpen((value) => !value)}
            onOpenFullscreen={() => setMapFullscreen(true)}
          />
          {tacticalOptionsOpen ? (
            <RuckTacticalOptionsDrawer
              coordinateFormat={coordinateFormat}
              mapLayer={mapLayer}
              tapMarkMode={tapMarkMode}
              hasSelectedCheckpoint={Boolean(selectedCheckpoint)}
              isDownloadingMap={isDownloadingMap}
              downloadProgress={downloadProgress}
              onCoordinateFormatChange={setCoordinateFormat}
              onMapLayerChange={setMapLayer}
              onToggleTapMark={() => {
                setMeasurementMode(null);
                setTapMarkMode((value) => !value);
              }}
              onMoveCheckpointHere={updateSelectedCheckpointHere}
              onDownloadOfflineMap={downloadOfflineMap}
              onClearOfflineMap={confirmClearOfflineMap}
            />
          ) : null}
        </View>

        <View style={styles.mapBottomOverlay} pointerEvents="box-none">
          <RuckLiveStatsRibbon
            currentDistance={currentDistance}
            startTime={startTime}
            isTracking={isTracking}
            elapsedSeconds={elapsedSeconds}
            missionMode={missionMode}
            navTargetBearing={navTargetBearing}
            displayBearing={displayBearing}
            activePace={activePace}
          />
          {missionMode !== 'simple' && currentPoint && currentCoordinate && (
            <Text style={styles.coordinateText}>
              {!gpsFollowMode && mapCenter ? `Map centre: ${mapCenterCoordinate}` : currentCoordinate}
              {currentPoint.accuracy ? ` | +/-${Math.round(currentPoint.accuracy)}m` : ''}
            </Text>
          )}
        </View>

        <Pressable
          style={[styles.mapExpandFab, hasActiveGpsSession && styles.mapExpandFabLocked]}
          onPress={() => setMapExpanded((current) => !current)}
          disabled={hasActiveGpsSession}
        >
          <Ionicons name={showExpandedMap ? 'contract' : 'expand'} size={15} color={showExpandedMap ? colours.cyan : colours.textSoft} />
        </Pressable>

        <Pressable
          style={[styles.mapGuideFab, guideOpen && styles.mapGuideFabActive]}
          onPress={() => setGuideOpen((v) => !v)}
        >
          <Ionicons name="book-outline" size={15} color={guideOpen ? colours.background : colours.cyan} />
        </Pressable>

        <RuckMapGuidePanel visible={guideOpen} onClose={() => setGuideOpen(false)} />
      </View>

      <Modal visible={reviewOpen && !!startTime} animationType="slide">
        <AARScreen
          ruckScore={activeRuckScore}
          distanceKm={currentDistance}
          elapsedSeconds={elapsedSeconds}
          paceMinPerKm={activePace === '--' ? Number(pace) : Number(activePace)}
          loadKg={weight}
          ascentM={currentDistance > 0.02 ? Math.round((plannedAscentM / Math.max(distance, 0.1)) * currentDistance) : plannedAscentM}
          checkpointsReached={plannedCheckpoints.filter(cp => cp.status === 'reached').length}
          checkpointsTotal={plannedCheckpoints.length}
          sessionTitle={`${currentDistance.toFixed(1)}km GPS Ruck`}
          newPRs={newPRs}
          note={ruckReviewNote}
          onNoteChange={setRuckReviewNote}
          onSave={saveTrackedRuck}
          onResume={resumeTracking}
          onDiscard={discardTrackedRuck}
        />
      </Modal>

      {!reviewOpen ? (
        <RuckTrackingControls
          isTracking={isTracking}
          isStarting={isStarting}
          hasStarted={Boolean(startTime)}
          onStart={() => startTracking()}
          onStop={stopTracking}
          onResume={resumeTracking}
          onReview={openRuckReview}
          onDiscard={discardTrackedRuck}
        />
      ) : null}

      <View style={styles.sectionTabs}>
        {([
          ['mission', 'flag-outline', 'MISSION'],
          ['field', 'map-outline', 'FIELD'],
          ['metrics', 'bar-chart-outline', 'DATA'],
          ['ops', 'radio-outline', 'OPS'],
          ['setup', 'settings-outline', 'SETUP'],
        ] as const).map(([section, icon, label]) => {
          const active = activeSection === section;
          return (
            <Pressable
              key={section}
              style={[styles.sectionTab, active && styles.sectionTabActive]}
              onPress={() => setActiveSection(section)}
            >
              <Ionicons name={icon} size={13} color={active ? colours.background : colours.muted} />
              <Text style={[styles.sectionTabText, active && styles.sectionTabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {activeSection === 'mission' && (
        <>
          <RuckMissionBriefCard
            targetDistanceKm={targetDistanceKm}
            targetMinutes={targetMinutes}
            weightKg={weight}
            sessions={sessions}
          />
          <RuckMissionPaceCard
            currentDistance={currentDistance}
            targetDeltaMinutes={targetDeltaMinutes}
            templates={allRuckTemplates}
            activeTemplateId={activeTemplateId}
            templateNameInput={templateNameInput}
            targetDistanceKm={targetDistanceKm}
            targetMinutes={targetMinutes}
            targetPaceLabel={targetPaceLabel}
            targetRemainingKm={targetRemainingKm}
            targetEtaMinutes={targetEtaMinutes}
            targetProjectedMinutes={targetProjectedMinutes}
            finishMode={finishMode}
            finishOnTarget={finishOnTarget}
            finishLabel={finishLabel}
            finishDistanceRemainingKm={finishDistanceRemainingKm}
            finishEtaMinutes={finishEtaMinutes}
            finishRequiredPace={finishRequiredPace}
            onApplyTemplate={applyTemplate}
            onDeleteTemplate={deleteCustomTemplate}
            onTemplateNameChange={setTemplateNameInput}
            onSaveTemplate={saveCustomTemplate}
            onTargetDistanceChange={changeTargetDistance}
            onTargetMinutesChange={changeTargetMinutes}
            onFinishModeChange={setFinishMode}
          />
          <RuckHistoryCard sessions={sessions} />
          <Pressable style={styles.primaryButton} onPress={saveRuck}>
            <Text style={styles.primaryButtonText}>Save Ruck Session</Text>
          </Pressable>
        </>
      )}

      {activeSection === 'field' && (
        <>
          <RuckFieldMarksCard
            arrivalCheckpoint={arrivalCheckpoint}
            plannedCheckpoints={plannedCheckpoints}
            nearestCheckpointDistanceMeters={nearestCheckpoint ? Math.round(nearestCheckpoint.distanceKm * 1000) : null}
            activeMarkType={activeMarkType}
            selectedCheckpoint={selectedCheckpoint}
            selectedCheckpointPoint={selectedCheckpointPoint}
            selectedCheckpointDistanceKm={selectedCheckpointDistanceKm}
            selectedCheckpointBearing={selectedCheckpointBearing}
            selectedCheckpointEtaMinutes={selectedCheckpointEtaMinutes}
            checkpointCoordinateInput={checkpointCoordinateInput}
            checkpointBulkInput={checkpointBulkInput}
            checkpointLabelInput={checkpointLabelInput}
            coordinateFormat={coordinateFormat}
            bearingGuidance={bearingGuidance}
            onAddCheckpointHere={addCheckpointHere}
            onCoordinateInputChange={setCheckpointCoordinateInput}
            onAddCheckpointFromInput={addCheckpointFromInput}
            onMarkTypeSelect={(markType) => {
              setActiveMarkType(markType);
              if (selectedCheckpoint) updateSelectedCheckpoint({ markType });
            }}
            onMoveSelectedToGrid={updateSelectedCheckpointFromInput}
            onMoveSelectedHere={updateSelectedCheckpointHere}
            onCheckpointLabelChange={setCheckpointLabelInput}
            onSaveCheckpointLabel={saveSelectedCheckpointLabel}
            onStatusChange={setSelectedCheckpointStatus}
            onFocusMark={focusNavMark}
            onClearSelected={clearSelectedCheckpoint}
            onUndoLast={undoLastCheckpoint}
            onClearAll={clearAllCheckpoints}
            onBulkInputChange={setCheckpointBulkInput}
            onImportCheckpoints={importCheckpoints}
          />
          <RuckCheckpointModeCard
            checkpointStatus={checkpointStatus}
            checkpointIndex={checkpointIndex}
            checkpointCount={checkpointCount}
            checkpointIntervalKm={checkpointIntervalKm}
            nextCheckpointKm={nextCheckpointKm}
            checkpointRemainingKm={checkpointRemainingKm}
            checkpointEtaMinutes={checkpointEtaMinutes}
            displayBearing={displayBearing}
            onMarkReached={markCheckpointReached}
            onUndoMark={undoCheckpointMark}
            onCheckpointIntervalChange={changeCheckpointInterval}
          />
          <RuckNavigationGuideCard
            rotationAnim={rotationAnim}
            activeHeading={activeHeading}
            naismithMinutes={naismithMinutes}
            plannedAscentM={plannedAscentM}
            routeBearing={routeBearing}
            currentAltitude={currentAltitude}
          />
        </>
      )}

      {activeSection === 'metrics' && (
        <>
          <RuckMetricSummary
            weightKg={weight}
            distanceKm={distance}
            pace={pace}
            pandolf={pandolf}
            activeHeading={activeHeading}
          />
          <RuckPerformancePanel score={score} pandolf={pandolf} distanceKm={distance} loadKg={weight} breakdown={projectedRuckScore} />
          <RuckSplitsCard splits={splits} />
          <RuckReadinessCard readiness={routeReadinessChecks} />
        </>
      )}

      {activeSection === 'ops' && (
        <RuckOpsPanel
          callsign={callsign}
          teammates={teammates}
          connected={teamConnected}
          teamEnabled={teamEnabled}
          dismissedCallsigns={dismissedCallsigns}
          currentPoint={currentPoint ?? null}
          messages={teamMessages}
          onFocusTeammate={(teammate) => {
            setMapCenter({ latitude: teammate.lat, longitude: teammate.lon, altitude: null, accuracy: null, timestamp: Date.now() });
            setGpsFollowMode(false);
          }}
          onDismissTeammate={(cs) => setDismissedCallsigns((prev) => [...prev, cs])}
          onToggleTeam={() => setTeamEnabled((v) => !v)}
          onSendMessage={sendTeamMessage}
        />
      )}

      {activeSection === 'setup' && (
        <RuckSessionSetupCard
          bodyMassKg={bodyMassKg}
          weightKg={weight}
          distanceKm={distance}
          plannedAscentM={plannedAscentM}
          terrainFactor={terrainFactor}
          pandolf={pandolf}
          onBodyMassChange={changeBodyMass}
          onWeightChange={changeWeight}
          onDistanceChange={changeDistance}
          onAscentChange={changeAscent}
          onTerrainChange={changeTerrain}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  missionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  missionLabel: { color: colours.text, fontSize: 22, fontWeight: '900', letterSpacing: 1.2 },
  missionStateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    backgroundColor: colours.surface,
  },
  missionStateDot: { width: 6, height: 6, borderRadius: 3 },
  missionStateText: { ...typography.label, letterSpacing: 1.2 },
  platformNote: { ...typography.caption, color: colours.amber, lineHeight: 18 },
  heroCard: {
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colours.surface,
    gap: 12,
    ...shadow.subtle,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  heroTitleBlock: { flex: 1 },
  heroKicker: { ...typography.label, color: colours.cyan },
  heroTitle: { color: colours.text, fontSize: 26, lineHeight: 30, fontWeight: '900', marginTop: 4 },
  heroSub: { color: colours.textSoft, fontSize: 13, lineHeight: 18, fontWeight: '800', marginTop: 5 },
  heroScoreBox: {
    minWidth: 92,
    borderWidth: 1,
    borderColor: `${colours.cyan}45`,
    borderRadius: 12,
    backgroundColor: colours.cyanDim,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  heroScore: { color: colours.cyan, fontSize: 38, lineHeight: 42, fontWeight: '900' },
  heroScoreLabel: { ...typography.label, color: colours.muted, fontSize: 8, letterSpacing: 1.1 },
  heroStats: { flexDirection: 'row', gap: 8 },
  heroStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 10,
    backgroundColor: colours.layer1,
    padding: 10,
  },
  heroStatValue: { color: colours.text, fontSize: 18, fontWeight: '900' },
  heroStatLabel: { ...typography.label, color: colours.muted, fontSize: 8, marginTop: 4 },
  heroActions: { flexDirection: 'row', gap: 8 },
  heroPrimaryButton: {
    minHeight: touchTarget,
    flex: 1.25,
    borderRadius: 10,
    backgroundColor: colours.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 10,
  },
  heroPrimaryText: { color: colours.background, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  heroSecondaryButton: {
    minHeight: touchTarget,
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderHot,
    borderRadius: 10,
    backgroundColor: colours.cyanDim,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  heroSecondaryText: { color: colours.cyan, fontSize: 12, fontWeight: '900' },
  heroFinding: { color: colours.textSoft, fontSize: 12, lineHeight: 18, fontWeight: '800' },
  mapBlock: {
    height: 520,
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
  },
  mapBlockExpanded: {
    height: 640,
  },
  mapTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colours.panel,
    borderBottomWidth: 1,
    borderBottomColor: colours.borderSoft,
  },
  mapBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colours.panel,
    borderTopWidth: 1,
    borderTopColor: colours.borderSoft,
  },
  mapExpandFab: {
    position: 'absolute',
    left: 10,
    bottom: 60,
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,8,15,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.18)',
  },
  mapExpandFabLocked: { opacity: 0.4 },
  mapGuideFab: {
    position: 'absolute',
    left: 10,
    bottom: 100,
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,8,15,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.18)',
  },
  mapGuideFabActive: {
    backgroundColor: colours.cyan,
    borderColor: colours.cyan,
  },
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
    backgroundColor: colours.layer2,
    borderWidth: 1,
    borderColor: colours.border,
    flexShrink: 0,
  },
  mapTelemetryFullscreen: { bottom: 142 },
  mapMissionStripFullscreen: { bottom: 198 },
  finishStripFullscreen: { bottom: 238 },
  bearingGuidanceStripFullscreen: { bottom: 88, left: 10, right: 200 },
  mapStage: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    backgroundColor: 'rgba(4,8,15,0.72)',
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
    right: 10,
    bottom: 60,
    gap: 8,
  },
  mapIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.28)',
    backgroundColor: 'rgba(4,8,15,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapIconButtonActive: {
    backgroundColor: colours.cyan,
    borderColor: colours.cyan,
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
  liveStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: colours.layer2,
  },
  liveValue: { color: colours.cyan, fontSize: 18, fontWeight: '900' },
  liveLabel: { ...typography.label, color: colours.muted, letterSpacing: 1.3, marginTop: 2 },
  coordinateText: { ...typography.caption, color: colours.muted, textAlign: 'center', marginTop: 4, paddingBottom: 6, paddingHorizontal: 12 },
  cardTitle: { color: colours.text, fontSize: 19, fontWeight: '900', marginBottom: responsiveSpacing('md') },
  navHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: responsiveSpacing('md') },
  sectionTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 10,
    backgroundColor: colours.surface,
    borderWidth: 1,
    borderColor: colours.borderSoft,
  },
  sectionTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 7,
  },
  sectionTabActive: { backgroundColor: colours.cyan },
  sectionTabText: { ...typography.label, color: colours.muted, letterSpacing: 0.8 },
  sectionTabTextActive: { color: colours.background },
  primaryButton: { minHeight: touchTarget, backgroundColor: colours.cyan, borderRadius: 8, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colours.background, fontWeight: '900', fontSize: 16 },

  // ── ATAK Fullscreen Styles ────────────────────────────────────────────────
  atakContainer: { flex: 1, backgroundColor: '#04080F' },
  atakTopBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 52,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 2,
    backgroundColor: 'rgba(4,8,15,0.86)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(103,232,249,0.18)',
    zIndex: 10,
  },
  atakTopBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  atakStatusText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  atakStatusDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '800', marginTop: 1 },
  emergencyStrip: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 72,
    zIndex: 12,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(224,95,79,0.62)',
    backgroundColor: 'rgba(155,34,34,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  emergencyStripTitle: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  emergencyStripDetail: { color: 'rgba(255,255,255,0.78)', fontSize: 9, fontWeight: '800', marginTop: 2 },
  emergencyStripButton: {
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  emergencyStripButtonText: { color: colours.red, fontSize: 10, fontWeight: '900' },
  atakLeftBar: {
    position: 'absolute',
    top: 62, right: 10, gap: 8, alignItems: 'center', zIndex: 10,
  },
  atakCompass: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colours.cyan,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  atakCompassText: { color: colours.background, fontSize: 8, fontWeight: '900', marginTop: 1 },
  atakSideBtn: {
    width: 44, height: 44, borderRadius: 8,
    backgroundColor: 'rgba(4,8,15,0.82)',
    borderWidth: 1, borderColor: 'rgba(103,232,249,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  atakSideBtnText: { color: colours.text, fontSize: 22, fontWeight: '900', lineHeight: 26 },
  atakHud: {
    position: 'absolute', bottom: 90, right: 10,
    minWidth: 185,
    backgroundColor: 'rgba(4,8,15,0.86)',
    borderWidth: 1, borderColor: 'rgba(103,232,249,0.28)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    zIndex: 10,
  },
  atakHudCallsign: { color: colours.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginBottom: 4 },
  atakHudCoord: {
    color: colours.text, fontSize: 11, fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  atakHudRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  atakHudLabel: { color: colours.cyan, fontSize: 10, fontWeight: '900' },
  atakScaleBar: {
    position: 'absolute', bottom: 90, left: 10,
    paddingVertical: 5, paddingHorizontal: 7,
    backgroundColor: 'rgba(4,8,15,0.72)',
    borderRadius: 4, alignItems: 'flex-start', gap: 2, zIndex: 10,
  },
  atakScaleBarLine: { height: 3, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 1 },
  atakScaleBarText: { color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: '900' },
  atakBottomStrip: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24,
    backgroundColor: 'rgba(4,8,15,0.90)',
    borderTopWidth: 1, borderTopColor: 'rgba(103,232,249,0.16)',
    zIndex: 10,
  },
  atakTimerText: { color: colours.text, fontSize: 18, fontWeight: '900' },
  atakTimerLabel: { color: colours.cyan, fontSize: 11, fontWeight: '900', marginTop: 1 },
  atakActionBtn: {
    minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 10, backgroundColor: colours.cyan, paddingHorizontal: 14,
  },
  atakActionBtnText: { color: colours.background, fontSize: 13, fontWeight: '900' },
  atakStopBtn: { backgroundColor: colours.red },
  atakSaveBtn: { backgroundColor: colours.green },
  atakDiscardBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: colours.border,
    width: 46, paddingHorizontal: 0,
  },
  atakEntryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.4)',
    backgroundColor: 'rgba(103,232,249,0.08)',
    marginRight: 8,
  },
  atakEntryBtnText: { color: colours.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  atakHudCallsignInput: {
    color: colours.cyan, fontSize: 11, fontWeight: '900', letterSpacing: 0.8,
    borderBottomWidth: 1, borderBottomColor: colours.cyan,
    paddingVertical: 1, minWidth: 80, marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  // ── FORGE Tabbed Panel ──────────────────────────────────────────────────
  forgeBottomArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: 'rgba(4,8,15,0.78)',
    borderTopWidth: 1, borderTopColor: 'rgba(103,232,249,0.22)',
  },
  forgePanel: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(103,232,249,0.10)',
  },
  forgePanelContent: {
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  forgePanelRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  forgePanelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.25)',
    backgroundColor: 'rgba(103,232,249,0.06)',
  },
  forgePanelBtnActive: {
    backgroundColor: colours.cyan, borderColor: colours.cyan,
  },
  forgePanelBtnText: { color: colours.text, fontSize: 12, fontWeight: '800' },
  forgePanelBtnTextActive: { color: colours.background },
  forgeMarkTypeBtn: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  forgeMarkTypeText: { color: colours.muted, fontSize: 10, fontWeight: '900' },
  forgeCpRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
  },
  forgeCpPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(103,232,249,0.25)',
    backgroundColor: 'rgba(103,232,249,0.06)',
  },
  forgeCpPillActive: { backgroundColor: colours.cyan, borderColor: colours.cyan },
  forgeCpPillText: { color: colours.muted, fontSize: 11, fontWeight: '900' },
  forgeCpPillTextActive: { color: colours.background },
  forgePanelHint: { color: colours.muted, fontSize: 11, fontStyle: 'italic' },
  overlayList: {
    gap: 6,
  },
  overlayRow: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.16)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  overlaySwatch: { width: 9, height: 26, borderRadius: 3 },
  overlayCopy: { flex: 1, minWidth: 0 },
  overlayTitle: { color: colours.text, fontSize: 11, fontWeight: '900' },
  overlayMeta: { color: colours.muted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  overlayIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,8,15,0.46)',
  },
  measurePanel: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.28)',
    backgroundColor: 'rgba(250,204,21,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  measurePanelItem: { flex: 1, alignItems: 'center' },
  measurePanelValue: { color: '#facc15', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  measurePanelLabel: { color: colours.muted, fontSize: 8, fontWeight: '900', marginTop: 2, textAlign: 'center' },
  opsSection: {
    gap: 5,
  },
  opsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  opsSectionTitle: { color: colours.text, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0 },
  opsSectionMeta: { color: colours.muted, fontSize: 9, fontWeight: '800', textAlign: 'right' },
  opsEmptyRow: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.10)',
    backgroundColor: 'rgba(255,255,255,0.025)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
  },
  opsEmptyText: { color: colours.muted, fontSize: 10, fontWeight: '800', flex: 1 },
  teamEventList: {
    gap: 6,
  },
  teamEventRow: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(103,232,249,0.14)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  teamEventDot: { width: 8, height: 8, borderRadius: 4 },
  teamEventTitle: { color: colours.text, fontSize: 10, fontWeight: '900' },
  teamEventDetail: { color: colours.muted, fontSize: 9, fontWeight: '800', marginTop: 1 },
  teamEventTime: { color: colours.muted, fontSize: 9, fontWeight: '900' },
  teamSharedList: {
    gap: 6,
  },
  teamSharedRow: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.18)',
    backgroundColor: 'rgba(250,204,21,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
  },
  teamSharedText: { color: colours.text, fontSize: 10, fontWeight: '900', flex: 1 },
  forgeNavRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: 4,
  },
  forgeNavItem: { flex: 1, alignItems: 'center' },
  forgeNavValue: { color: colours.text, fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
  forgeNavLabel: { color: colours.muted, fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  forgeTimerPill: {
    position: 'absolute', left: 10,
    backgroundColor: 'rgba(4,8,15,0.82)',
    borderWidth: 1, borderColor: 'rgba(103,232,249,0.28)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center', minWidth: 72,
  },
  forgeBottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 5, paddingBottom: 12, gap: 6,
  },
  forgeBottomBarAction: { alignItems: 'center', justifyContent: 'center' },
  forgeTabGroup: {
    flex: 1, flexDirection: 'row', justifyContent: 'space-around',
    borderLeftWidth: 1, borderLeftColor: 'rgba(103,232,249,0.12)',
  },
  forgeTab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 5, gap: 2,
  },
  forgeTabActive: { borderTopWidth: 2, borderTopColor: colours.cyan },
  forgeTabText: { color: colours.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  forgeTabTextActive: { color: colours.cyan, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  atakActionBtnSm: {
    minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderRadius: 8, paddingHorizontal: 10,
  },
  atakActionBtnTextSm: { color: colours.background, fontSize: 11, fontWeight: '900' },
  forgeColorDot: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  forgeColorDotActive: {
    borderColor: '#fff',
    transform: [{ scale: 1.25 }],
  },
});
