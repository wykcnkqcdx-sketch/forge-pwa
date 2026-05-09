import { TrainingSession, TrackPoint } from '../data/mockData';
import type { RuckCheckpoint } from '../data/domain';
import { distanceBetween } from './mapUtils';
import { evaluateRoutePoint } from './routeQuality';

export function formatElapsed(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function sessionTime(session: TrainingSession) {
  return session.completedAt ? new Date(session.completedAt).getTime() : Number(session.id) || 0;
}

export function formatSessionDate(session: TrainingSession) {
  if (!session.completedAt) return 'Date unknown';
  return new Date(session.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function estimateRuckSessionDistanceKm(session: TrainingSession) {
  if (session.routePoints && session.routePoints.length > 1) {
    return session.routePoints.slice(1).reduce((total, point, index) => (
      total + distanceBetween(session.routePoints![index], point)
    ), 0);
  }

  const titleMatch = session.title.match(/([\d.]+)\s*km/i);
  if (titleMatch) return Number(titleMatch[1]);
  return session.ruckMission?.targetDistanceKm ?? 0;
}

export function formatDuration(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs <= 0) return `${mins} min`;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

export function formatSignedMinutes(minutes: number) {
  const rounded = Math.round(minutes);
  if (rounded === 0) return 'On time';
  return `${Math.abs(rounded)} min ${rounded > 0 ? 'behind' : 'ahead'}`;
}

export function cardinalDirection(degrees: number) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(degrees / 45) % labels.length];
}

export function formatHeading(degrees: number) {
  return `${String(Math.round(degrees)).padStart(3, '0')}deg`;
}

export function headingDifferenceDegrees(current: number, target: number) {
  return ((target - current + 540) % 360) - 180;
}

export const CHECKPOINT_ARRIVAL_RADIUS_METERS = 50;
export const BEARING_CAUTION_DEGREES = 20;
export const BEARING_OFF_DEGREES = 45;

export type TrackingStatus = 'idle' | 'starting' | 'tracking' | 'paused';
export type FinishMode = 'target' | 'finalCheckpoint' | 'selectedCheckpoint';
export type RuckMissionMode = 'simple' | 'tactical' | 'navigation';

export type RuckTemplate = {
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

export const ruckTemplates: RuckTemplate[] = [
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

export const CUSTOM_RUCK_TEMPLATES_KEY = 'forge:ruck_templates';
export const RUCK_FIELD_STATE_KEY = 'forge:ruck_field_state';

export type TrackingState = {
  status: TrackingStatus;
  currentDistance: number;
  elapsedSeconds: number;
  routePoints: TrackPoint[];
  startTime: Date | null;
  rejectedPointCount: number;
  lastRejectedReason: string | null;
};

export type TrackingAction =
  | { type: 'start_requested' }
  | { type: 'start_succeeded'; firstPoint: TrackPoint }
  | { type: 'resume_requested' }
  | { type: 'resume_succeeded' }
  | { type: 'restore'; points: TrackPoint[]; currentDistance: number; elapsedSeconds: number; isTracking: boolean; rejectedPointCount: number; lastRejectedReason: string | null }
  | { type: 'point_recorded'; point: TrackPoint }
  | { type: 'stopped' }
  | { type: 'reset' };

export const initialTrackingState: TrackingState = {
  status: 'idle',
  currentDistance: 0,
  elapsedSeconds: 0,
  routePoints: [],
  startTime: null,
  rejectedPointCount: 0,
  lastRejectedReason: null,
};

export function trackingReducer(state: TrackingState, action: TrackingAction): TrackingState {
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
        elapsedSeconds: state.startTime && state.status === 'tracking' ? Math.max(0, Math.floor((Date.now() - state.startTime.getTime()) / 1000)) : state.elapsedSeconds,
      };

    case 'reset':
      return initialTrackingState;

    default:
      return state;
  }
}
