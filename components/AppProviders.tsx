import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { Alert, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PanResponder, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProgrammeTemplate, SquadMember, TrainingGroup, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';
import { initialSessions, programmeTemplates as initialProgrammeTemplates, squadMembers, trainingGroups } from '../data/mockData';
import { clearActiveRoute } from '../lib/ruckRouteStore';
import { secureDestroyLocalData } from '../lib/secureStorage';
import { colours } from '../theme';
import { useToast } from '../hooks/useToast';
import { useLocalStore } from '../hooks/useLocalStore';
import { useCloudSync } from '../hooks/useCloudSync';
import { usePinLock } from '../hooks/usePinLock';
import type { AppNavigation, AppActions, Tab, MemberTab, PendingMemberInvite, ForgeBackup } from '../types/app';

const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
  { id: 'home',       label: 'Home',    icon: 'home-outline',       iconActive: 'home' },
  { id: 'train',      label: 'Train',   icon: 'barbell-outline',    iconActive: 'barbell' },
  { id: 'ruck',       label: 'Ruck',    icon: 'footsteps-outline',  iconActive: 'footsteps' },
  { id: 'fuel',       label: 'Fuel',    icon: 'restaurant-outline', iconActive: 'restaurant' },
  { id: 'analytics',  label: 'Intel',   icon: 'analytics-outline',  iconActive: 'analytics' },
  { id: 'settings', label: 'Ops', icon: 'settings-outline', iconActive: 'settings' },
];

const memberTabs: Array<{ id: MemberTab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
  { id: 'portal',    label: 'Today', icon: 'flash-outline',      iconActive: 'flash' },
  { id: 'train',     label: 'Train', icon: 'barbell-outline',    iconActive: 'barbell' },
  { id: 'ruck',      label: 'Ruck',  icon: 'footsteps-outline',  iconActive: 'footsteps' },
  { id: 'fuel',      label: 'Fuel',  icon: 'restaurant-outline', iconActive: 'restaurant' },
  { id: 'readiness', label: 'Ready', icon: 'body-outline',       iconActive: 'body' },
];

const COACH_SELF: SquadMember = {
  id: 'coach-self', name: 'Coach', groupId: 'self',
  readiness: 80, compliance: 100, risk: 'Low', load: 0,
};

type AppContextType = {
  // Store data
  sessions: TrainingSession[];
  members: SquadMember[];
  groups: TrainingGroup[];
  programmeTemplates: ProgrammeTemplate[];
  readinessLogs: ReadinessLog[];
  workoutCompletions: WorkoutCompletion[];
  googleSheetsEndpoint: string;
  isReady: boolean;
  hasSeenOnboarding: boolean;
  savedPin: string | null;

  // Store setters
  store: ReturnType<typeof useLocalStore>;

  // Navigation
  navigation: AppNavigation;

  // Actions
  actions: AppActions;

  // UI state
  pendingSyncCount: number;
  pendingMemberInvite: PendingMemberInvite | null;
  setPendingMemberInvite: (invite: PendingMemberInvite | null) => void;

  // Hooks
  toast: ReturnType<typeof useToast>;
  cloud: ReturnType<typeof useCloudSync>;
  pin: ReturnType<typeof usePinLock>;

  // Animations
  slideAnim: Animated.Value;
  fadeAnim: Animated.Value;
  pulseAnim: Animated.Value;
  typedText: string;

  // Constants
  tabs: typeof tabs;
  memberTabs: typeof memberTabs;
  COACH_SELF: SquadMember;

  // Pan responder
  panResponder: ReturnType<typeof PanResponder.create>;
};

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProviders');
  }
  return context;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  // ── Core hooks ────────────────────────────────────────────────────────────
  const { showToast, toastMessage, toastAnim } = useToast();

  const store = useLocalStore();
  const {
    sessions, members, groups, programmeTemplates, readinessLogs, workoutCompletions,
    googleSheetsEndpoint, isReady, hasSeenOnboarding, savedPin,
    setSessions, setMembers, setGroups, setProgrammeTemplates, setReadinessLogs, setWorkoutCompletions,
    setGoogleSheetsEndpoint, setHasSeenOnboarding
  } = store;

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const cloud = useCloudSync({
    sessions, members, workoutCompletions, readinessLogs,
    setSessions, setMembers, setWorkoutCompletions, setReadinessLogs,
    setPendingSyncCount, showToast, isReady, googleSheetsEndpoint,
  });

  const pin = usePinLock({
    savedPin, setSavedPin: store.setSavedPin, isReady,
    onWipe: async () => {
      setSessions([]);
      setMembers([]);
      setGroups([]);
      setProgrammeTemplates([]);
      setReadinessLogs([]);
      setWorkoutCompletions([]);
      setGoogleSheetsEndpoint('');
      store.setSavedPin(null);
      await Promise.all([
        cloud.resetCloudForWipe(),
        secureDestroyLocalData(['forge:sessions', 'forge:members', 'forge:groups', 'forge:programme_templates', 'forge:readiness_logs', 'forge:workout_completions', 'forge:google_sheets_endpoint', 'forge:pin']),
        clearActiveRoute(),
      ]).catch((error) => console.error('Failed to clear local app data', error));
      setPendingSyncCount(0);
      if (typeof window !== 'undefined') window.alert('OPSEC WIPE\n\nAll local data has been permanently destroyed.');
      else Alert.alert('OPSEC WIPE', 'All local data has been permanently destroyed.');
    },
  });

  // ── Navigation state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [activeMemberTab, setActiveMemberTab] = useState<MemberTab>('portal');
  const [pendingMemberInvite, setPendingMemberInvite] = useState<PendingMemberInvite | null>(null);

  // ── Splash animation ──────────────────────────────────────────────────────
  const [typedText, setTypedText] = useState('');
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isReady) return;
    let i = 0;
    const text = 'INITIALISING SYSTEMS...';
    const timer = setInterval(() => {
      i++;
      if (i >= text.length) { setTypedText(text); clearInterval(timer); }
      else setTypedText(text.substring(0, i) + '_');
    }, 40);
    return () => clearInterval(timer);
  }, [isReady]);

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
    ])).start();
  }, [pulseAnim]);

  // ── Tab slide animation ───────────────────────────────────────────────────
  const prevTabIndex = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const prevIndex = prevTabIndex.current;
    if (currentIndex !== prevIndex) {
      const direction = currentIndex > prevIndex ? 1 : -1;
      slideAnim.setValue(direction * 40);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      prevTabIndex.current = currentIndex;
    }
  }, [activeTab, slideAnim, fadeAnim]);

  // ── URL invite params ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const memberId = url.searchParams.get('member');
    if (memberId) {
      setActiveMemberId(memberId);
      const inviteName = url.searchParams.get('name');
      const inviteGymName = url.searchParams.get('gym');
      const inviteEmail = url.searchParams.get('email') ?? undefined;
      const inviteGroupId = url.searchParams.get('group') ?? trainingGroups[0]?.id ?? 'alpha';
      if (inviteName || inviteGymName) {
        setPendingMemberInvite({
          id: memberId,
          name: inviteName || inviteGymName || 'Invited Member',
          gymName: inviteGymName || inviteName || 'Athlete',
          email: inviteEmail,
          groupId: inviteGroupId,
        });
      }
    }

    const manifestHref = new URL('manifest.webmanifest', window.location.href).toString();
    const existingManifest = document.querySelector('link[rel="manifest"]');
    const manifestLink = existingManifest ?? document.createElement('link');
    manifestLink.setAttribute('rel', 'manifest');
    manifestLink.setAttribute('href', manifestHref);
    if (!existingManifest) document.head.appendChild(manifestLink);

    const themeMeta = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color');
    themeMeta.setAttribute('content', colours.background);
    if (!themeMeta.parentElement) document.head.appendChild(themeMeta);

    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]') ?? document.createElement('meta');
    appleMeta.setAttribute('name', 'apple-mobile-web-app-capable');
    appleMeta.setAttribute('content', 'yes');
    if (!appleMeta.parentElement) document.head.appendChild(appleMeta);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(new URL('sw.js', window.location.href).toString()).catch((error) => {
        console.warn('Service worker registration failed', error);
      });
    }
  }, []);

  // Add invited member once store is ready
  useEffect(() => {
    if (!isReady || !activeMemberId || !pendingMemberInvite) return;
    if (members.some((member) => member.id === activeMemberId)) return;
    setMembers((current) => [
      {
        id: pendingMemberInvite.id,
        groupId: pendingMemberInvite.groupId,
        name: pendingMemberInvite.name,
        gymName: pendingMemberInvite.gymName,
        email: pendingMemberInvite.email,
        readiness: 72, compliance: 80, risk: 'Low', load: 65,
        inviteStatus: 'Joined', assignment: 'Strength Training',
        pinnedExerciseIds: ['trap-bar-deadlift', 'pull-up'],
        ghostMode: false, streakDays: 0, weeklyVolume: 0, hypeCount: 0,
      },
      ...current,
    ]);
  }, [activeMemberId, isReady, members, pendingMemberInvite, setMembers]);

  // ── CRUD actions ──────────────────────────────────────────────────────────
  const { enqueueCloudMutation } = cloud;

  function addSession(session: TrainingSession) {
    const updated = { ...session, updatedAt: new Date().toISOString() };
    setSessions((curr) => [updated, ...curr]);
    enqueueCloudMutation({ type: 'upsert_session', payload: updated });
  }

  function deleteSession(id: string) {
    setSessions((curr) => curr.filter((s) => s.id !== id));
    enqueueCloudMutation({ type: 'delete_session', payload: { id } });
  }

  function editSession(id: string, updates: Partial<TrainingSession>) {
    const stamped = { ...updates, updatedAt: new Date().toISOString() };
    setSessions((curr) => curr.map((s) => (s.id === id ? { ...s, ...stamped } : s)));
    enqueueCloudMutation({ type: 'update_session', payload: { id, updates: stamped } });
  }

  function addMember(member: SquadMember) {
    const updated = { ...member, updatedAt: new Date().toISOString() };
    setMembers((curr) => [updated, ...curr]);
    enqueueCloudMutation({ type: 'upsert_member', payload: updated });
  }

  function deleteMember(id: string) {
    setMembers((curr) => curr.filter((m) => m.id !== id));
    enqueueCloudMutation({ type: 'delete_member', payload: { id } });
  }

  function updateMember(id: string, updates: Partial<SquadMember>) {
    const stamped = { ...updates, updatedAt: new Date().toISOString() };
    setMembers((curr) => curr.map((m) => (m.id === id ? { ...m, ...stamped } : m)));
    enqueueCloudMutation({ type: 'update_member', payload: { id, updates: stamped } });
  }

  function addGroup(group: TrainingGroup) {
    setGroups((curr) => [...curr, group]);
  }

  function addProgrammeTemplate(template: ProgrammeTemplate) {
    setProgrammeTemplates((curr) => [template, ...curr.filter((t) => t.id !== template.id)]);
  }

  function deleteProgrammeTemplate(id: string) {
    setProgrammeTemplates((curr) => curr.filter((t) => t.id !== id));
  }

  function addReadinessLog(log: ReadinessLog) {
    const updated = { ...log, updatedAt: new Date().toISOString() };
    setReadinessLogs((curr) => [updated, ...curr]);
    enqueueCloudMutation({ type: 'upsert_readiness_log', payload: updated });
  }

  function completeOnboarding(mode: 'fresh' | 'demo') {
    if (mode === 'fresh') {
      setSessions([]);
      setMembers([]);
      setGroups(trainingGroups);
      setProgrammeTemplates(initialProgrammeTemplates);
      setReadinessLogs([]);
      setWorkoutCompletions([]);
    } else {
      setSessions(initialSessions);
      setMembers(squadMembers);
      setGroups(trainingGroups);
      setProgrammeTemplates(initialProgrammeTemplates);
      setReadinessLogs([]);
      setWorkoutCompletions([]);
    }
    setHasSeenOnboarding(true);
  }

  // ── Import / Export ───────────────────────────────────────────────────────
  function validateImportedSessions(value: unknown): TrainingSession[] | null {
    if (!Array.isArray(value)) return null;
    const validTypes: TrainingSession['type'][] = ['Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Run', 'Mobility'];
    const imported = value.filter((s): s is TrainingSession => {
      if (!s || typeof s !== 'object') return false;
      const c = s as Partial<TrainingSession>;
      return typeof c.id === 'string' && typeof c.title === 'string' && typeof c.score === 'number'
        && typeof c.durationMinutes === 'number' && typeof c.rpe === 'number'
        && typeof c.type === 'string' && validTypes.includes(c.type as TrainingSession['type'])
        && (c.completedAt === undefined || typeof c.completedAt === 'string');
    });
    return imported.length === value.length ? imported : null;
  }

  function validateImportedMembers(value: unknown): SquadMember[] | null {
    if (!Array.isArray(value)) return null;
    const imported = value.filter((m): m is SquadMember => {
      if (!m || typeof m !== 'object') return false;
      const c = m as Partial<SquadMember>;
      return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.groupId === 'string'
        && typeof c.readiness === 'number' && typeof c.compliance === 'number'
        && typeof c.load === 'number' && (c.risk === 'Low' || c.risk === 'Medium' || c.risk === 'High');
    });
    return imported.length === value.length ? imported : null;
  }

  function exportData() {
    if (typeof document === 'undefined') { Alert.alert('Export unavailable', 'Data export is available in the web app.'); return; }
    const backup: ForgeBackup = { version: 1, exportedAt: new Date().toISOString(), sessions, members, groups, programmeTemplates, readinessLogs, workoutCompletions, googleSheetsEndpoint };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importData() {
    if (typeof document === 'undefined') { Alert.alert('Import unavailable', 'Data import is available in the web app.'); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const imported = validateImportedSessions(Array.isArray(parsed) ? parsed : parsed.sessions);
          const importedMembers = !Array.isArray(parsed) && parsed.members ? validateImportedMembers(parsed.members) : null;
          if (!imported) { Alert.alert('Import failed', 'That file does not look like a valid FORGE backup.'); return; }
          setSessions(imported);
          if (importedMembers) setMembers(importedMembers);
          if (!Array.isArray(parsed) && Array.isArray(parsed.groups)) setGroups(parsed.groups);
          if (!Array.isArray(parsed) && Array.isArray(parsed.programmeTemplates)) setProgrammeTemplates(parsed.programmeTemplates);
          if (parsed.readinessLogs) setReadinessLogs(parsed.readinessLogs);
          if (parsed.workoutCompletions) setWorkoutCompletions(parsed.workoutCompletions);
          if (!Array.isArray(parsed) && typeof parsed.googleSheetsEndpoint === 'string') setGoogleSheetsEndpoint(parsed.googleSheetsEndpoint);
          Alert.alert('Import complete', `${imported.length} sessions restored${importedMembers ? ` and ${importedMembers.length} members restored` : ''}.`);
        } catch (error) {
          console.error('Failed to import backup', error);
          Alert.alert('Import failed', 'The selected backup file could not be read.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigation: AppNavigation = {
    activeTab,
    activeMemberId,
    activeMemberTab,
    setActiveTab,
    setActiveMemberId,
    setActiveMemberTab,
  };

  const actions: AppActions = {
    addSession,
    deleteSession,
    editSession,
    addMember,
    deleteMember,
    updateMember,
    addGroup,
    addProgrammeTemplate,
    deleteProgrammeTemplate,
    addReadinessLog,
    completeOnboarding,
    exportData,
    importData,
  };

  // ── Pan responder ─────────────────────────────────────────────────────────
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponderCapture: () => { pin.resetInactivityTimer(); return false; },
      onMoveShouldSetPanResponderCapture: (_, g) => {
        pin.resetInactivityTimer();
        return Math.abs(g.dx) > Math.abs(g.dy) * 2 && Math.abs(g.dx) > 30;
      },
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) > 60) {
          const idx = tabs.findIndex((t) => t.id === activeTab);
          if (g.dx < 0 && idx < tabs.length - 1) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab(tabs[idx + 1].id);
          }
          else if (g.dx > 0 && idx > 0) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab(tabs[idx - 1].id);
          }
        }
      },
    }),
    [activeTab, pin.resetInactivityTimer, setActiveTab]
  );

  const contextValue: AppContextType = {
    // Store data
    sessions, members, groups, programmeTemplates, readinessLogs, workoutCompletions,
    googleSheetsEndpoint, isReady, hasSeenOnboarding, savedPin,

    // Store setters
    store,

    // Navigation
    navigation,

    // Actions
    actions,

    // UI state
    pendingSyncCount,
    pendingMemberInvite,
    setPendingMemberInvite,

    // Hooks
    toast: { showToast, toastMessage, toastAnim },
    cloud,
    pin,

    // Animations
    slideAnim,
    fadeAnim,
    pulseAnim,
    typedText,

    // Constants
    tabs,
    memberTabs,
    COACH_SELF,

    // Pan responder
    panResponder,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}