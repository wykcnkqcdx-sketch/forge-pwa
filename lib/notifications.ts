import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleReadinessReminder(hour = 7, minute = 0): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelReadinessReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: 'forge-readiness-daily',
    content: {
      title: '// FORGE — Morning Check-in',
      body: 'Log your readiness before you train today.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelReadinessReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('forge-readiness-daily').catch(() => {});
}

export async function scheduleSessionReminder(hour = 18, minute = 0): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelSessionReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: 'forge-session-daily',
    content: {
      title: '// FORGE — Training Time',
      body: 'Your session is scheduled. Get after it.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelSessionReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('forge-session-daily').catch(() => {});
}

export async function sendImmediateNotification(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}
