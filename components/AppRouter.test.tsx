import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AppRouter } from './AppRouter';
import * as AppProviders from './AppProviders';

jest.mock('./AppProviders');
jest.mock('../screens/HomeScreen', () => ({ HomeScreen: () => <Text>HomeScreen</Text> }));
jest.mock('../screens/ReadinessScreen', () => ({ ReadinessScreen: () => <Text>ReadinessScreen</Text> }));
jest.mock('../screens/AnalyticsScreen', () => ({ AnalyticsScreen: () => <Text>AnalyticsScreen</Text> }));
jest.mock('../screens/RuckScreen', () => ({ RuckScreen: () => <Text>RuckScreen</Text> }));
jest.mock('../screens/TrainScreen', () => ({ TrainScreen: () => <Text>TrainScreen</Text> }));
jest.mock('../screens/FuelScreen', () => ({ FuelScreen: () => <Text>FuelScreen</Text> }));
jest.mock('../screens/SettingsScreen', () => ({ SettingsScreen: () => <Text>SettingsScreen</Text> }));
jest.mock('../screens/OnboardingScreen', () => ({ OnboardingScreen: () => <Text>OnboardingScreen</Text> }));
jest.mock('../screens/AuthScreen', () => ({ AuthScreen: () => <Text>AuthScreen</Text> }));
jest.mock('./SplashScreen', () => ({ SplashScreen: () => <Text>SplashScreen</Text> }));
jest.mock('./PinScreen', () => ({ PinScreen: () => <Text>PinScreen</Text> }));
jest.mock('./PinSetupModal', () => ({ PinSetupModal: () => <Text>PinSetupModal</Text> }));
jest.mock('./Toast', () => ({ Toast: () => <Text>Toast</Text> }));
jest.mock('./TabBar', () => ({ TabBar: () => <Text>TabBar</Text> }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' }
}));
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false
}));

const mockUseApp = {
  sessions: [], members: [], groups: [], programmeTemplates: [], readinessLogs: [], workoutCompletions: [],
  googleSheetsEndpoint: '', isReady: true, hasSeenOnboarding: true, savedPin: null,
  store: {},
  navigation: { activeTab: 'home', activeMemberId: null, activeMemberTab: 'portal', setActiveTab: jest.fn(), setActiveMemberId: jest.fn(), setActiveMemberTab: jest.fn() },
  actions: { addSession: jest.fn(), deleteSession: jest.fn(), editSession: jest.fn(), addMember: jest.fn(), deleteMember: jest.fn(), updateMember: jest.fn(), addGroup: jest.fn(), addProgrammeTemplate: jest.fn(), deleteProgrammeTemplate: jest.fn(), addReadinessLog: jest.fn(), completeOnboarding: jest.fn(), exportData: jest.fn(), importData: jest.fn() },
  pendingSyncCount: 0,
  toast: { toastMessage: '', toastAnim: { interpolate: jest.fn() } },
  cloud: { authReady: true, cloudStatus: 'local', authLoading: false, authError: '', signInWithEmail: jest.fn(), signUpWithEmail: jest.fn(), cloudSession: null, syncCloudNow: jest.fn(), signOutCloud: jest.fn(), exportGoogleSheetsNow: jest.fn(), googleSheetsExporting: false, googleSheetsMessage: '' },
  pin: { isUnlocked: true, pinInput: '', pinError: false, handlePinInput: jest.fn(), pinSetupMode: null, newPinInput: '', confirmPinInput: '', pinSetupError: '', setNewPinInput: jest.fn(), setConfirmPinInput: jest.fn(), savePinSetup: jest.fn(), closePinSetup: jest.fn(), handleSetPin: jest.fn(), handleManualWipe: jest.fn(), resetInactivityTimer: jest.fn() },
  slideAnim: { interpolate: jest.fn() }, fadeAnim: { interpolate: jest.fn() }, pulseAnim: { interpolate: jest.fn() }, typedText: '',
  tabs: [{ id: 'home', label: 'Home', icon: 'home', iconActive: 'home' }],
  memberTabs: [], COACH_SELF: { id: 'coach' },
  panResponder: { panHandlers: {} }
};

describe('AppRouter', () => {
  beforeEach(() => {
    jest.spyOn(AppProviders, 'useApp').mockReturnValue(mockUseApp as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders SplashScreen when app is not ready', () => {
    jest.spyOn(AppProviders, 'useApp').mockReturnValue({ ...mockUseApp, isReady: false } as any);
    const { getByText } = render(<AppRouter />);
    expect(getByText('SplashScreen')).toBeTruthy();
  });

  it('renders OnboardingScreen when hasSeenOnboarding is false', () => {
    jest.spyOn(AppProviders, 'useApp').mockReturnValue({ ...mockUseApp, hasSeenOnboarding: false } as any);
    const { getByText } = render(<AppRouter />);
    expect(getByText('OnboardingScreen')).toBeTruthy();
  });

  it('renders HomeScreen by default when ready and onboarded', () => {
    const { getByText } = render(<AppRouter />);
    expect(getByText('HomeScreen')).toBeTruthy();
    expect(getByText('TabBar')).toBeTruthy();
  });

  it('renders PinScreen when savedPin exists and is not unlocked', () => {
    jest.spyOn(AppProviders, 'useApp').mockReturnValue({ ...mockUseApp, savedPin: '1234', pin: { ...mockUseApp.pin, isUnlocked: false } } as any);
    const { getByText } = render(<AppRouter />);
    expect(getByText('PinScreen')).toBeTruthy();
  });
});