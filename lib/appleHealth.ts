import { Platform } from 'react-native';
import type { SquadMember } from '../data/mockData';

export type AppleHealthCapabilityStatus = 'native_build_required' | 'ios_only' | 'module_pending';

export type AppleHealthCapability = {
  status: AppleHealthCapabilityStatus;
  message: string;
};

export function getAppleHealthCapability(): AppleHealthCapability {
  if (Platform.OS === 'web') {
    return {
      status: 'native_build_required',
      message: 'Apple Health needs a native iPhone build. The web app can show status, but it cannot read HealthKit directly.',
    };
  }

  if (Platform.OS !== 'ios') {
    return {
      status: 'ios_only',
      message: 'Apple Health is only available on iPhone. Android devices should use Health Connect instead.',
    };
  }

  return {
    status: 'module_pending',
    message: 'This iPhone build is ready for a HealthKit adapter, but the native Apple Health module still needs to be installed and permissioned.',
  };
}

export function getAppleHealthPreview(member: SquadMember) {
  return {
    sleepHours: member.importedSleepHours,
    restingHR: member.importedRestingHR,
    hrv: member.importedHrv,
    lastSyncAt: member.deviceLastSyncAt,
  };
}
