import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouter } from './AppRouter';
import * as AppProviders from './AppProviders';

vi.mock('./AppProviders', () => ({
  useApp: vi.fn(),
}));
vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../screens/HomeScreen', () => ({ HomeScreen: () => <span>HomeScreen</span> }));
vi.mock('../screens/ReadinessScreen', () => ({ ReadinessScreen: () => <span>ReadinessScreen</span> }));
vi.mock('../screens/AnalyticsScreen', () => ({ AnalyticsScreen: () => <span>AnalyticsScreen</span> }));
vi.mock('../screens/RuckScreen', () => ({ RuckScreen: () => <span>RuckScreen</span> }));
vi.mock('../screens/TrainScreen', () => ({ TrainScreen: () => <span>TrainScreen</span> }));
vi.mock('../screens/FuelScreen', () => ({ FuelScreen: () => <span>FuelScreen</span> }));
vi.mock('../screens/SettingsScreen', () => ({ SettingsScreen: () => <span>SettingsScreen</span> }));
vi.mock('../screens/OnboardingScreen', () => ({ OnboardingScreen: () => <span>OnboardingScreen</span> }));
vi.mock('../screens/AuthScreen', () => ({ AuthScreen: () => <span>AuthScreen</span> }));
vi.mock('./SplashScreen', () => ({ SplashScreen: () => <span>SplashScreen</span> }));
vi.mock('./PinScreen', () => ({ PinScreen: () => <span>PinScreen</span> }));
vi.mock('./PinSetupModal', () => ({ PinSetupModal: () => <span>PinSetupModal</span> }));
vi.mock('./Toast', () => ({ Toast: () => <span>Toast</span> }));
vi.mock('./TabBar', () => ({ TabBar: () => <span>TabBar</span> }));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light' }
}));
vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false
}));

const mockUseApp = {
  sessions: [], members: [], groups: [], programmeTemplates: [], readinessLogs: [], workoutCompletions: [],
  googleSheetsEndpoint: '', isReady: true, hasSeenOnboarding: true, savedPin: null,
  store: {},
  navigation: { activeTab: 'home', activeMemberId: null, activeMemberTab: 'portal', setActiveTab: vi.fn(), setActiveMemberId: vi.fn(), setActiveMemberTab: vi.fn() },
  actions: { addSession: vi.fn(), deleteSession: vi.fn(), editSession: vi.fn(), addMember: vi.fn(), deleteMember: vi.fn(), updateMember: vi.fn(), addGroup: vi.fn(), addProgrammeTemplate: vi.fn(), deleteProgrammeTemplate: vi.fn(), addReadinessLog: vi.fn(), completeOnboarding: vi.fn(), exportData: vi.fn(), importData: vi.fn() },
  pendingSyncCount: 0,
  toast: { toastMessage: '', toastAnim: { interpolate: vi.fn() } },
  cloud: { authReady: true, cloudStatus: 'local', authLoading: false, authError: '', signInWithEmail: vi.fn(), signUpWithEmail: vi.fn(), cloudSession: null, syncCloudNow: vi.fn(), signOutCloud: vi.fn(), exportGoogleSheetsNow: vi.fn(), googleSheetsExporting: false, googleSheetsMessage: '' },
  pin: { isUnlocked: true, pinInput: '', pinError: false, handlePinInput: vi.fn(), pinSetupMode: null, newPinInput: '', confirmPinInput: '', pinSetupError: '', setNewPinInput: vi.fn(), setConfirmPinInput: vi.fn(), savePinSetup: vi.fn(), closePinSetup: vi.fn(), handleSetPin: vi.fn(), handleManualWipe: vi.fn(), resetInactivityTimer: vi.fn() },
  slideAnim: { interpolate: vi.fn() }, fadeAnim: { interpolate: vi.fn() }, pulseAnim: { interpolate: vi.fn() }, typedText: '',
  tabs: [{ id: 'home', label: 'Home', icon: 'home', iconActive: 'home' }],
  memberTabs: [], COACH_SELF: { id: 'coach' },
  panResponder: { panHandlers: {} }
};

describe('AppRouter', () => {
  beforeEach(() => {
    vi.spyOn(AppProviders, 'useApp').mockReturnValue(mockUseApp as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders SplashScreen when app is not ready', () => {
    vi.spyOn(AppProviders, 'useApp').mockReturnValue({ ...mockUseApp, isReady: false } as any);
    const { getByText } = render(<AppRouter />);
    expect(getByText('SplashScreen')).toBeTruthy();
  });

  it('renders OnboardingScreen when hasSeenOnboarding is false', () => {
    vi.spyOn(AppProviders, 'useApp').mockReturnValue({ ...mockUseApp, hasSeenOnboarding: false } as any);
    const { getByText } = render(<AppRouter />);
    expect(getByText('OnboardingScreen')).toBeTruthy();
  });

  it('renders HomeScreen by default when ready and onboarded', () => {
    const { getByText } = render(<AppRouter />);
    expect(getByText('HomeScreen')).toBeTruthy();
    expect(getByText('TabBar')).toBeTruthy();
  });

  it('renders PinScreen when savedPin exists and is not unlocked', () => {
    vi.spyOn(AppProviders, 'useApp').mockReturnValue({ ...mockUseApp, savedPin: '1234', pin: { ...mockUseApp.pin, isUnlocked: false } } as any);
    const { getByText } = render(<AppRouter />);
    expect(getByText('PinScreen')).toBeTruthy();
  });
});
