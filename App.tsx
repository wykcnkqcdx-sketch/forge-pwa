import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from './screens/HomeScreen';
import { ReadinessScreen } from './screens/ReadinessScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { RuckScreen } from './screens/RuckScreen';
import { TrainScreen } from './screens/TrainScreen';
import { FuelScreen } from './screens/FuelScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
import type { ProgrammeTemplate, SquadMember, TrainingGroup, TrainingSession } from './data/mockData';
import { initialSessions, programmeTemplates as initialProgrammeTemplates, squadMembers, trainingGroups } from './data/mockData';
import type { ReadinessLog, WorkoutCompletion } from './data/domain';
import { clearActiveRoute } from './lib/ruckRouteStore';
import { secureDestroyLocalData } from './lib/secureStorage';
import { isSupabaseConfigured } from './lib/supabase';
import { colours, shadow, touchTarget } from './theme';
import { useToast } from './hooks/useToast';
import { useLocalStore } from './hooks/useLocalStore';
import { useCloudSync } from './hooks/useCloudSync';
import { usePinLock } from './hooks/usePinLock';

type Tab = 'home' | 'train' | 'ruck' | 'fuel' | 'analytics' | 'settings' | 'readiness';
type MemberTab = 'portal' | 'train' | 'ruck' | 'fuel' | 'readiness';

type PendingMemberInvite = {
  id: string;
  name: string;
  gymName: string;
  email?: string;
  groupId: string;
};

type ForgeBackup = {
  version: 1;
  exportedAt: string;
  sessions: TrainingSession[];
  members: SquadMember[];
  groups?: TrainingGroup[];
  programmeTemplates?: ProgrammeTemplate[];
  readinessLogs?: ReadinessLog[];
  workoutCompletions?: WorkoutCompletion[];
  googleSheetsEndpoint?: string;
};

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

export default function App() {
  // ── Core hooks ────────────────────────────────────────────────────────────
  const { showToast, toastMessage, toastAnim } = useToast();

  const store = useLocalStore();
  const { sessions, members, groups, programmeTemplates, readinessLogs, workoutCompletions, googleSheetsEndpoint, isReady, hasSeenOnboarding } = store;

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const cloud = useCloudSync({
    sessions, members, workoutCompletions, readinessLogs,
    setSessions: store.setSessions,
    setMembers: store.setMembers,
    setWorkoutCompletions: store.setWorkoutCompletions,
    setReadinessLogs: store.setReadinessLogs,
    setPendingSyncCount,
    showToast,
    isReady,
    googleSheetsEndpoint,
  });

  const pin = usePinLock({
    savedPin: store.savedPin,
    setSavedPin: store.setSavedPin,
    isReady,
    onWipe: async () => {
      store.setSessions([]);
      store.setMembers([]);
      store.setGroups([]);
      store.setProgrammeTemplates([]);
      store.setReadinessLogs([]);
      store.setWorkoutCompletions([]);
      store.setGoogleSheetsEndpoint('');
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
    store.setMembers((current) => [
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
  }, [activeMemberId, isReady, members, pendingMemberInvite, store]);

  // ── CRUD actions ──────────────────────────────────────────────────────────
  const { enqueueCloudMutation } = cloud;

  function addSession(session: TrainingSession) {
    const updated = { ...session, updatedAt: new Date().toISOString() };
    store.setSessions((curr) => [updated, ...curr]);
    enqueueCloudMutation({ type: 'upsert_session', payload: updated });
  }

  function deleteSession(id: string) {
    store.setSessions((curr) => curr.filter((s) => s.id !== id));
    enqueueCloudMutation({ type: 'delete_session', payload: { id } });
  }

  function editSession(id: string, updates: Partial<TrainingSession>) {
    const stamped = { ...updates, updatedAt: new Date().toISOString() };
    store.setSessions((curr) => curr.map((s) => (s.id === id ? { ...s, ...stamped } : s)));
    enqueueCloudMutation({ type: 'update_session', payload: { id, updates: stamped } });
  }

  function addMember(member: SquadMember) {
    const updated = { ...member, updatedAt: new Date().toISOString() };
    store.setMembers((curr) => [updated, ...curr]);
    enqueueCloudMutation({ type: 'upsert_member', payload: updated });
  }

  function deleteMember(id: string) {
    store.setMembers((curr) => curr.filter((m) => m.id !== id));
    enqueueCloudMutation({ type: 'delete_member', payload: { id } });
  }

  function updateMember(id: string, updates: Partial<SquadMember>) {
    const stamped = { ...updates, updatedAt: new Date().toISOString() };
    store.setMembers((curr) => curr.map((m) => (m.id === id ? { ...m, ...stamped } : m)));
    enqueueCloudMutation({ type: 'update_member', payload: { id, updates: stamped } });
  }

  function addGroup(group: TrainingGroup) {
    store.setGroups((curr) => [...curr, group]);
  }

  function addProgrammeTemplate(template: ProgrammeTemplate) {
    store.setProgrammeTemplates((curr) => [template, ...curr.filter((t) => t.id !== template.id)]);
  }

  function deleteProgrammeTemplate(id: string) {
    store.setProgrammeTemplates((curr) => curr.filter((t) => t.id !== id));
  }

  function addReadinessLog(log: ReadinessLog) {
    const updated = { ...log, updatedAt: new Date().toISOString() };
    store.setReadinessLogs((curr) => [updated, ...curr]);
    enqueueCloudMutation({ type: 'upsert_readiness_log', payload: updated });
  }

  function completeOnboarding(mode: 'fresh' | 'demo') {
    if (mode === 'fresh') {
      store.setSessions([]);
      store.setMembers([]);
      store.setGroups(trainingGroups);
      store.setProgrammeTemplates(initialProgrammeTemplates);
      store.setReadinessLogs([]);
      store.setWorkoutCompletions([]);
    } else {
      store.setSessions(initialSessions);
      store.setMembers(squadMembers);
      store.setGroups(trainingGroups);
      store.setProgrammeTemplates(initialProgrammeTemplates);
      store.setReadinessLogs([]);
      store.setWorkoutCompletions([]);
    }
    store.setHasSeenOnboarding(true);
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
          store.setSessions(imported);
          if (importedMembers) store.setMembers(importedMembers);
          if (!Array.isArray(parsed) && Array.isArray(parsed.groups)) store.setGroups(parsed.groups);
          if (!Array.isArray(parsed) && Array.isArray(parsed.programmeTemplates)) store.setProgrammeTemplates(parsed.programmeTemplates);
          if (parsed.readinessLogs) store.setReadinessLogs(parsed.readinessLogs);
          if (parsed.workoutCompletions) store.setWorkoutCompletions(parsed.workoutCompletions);
          if (!Array.isArray(parsed) && typeof parsed.googleSheetsEndpoint === 'string') store.setGoogleSheetsEndpoint(parsed.googleSheetsEndpoint);
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

  // ── Tab navigation ────────────────────────────────────────────────────────
  function switchTab(newTab: Tab) {
    if (activeTab !== newTab) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setActiveTab(newTab);
    }
  }

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
          if (g.dx < 0 && idx < tabs.length - 1) switchTab(tabs[idx + 1].id);
          else if (g.dx > 0 && idx > 0) switchTab(tabs[idx - 1].id);
        }
      },
    }),
    [activeTab, pin.resetInactivityTimer]
  );

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderToast() {
    if (!toastMessage) return null;
    return (
      <Animated.View
        pointerEvents="none"
        style={[styles.toast, shadow.card, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}
      >
        <View style={styles.toastIcon}>
          <Ionicons name="cloud-done" size={18} color={colours.background} />
        </View>
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>
    );
  }

  function renderScreen() {
    switch (activeTab) {
      case 'train': return <TrainScreen addSession={addSession} sessions={sessions} />;
      case 'ruck':  return <RuckScreen addSession={addSession} sessions={sessions} />;
      case 'fuel':  return <FuelScreen sessions={sessions} readinessLogs={readinessLogs} />;
      case 'analytics':
        return (
          <AnalyticsScreen
            sessions={sessions}
            readinessLogs={readinessLogs}
            addReadinessLog={addReadinessLog}
            deleteSession={deleteSession}
            editSession={editSession}
          />
        );
      case 'readiness':
        return (
          <ReadinessScreen
            member={COACH_SELF}
            readinessLogs={readinessLogs}
            onSubmitReadiness={addReadinessLog}
            onCompleteCheckIn={() => switchTab('home')}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            pinEnabled={Boolean(store.savedPin)}
            sessions={sessions}
            members={members}
            groups={groups}
            programmeTemplates={programmeTemplates}
            readinessLogs={readinessLogs}
            workoutCompletions={workoutCompletions}
            onSetPin={pin.handleSetPin}
            onWipe={pin.handleManualWipe}
            onExport={exportData}
            onImport={importData}
            onAddMember={addMember}
            onDeleteMember={deleteMember}
            onUpdateMember={updateMember}
            onAddGroup={addGroup}
            onAddProgrammeTemplate={addProgrammeTemplate}
            onDeleteProgrammeTemplate={deleteProgrammeTemplate}
            cloudEnabled={isSupabaseConfigured}
            cloudStatus={cloud.cloudStatus}
            cloudEmail={cloud.cloudSession?.user.email ?? null}
            pendingSyncCount={pendingSyncCount}
            onCloudSync={cloud.syncCloudNow}
            onCloudSignOut={cloud.signOutCloud}
            googleSheetsEndpoint={googleSheetsEndpoint}
            onChangeGoogleSheetsEndpoint={store.setGoogleSheetsEndpoint}
            onExportGoogleSheets={() => cloud.exportGoogleSheetsNow(members, groups, programmeTemplates)}
            googleSheetsExporting={cloud.googleSheetsExporting}
            googleSheetsMessage={cloud.googleSheetsMessage}
          />
        );
      default:
        return (
          <HomeScreen
            sessions={sessions}
            goToRuck={() => switchTab('ruck')}
            goToAnalytics={() => switchTab('analytics')}
            goToFuel={() => switchTab('fuel')}
            goToTrain={() => switchTab('train')}
            goToReadiness={() => switchTab('readiness')}
            readinessLogs={readinessLogs}
            workoutCompletions={workoutCompletions}
          />
        );
    }
  }

  function renderMemberScreen(activeMember: SquadMember | null) {
    const memberSessions = sessions.filter((s) => !activeMember || !s.id.startsWith('member-') || s.id.includes(activeMember.id));
    const visibleSessions = memberSessions.length ? memberSessions : sessions;

    switch (activeMemberTab) {
      case 'train': return <TrainScreen addSession={addSession} sessions={visibleSessions} />;
      case 'ruck':  return <RuckScreen addSession={addSession} sessions={visibleSessions} />;
      case 'fuel':  return <FuelScreen sessions={visibleSessions} readinessLogs={readinessLogs} />;
      case 'readiness':
        return (
          <ReadinessScreen
            member={activeMember ?? members[0]}
            readinessLogs={readinessLogs}
            onSubmitReadiness={addReadinessLog}
            onUpdateMember={updateMember}
            onCompleteCheckIn={() => setActiveMemberTab('train')}
          />
        );
      default:
        return (
          <HomeScreen
            member={activeMember}
            sessions={visibleSessions}
            goToRuck={() => setActiveMemberTab('ruck')}
            goToAnalytics={() => setActiveMemberTab('train')}
            goToFuel={() => setActiveMemberTab('fuel')}
            goToTrain={() => setActiveMemberTab('train')}
            goToReadiness={() => setActiveMemberTab('readiness')}
            readinessLogs={readinessLogs}
            workoutCompletions={workoutCompletions}
            secondaryActionLabel="Training"
          />
        );
    }
  }

  // ── Render gates ──────────────────────────────────────────────────────────
  if (!isReady || !cloud.authReady) {
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Animated.Text style={[styles.brand, { opacity: pulseAnim, transform: [{ scale: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.95, 1.05] }) }] }]}>
            // FORGE
          </Animated.Text>
          <Text style={[styles.lockSub, { marginTop: 12 }]}>{typedText || '_'}</Text>
        </View>
      </View>
    );
  }

  if (!hasSeenOnboarding) {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  if (isSupabaseConfigured && !cloud.cloudSession) {
    return <AuthScreen loading={cloud.authLoading} error={cloud.authError} onSignIn={cloud.signInWithEmail} onSignUp={cloud.signUpWithEmail} />;
  }

  if (store.savedPin && !pin.isUnlocked) {
    const pinLength = Math.max(4, store.savedPin.length);
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Text style={styles.brand}>// FORGE</Text>
          <Text style={styles.lockSub}>Enter PIN to access tactical dashboard.</Text>
          <View style={styles.pinWrapper}>
            <View style={styles.pinDisplay}>
              {Array.from({ length: pinLength }, (_, i) => (
                <View key={i} style={[styles.pinBox, pin.pinInput.length > i && styles.pinBoxFilled]}>
                  <Text style={styles.pinDot}>{pin.pinInput.length > i ? '•' : ''}</Text>
                </View>
              ))}
            </View>
            <TextInput
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={pinLength}
              value={pin.pinInput}
              onChangeText={pin.handlePinInput}
              autoFocus
            />
          </View>
          <Text style={styles.pinErrorText}>{pin.pinError ? 'Incorrect PIN' : ' '}</Text>
        </View>
      </View>
    );
  }

  if (activeMemberId) {
    const activeMember = members.find((m) => m.id === activeMemberId) ?? null;
    return (
      <View style={styles.app}>
        <View style={styles.screenContainer}>{renderMemberScreen(activeMember)}</View>
        {renderToast()}
        <View style={[styles.tabBar, shadow.card]}>
          <View style={styles.tabBarHighlight} />
          {memberTabs.map((tab) => {
            const isActive = tab.id === activeMemberTab;
            return (
              <Pressable key={tab.id} style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]} onPress={() => setActiveMemberTab(tab.id)} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: isActive }}>
                {isActive ? (
                  <View style={styles.activePill}>
                    <Ionicons name={tab.iconActive} size={18} color={colours.background} />
                    <Text style={styles.activePillLabel}>{tab.label}</Text>
                  </View>
                ) : (
                  <View style={styles.inactiveItem}>
                    <Ionicons name={tab.icon} size={20} color={colours.muted} />
                    <Text style={styles.inactiveLabel}>{tab.label}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.app} {...panResponder.panHandlers}>
      <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {renderScreen()}
      </Animated.View>

      {renderToast()}

      {pin.pinSetupMode && (
        <View style={styles.pinSetupOverlay}>
          <View style={[styles.pinSetupPanel, shadow.card]}>
            <View style={styles.pinSetupHeader}>
              <View>
                <Text style={styles.pinSetupKicker}>APP LOCK</Text>
                <Text style={styles.pinSetupTitle}>{pin.pinSetupMode === 'set' ? 'Set PIN' : 'Change PIN'}</Text>
              </View>
              <Pressable style={styles.pinSetupClose} onPress={pin.closePinSetup} accessibilityRole="button" accessibilityLabel="Close PIN setup">
                <Ionicons name="close" size={20} color={colours.text} />
              </Pressable>
            </View>
            <Text style={styles.pinSetupCopy}>Use 4 to 8 digits. Entering 0000 at lock screen still performs duress wipe.</Text>
            <TextInput
              style={styles.pinSetupInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="New PIN"
              placeholderTextColor={colours.soft}
              value={pin.newPinInput}
              onChangeText={(v) => { pin.setNewPinInput(v.replace(/[^0-9]/g, '')); }}
            />
            <TextInput
              style={styles.pinSetupInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="Confirm PIN"
              placeholderTextColor={colours.soft}
              value={pin.confirmPinInput}
              onChangeText={(v) => { pin.setConfirmPinInput(v.replace(/[^0-9]/g, '')); }}
            />
            <Text style={styles.pinSetupError}>{pin.pinSetupError || ' '}</Text>
            <Pressable style={styles.pinSetupButton} onPress={pin.savePinSetup}>
              <Text style={styles.pinSetupButtonText}>Save PIN</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={[styles.tabBar, shadow.card]}>
        <View style={styles.tabBarHighlight} />
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable key={tab.id} style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]} onPress={() => switchTab(tab.id)} accessibilityRole="button" accessibilityLabel={tab.label} accessibilityState={{ selected: isActive }}>
              {isActive ? (
                <View style={styles.activePill}>
                  <Ionicons name={tab.iconActive} size={18} color={colours.background} />
                  <Text style={styles.activePillLabel}>{tab.label}</Text>
                </View>
              ) : (
                <View style={styles.inactiveItem}>
                  <Ionicons name={tab.icon} size={20} color={colours.muted} />
                  <Text style={styles.inactiveLabel}>{tab.label}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colours.background },
  screenContainer: { flex: 1 },
  toast: {
    position: 'absolute', left: 20, right: 20, bottom: 96, zIndex: 30,
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: colours.borderHot, borderRadius: 18,
    backgroundColor: 'rgba(27, 31, 26, 0.98)',
  },
  toastIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colours.cyan },
  toastText: { flex: 1, color: colours.text, fontSize: 13, fontWeight: '900' },
  tabBar: {
    position: Platform.OS === 'web' ? 'fixed' as 'absolute' : 'absolute',
    left: 10,
    right: 10,
    bottom: 14,
    zIndex: 40,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 7,
    borderRadius: 24, borderWidth: 1, borderColor: colours.border,
    backgroundColor: 'rgba(4, 8, 15, 0.94)', overflow: 'hidden',
  },
  tabBarHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colours.borderGlass },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: touchTarget, borderRadius: 20 },
  tabItemPressed: { opacity: 0.70 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colours.cyan, borderRadius: 18, paddingHorizontal: 7, paddingVertical: 7, ...shadow.cyan },
  activePillLabel: { color: colours.background, fontSize: 9, fontWeight: '900', letterSpacing: 0.2 },
  inactiveItem: { alignItems: 'center', gap: 3 },
  inactiveLabel: { color: colours.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0 },
  lockScreen: { flex: 1, backgroundColor: colours.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  lockContent: { alignItems: 'center', width: '100%', maxWidth: 320 },
  brand: { color: colours.cyan, fontSize: 24, fontWeight: '900', letterSpacing: 4, marginBottom: 8 },
  lockSub: { color: colours.muted, fontSize: 14, textAlign: 'center', marginBottom: 32 },
  pinWrapper: { position: 'relative', width: 240, height: 64, marginBottom: 16 },
  pinDisplay: { flexDirection: 'row', justifyContent: 'space-between', height: '100%' },
  pinBox: { width: 50, height: 64, borderWidth: 2, borderColor: colours.border, borderRadius: 12, backgroundColor: 'rgba(2, 5, 8, 0.58)', alignItems: 'center', justifyContent: 'center' },
  pinBoxFilled: { borderColor: colours.cyan },
  pinDot: { color: colours.cyan, fontSize: 32 },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  pinErrorText: { color: colours.red, fontSize: 12, fontWeight: '700', minHeight: 16 },
  pinSetupOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.62)' },
  pinSetupPanel: { borderWidth: 1, borderColor: colours.border, borderRadius: 20, padding: 18, backgroundColor: colours.surface },
  pinSetupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  pinSetupKicker: { color: colours.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  pinSetupTitle: { color: colours.text, fontSize: 24, fontWeight: '900', marginTop: 3 },
  pinSetupClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  pinSetupCopy: { color: colours.muted, fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 14 },
  pinSetupInput: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 14, color: colours.text, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 16, fontWeight: '800' },
  pinSetupError: { minHeight: 18, color: colours.red, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  pinSetupButton: { alignItems: 'center', backgroundColor: colours.cyan, borderRadius: 16, paddingVertical: 13 },
  pinSetupButtonText: { color: colours.background, fontSize: 15, fontWeight: '900' },
});
