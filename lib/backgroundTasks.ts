import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { DeviceEventEmitter, Platform } from 'react-native';
import { appendActiveRoutePoints } from './ruckRouteStore';
import type { TrackPoint } from '../data/domain';

export const LOCATION_TASK_NAME = 'background-location-task';
const supportsBackgroundLocation = Platform.OS !== 'web';

function toTrackPoint(location: Location.LocationObject): TrackPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
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
        const newPoints = locations.map(toTrackPoint);
        await appendActiveRoutePoints(newPoints);
      } catch (e) {
        console.error('Failed to save background locations', e);
      }

      // Emit to UI if the app is currently in the foreground
      DeviceEventEmitter.emit('onLocationUpdate', locations);
    }
  });
}