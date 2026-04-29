import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { HomeScreen } from './screens/HomeScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { RuckScreen } from './screens/RuckScreen';
import { TrainScreen } from './screens/TrainScreen';
import { FuelScreen } from './screens/FuelScreen';
import { InstructorScreen } from './screens/InstructorScreen';
import { AuthScreen } from './screens/AuthScreen';
import { initialSessions, squadMembers, SquadMember, TrainingSession } from './data/mockData';
import type { ReadinessLog } from './data/domain';
import { fetchCloudSnapshot, pushCloudSnapshot } from './lib/cloud';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { colours, shadow } from './theme';

type Tab = 'home' | 'train' | 'ruck' | 'fuel' | 'analytics' | 'instructor';
type PinSetupMode = 'set' | 'change' | null;

type ForgeBackup = {
  version: 1;
  exportedAt: string;
  sessions: TrainingSession[];
  members: SquadMember[];
  readinessLogs?: ReadinessLog[];
};

const tabs: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }> = [
  { id: 'home',       label: 'Home',    icon: 'home-outline',      iconActive: 'home' },
  { id: 'train',      label: 'Train',   icon: 'barbell-outline',   iconActive: 'barbell' },
  { id: 'ruck',       label: 'Ruck',    icon: 'footsteps-outline', iconActive: 'footsteps' },
  { id: 'fuel',       label: 'Fuel',    icon: 'restaurant-outline', iconActive: 'restaurant' },
  { id: 'analytics',  label: 'Intel',   icon: 'analytics-outline', iconActive: 'analytics' },
  { id: 'instructor', label: 'Coach',   icon: 'people-outline',    iconActive: 'people' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [members, setMembers] = useState<SquadMember[]>(squadMembers);
  const [readinessLogs, setReadinessLogs] = useState<ReadinessLog[]>([]);
  const [cloudSession, setCloudSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'local' | 'auth' | 'syncing' | 'synced' | 'error'>(
    isSupabaseConfigured ? 'auth' : 'local'
  );
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinSetupMode, setPinSetupMode] = useState<PinSetupMode>(null);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinSetupError, setPinSetupError] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [typedText, setTypedText] = useState('');
  const prevTabIndex = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudHydrated = useRef(false);
  const skipNextRemotePush = useRef(false);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (savedPin && isUnlocked) {
      inactivityTimer.current = setTimeout(() => {
        setIsUnlocked(false);
      }, 3 * 60 * 1000); // 3 minutes
    }
  }, [savedPin, isUnlocked]);

  useEffect(() => {
    if (isReady) return;
    let i = 0;
    const text = 'INITIALISING SYSTEMS...';
    const timer = setInterval(() => {
      i++;
      if (i >= text.length) {
        setTypedText(text);
        clearInterval(timer);
      } else {
        setTypedText(text.substring(0, i) + '_');
      }
    }, 40);
    return () => clearInterval(timer);
  }, [isReady]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
      const serviceWorkerUrl = new URL('sw.js', window.location.href).toString();
      navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
        console.warn('Service worker registration failed', error);
      });
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('Failed to restore auth session', error);
        setAuthError(error.message);
      }
      setCloudSession(data.session ?? null);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudSession(session ?? null);
      setAuthReady(true);
      setAuthError('');
      setCloudStatus(session ? 'syncing' : 'auth');
      cloudHydrated.current = false;
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [resetInactivityTimer]);

  useEffect(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const prevIndex = prevTabIndex.current;

    if (currentIndex !== prevIndex) {
      const direction = currentIndex > prevIndex ? 1 : -1;
      slideAnim.setValue(direction * 40);
      fadeAnim.setValue(0);

      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      prevTabIndex.current = currentIndex;
    }
  }, [activeTab, slideAnim, fadeAnim]);

  useEffect(() => {
    async function loadData() {
      try {
        const storedSessions = await AsyncStorage.getItem('forge:sessions');
        if (storedSessions) setSessions(JSON.parse(storedSessions));

        const storedMembers = await AsyncStorage.getItem('forge:members');
        if (storedMembers) setMembers(JSON.parse(storedMembers));
        
        const storedPin = await AsyncStorage.getItem('forge:pin');
        if (storedPin) setSavedPin(storedPin);
      } catch (error) {
        console.error('Failed to load local data', error);
      } finally {
        setIsReady(true);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (isReady) AsyncStorage.setItem('forge:sessions', JSON.stringify(sessions));
  }, [sessions, isReady]);

  useEffect(() => {
    if (isReady) AsyncStorage.setItem('forge:members', JSON.stringify(members));
  }, [members, isReady]);

  useEffect(() => {
    if (isReady) AsyncStorage.setItem('forge:readiness_logs', JSON.stringify(readinessLogs));
  }, [readinessLogs, isReady]);

  useEffect(() => {
    if (isReady) {
      if (savedPin === null) AsyncStorage.removeItem('forge:pin');
      else AsyncStorage.setItem('forge:pin', savedPin);
    }
  }, [savedPin, isReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || !cloudSession?.user || !isReady) return;

    let cancelled = false;
    const userId = cloudSession.user.id;
    async function hydrateCloud() {
      try {
        setCloudStatus('syncing');
        const snapshot = await fetchCloudSnapshot(userId);
        if (cancelled) return;

        if (snapshot.sessions.length > 0 || snapshot.members.length > 0) {
          skipNextRemotePush.current = true;
          if (snapshot.sessions.length > 0) setSessions(snapshot.sessions);
          if (snapshot.members.length > 0) setMembers(snapshot.members);
        } else {
          await pushCloudSnapshot(userId, sessions, members);
        }

        if (!cancelled) {
          cloudHydrated.current = true;
          setCloudStatus('synced');
        }
      } catch (error) {
        console.error('Failed to hydrate cloud data', error);
        if (!cancelled) {
          cloudHydrated.current = true;
          setCloudStatus('error');
        }
      }
    }

    hydrateCloud();
    return () => {
      cancelled = true;
    };
  }, [cloudSession?.user?.id, isReady]);

  useEffect(() => {
    if (!isSupabaseConfigured || !cloudSession?.user || !isReady || !cloudHydrated.current) return;
    const userId = cloudSession.user.id;

    if (skipNextRemotePush.current) {
      skipNextRemotePush.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCloudStatus('syncing');
        await pushCloudSnapshot(userId, sessions, members);
        setCloudStatus('synced');
      } catch (error) {
        console.error('Failed to sync cloud data', error);
        setCloudStatus('error');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [sessions, members, cloudSession?.user?.id, isReady]);

  function executeDuressWipe() {
    setSessions([]);
    setMembers([]);
    setSavedPin(null);
    setIsUnlocked(true);
    setPinInput('');
    AsyncStorage.multiRemove(['forge:sessions', 'forge:members', 'forge:pin']);
    Alert.alert('OPSEC WIPE', 'All local data has been permanently destroyed.');
  }

  function openPinSetup() {
    setNewPinInput('');
    setConfirmPinInput('');
    setPinSetupError('');
    setPinSetupMode(savedPin ? 'change' : 'set');
  }

  function closePinSetup() {
    setPinSetupMode(null);
    setNewPinInput('');
    setConfirmPinInput('');
    setPinSetupError('');
  }

  function savePinSetup() {
    if (!/^\d{4,8}$/.test(newPinInput)) {
      setPinSetupError('PIN must be 4 to 8 digits.');
      return;
    }

    if (newPinInput === '0000') {
      setPinSetupError('0000 is reserved for duress wipe.');
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinSetupError('PIN entries do not match.');
      return;
    }

    setSavedPin(newPinInput);
    setIsUnlocked(false);
    closePinSetup();
    Alert.alert('PIN saved', 'Your app lock PIN has been updated.');
  }

  function handleSetPin() {
    if (savedPin) {
      Alert.alert('PIN options', 'Change or remove the current app lock PIN.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', onPress: openPinSetup },
        { text: 'Remove', style: 'destructive', onPress: () => { setSavedPin(null); setIsUnlocked(true); } },
      ]);
    } else {
      openPinSetup();
    }
  }

  function handleManualWipe() {
    Alert.alert('OPSEC WIPE', 'Permanently delete all local data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'WIPE', style: 'destructive', onPress: executeDuressWipe },
    ]);
  }

  function switchTab(newTab: Tab) {
    if (activeTab !== newTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActiveTab(newTab);
    }
  }

  function addSession(session: TrainingSession) {
    setSessions((current) => [session, ...current]);
  }

  function deleteSession(id: string) {
    setSessions((current) => current.filter((s) => s.id !== id));
  }

  function editSession(id: string, updates: Partial<TrainingSession>) {
    setSessions((current) =>
      current.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }

  function addMember(member: SquadMember) {
    setMembers((current) => [member, ...current]);
  }

  function updateMember(id: string, updates: Partial<SquadMember>) {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, ...updates } : member)));
  }

  function addReadinessLog(log: ReadinessLog) {
    setReadinessLogs((current) => [log, ...current]);
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) return;
    if (!email || !password) {
      setAuthError('Email and password are required.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }

  async function signUpWithEmail(email: string, password: string) {
    if (!supabase) return;
    if (!email || !password) {
      setAuthError('Email and password are required.');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError('Account created. Check your email if confirmation is enabled, then sign in.');
    }
    setAuthLoading(false);
  }

  async function signOutCloud() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCloudSession(null);
    setCloudStatus('auth');
  }

  function validateImportedSessions(value: unknown): TrainingSession[] | null {
    if (!Array.isArray(value)) return null;

    const validTypes: TrainingSession['type'][] = ['Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Run', 'Mobility'];
    const imported = value.filter((session): session is TrainingSession => {
      if (!session || typeof session !== 'object') return false;
      const candidate = session as Partial<TrainingSession>;
      return (
        typeof candidate.id === 'string'
        && typeof candidate.title === 'string'
        && typeof candidate.score === 'number'
        && typeof candidate.durationMinutes === 'number'
                && typeof candidate.rpe === 'number'
                && typeof candidate.type === 'string'
                && validTypes.includes(candidate.type as TrainingSession['type'])
                && (candidate.completedAt === undefined || typeof candidate.completedAt === 'string')
      );
    });

    return imported.length === value.length ? imported : null;
  }

  function validateImportedMembers(value: unknown): SquadMember[] | null {
    if (!Array.isArray(value)) return null;

    const imported = value.filter((member): member is SquadMember => {
      if (!member || typeof member !== 'object') return false;
      const candidate = member as Partial<SquadMember>;
      return (
        typeof candidate.id === 'string'
        && typeof candidate.name === 'string'
        && typeof candidate.groupId === 'string'
        && typeof candidate.readiness === 'number'
        && typeof candidate.compliance === 'number'
        && typeof candidate.load === 'number'
        && (candidate.risk === 'Low' || candidate.risk === 'Medium' || candidate.risk === 'High')
      );
    });

    return imported.length === value.length ? imported : null;
  }

  function exportData() {
    if (typeof document === 'undefined') {
      Alert.alert('Export unavailable', 'Data export is available in the web app.');
      return;
    }

    const backup: ForgeBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions,
      members,
      readinessLogs,
    };
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
    if (typeof document === 'undefined') {
      Alert.alert('Import unavailable', 'Data import is available in the web app.');
      return;
    }

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
          const importedMembers = !Array.isArray(parsed) && parsed.members
            ? validateImportedMembers(parsed.members)
            : null;

          if (!imported) {
            Alert.alert('Import failed', 'That file does not look like a valid FORGE backup.');
            return;
          }

          setSessions(imported);
          if (importedMembers) setMembers(importedMembers);
          if (parsed.readinessLogs) setReadinessLogs(parsed.readinessLogs);
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

  const panResponder = useMemo(
    () =>
      PanResponder.create({
          onStartShouldSetPanResponderCapture: () => {
            resetInactivityTimer();
            return false; // Return false so we don't block child touch events
          },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
            resetInactivityTimer();
          // Capture the touch if it's a clear horizontal swipe
          return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2 && Math.abs(gestureState.dx) > 30;
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dx } = gestureState;
          if (Math.abs(dx) > 60) {
            const currentIndex = tabs.findIndex((t) => t.id === activeTab);
            if (dx < 0 && currentIndex < tabs.length - 1) {
              switchTab(tabs[currentIndex + 1].id); // Swipe Left -> Next Tab
            } else if (dx > 0 && currentIndex > 0) {
              switchTab(tabs[currentIndex - 1].id); // Swipe Right -> Previous Tab
            }
          }
        },
      }),
      [activeTab, resetInactivityTimer]
  );

  function renderScreen() {
    switch (activeTab) {
      case 'train':
        return <TrainScreen addSession={addSession} sessions={sessions} />;
      case 'ruck':
        return <RuckScreen addSession={addSession} />;
      case 'fuel':
        return <FuelScreen sessions={sessions} />;
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
      case 'instructor':
        return (
          <InstructorScreen
            pinEnabled={Boolean(savedPin)}
            sessions={sessions}
            members={members}
            onSetPin={handleSetPin}
            onWipe={handleManualWipe}
            onExport={exportData}
            onImport={importData}
            onAddMember={addMember}
            onUpdateMember={updateMember}
            cloudEnabled={isSupabaseConfigured}
            cloudStatus={cloudStatus}
            cloudEmail={cloudSession?.user.email ?? null}
            onCloudSignOut={signOutCloud}
          />
        );
      default:
        return (
          <HomeScreen
            sessions={sessions}
            goToRuck={() => switchTab('ruck')}
            goToAnalytics={() => switchTab('analytics')}
            deleteSession={deleteSession}
            editSession={editSession}
          />
        );
    }
  }

  if (!isReady || !authReady) {
    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Animated.Text
            style={[
              styles.brand,
              {
                opacity: pulseAnim,
                transform: [
                  {
                    scale: pulseAnim.interpolate({ inputRange: [0.3, 1], outputRange: [0.95, 1.05] }),
                  },
                ],
              },
            ]}
          >
            // FORGE
          </Animated.Text>
          <Text style={[styles.lockSub, { marginTop: 12 }]}>{typedText || '_'}</Text>
        </View>
      </View>
    );
  }

  if (isSupabaseConfigured && !cloudSession) {
    return <AuthScreen loading={authLoading} error={authError} onSignIn={signInWithEmail} onSignUp={signUpWithEmail} />;
  }

  if (savedPin && !isUnlocked) {
    const pinLength = Math.max(4, savedPin.length);

    return (
      <View style={styles.lockScreen}>
        <View style={styles.lockContent}>
          <Text style={styles.brand}>// FORGE</Text>
          <Text style={styles.lockSub}>Enter PIN to access tactical dashboard.</Text>
          <View style={styles.pinWrapper}>
            <View style={styles.pinDisplay}>
              {Array.from({ length: pinLength }, (_, i) => (
                <View key={i} style={[styles.pinBox, pinInput.length > i && styles.pinBoxFilled]}>
                  <Text style={styles.pinDot}>{pinInput.length > i ? '•' : ''}</Text>
                </View>
              ))}
            </View>
            <TextInput
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={pinLength}
              value={pinInput}
              onChangeText={(val) => {
                const numericVal = val.replace(/[^0-9]/g, '');
                setPinInput(numericVal);
                setPinError(false);
                if (numericVal === '0000') {
                  executeDuressWipe();
                } else if (numericVal.length === savedPin.length) {
                  if (numericVal === savedPin) { setIsUnlocked(true); setPinInput(''); }
                  else { setPinError(true); setTimeout(() => setPinInput(''), 300); }
                }
              }}
              autoFocus
            />
          </View>
          <Text style={styles.pinErrorText}>{pinError ? 'Incorrect PIN' : ' '}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.app} {...panResponder.panHandlers}>
      <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        {renderScreen()}
      </Animated.View>

      {pinSetupMode && (
        <View style={styles.pinSetupOverlay}>
          <View style={[styles.pinSetupPanel, shadow.card]}>
            <View style={styles.pinSetupHeader}>
              <View>
                <Text style={styles.pinSetupKicker}>APP LOCK</Text>
                <Text style={styles.pinSetupTitle}>{pinSetupMode === 'set' ? 'Set PIN' : 'Change PIN'}</Text>
              </View>
              <Pressable style={styles.pinSetupClose} onPress={closePinSetup} accessibilityRole="button" accessibilityLabel="Close PIN setup">
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
              value={newPinInput}
              onChangeText={(value) => {
                setNewPinInput(value.replace(/[^0-9]/g, ''));
                setPinSetupError('');
              }}
            />
            <TextInput
              style={styles.pinSetupInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
              placeholder="Confirm PIN"
              placeholderTextColor={colours.soft}
              value={confirmPinInput}
              onChangeText={(value) => {
                setConfirmPinInput(value.replace(/[^0-9]/g, ''));
                setPinSetupError('');
              }}
            />

            <Text style={styles.pinSetupError}>{pinSetupError || ' '}</Text>

            <Pressable style={styles.pinSetupButton} onPress={savePinSetup}>
              <Text style={styles.pinSetupButtonText}>Save PIN</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Tab Bar ─────────────────────────────────── */}
      <View style={[styles.tabBar, shadow.card]}>
        {/* Glass top highlight */}
        <View style={styles.tabBarHighlight} />

        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
              onPress={() => switchTab(tab.id)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              {isActive ? (
                /* Active pill */
                <View style={styles.activePill}>
                  <Ionicons name={tab.iconActive} size={18} color={colours.background} />
                  <Text style={styles.activePillLabel}>{tab.label}</Text>
                </View>
              ) : (
                /* Inactive icon + label */
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
  app: {
    flex: 1,
    backgroundColor: colours.background,
  },

  screenContainer: {
    flex: 1,
  },

  /* Tab bar shell */
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colours.border,
    backgroundColor: 'rgba(4, 8, 15, 0.94)',
    overflow: 'hidden',
  },

  tabBarHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colours.borderGlass,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 20,
  },

  tabItemPressed: {
    opacity: 0.70,
  },

  /* Active state — filled pill */
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colours.cyan,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 7,
    ...shadow.cyan,
  },

  activePillLabel: {
    color: colours.background,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  /* Inactive state */
  inactiveItem: {
    alignItems: 'center',
    gap: 3,
  },

  inactiveLabel: {
    color: colours.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Lock Screen */
  lockScreen: { flex: 1, backgroundColor: colours.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  lockContent: { alignItems: 'center', width: '100%', maxWidth: 320 },
  brand: { color: colours.cyan, fontSize: 24, fontWeight: '900', letterSpacing: 4, marginBottom: 8 },
  lockSub: { color: colours.muted, fontSize: 14, textAlign: 'center', marginBottom: 32 },
  pinWrapper: { position: 'relative', width: 240, height: 64, marginBottom: 16 },
  pinDisplay: { flexDirection: 'row', justifyContent: 'space-between', height: '100%' },
  pinBox: {
    width: 50,
    height: 64,
    borderWidth: 2,
    borderColor: colours.border,
    borderRadius: 12,
    backgroundColor: 'rgba(2, 5, 8, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxFilled: { borderColor: colours.cyan },
  pinDot: { color: colours.cyan, fontSize: 32 },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  pinErrorText: { color: colours.red, fontSize: 12, fontWeight: '700', minHeight: 16 },
  pinSetupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  pinSetupPanel: {
    borderWidth: 1,
    borderColor: colours.border,
    borderRadius: 20,
    padding: 18,
    backgroundColor: colours.surface,
  },
  pinSetupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  pinSetupKicker: {
    color: colours.cyan,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  pinSetupTitle: {
    color: colours.text,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },
  pinSetupClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  pinSetupCopy: {
    color: colours.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 14,
  },
  pinSetupInput: {
    borderWidth: 1,
    borderColor: colours.borderSoft,
    borderRadius: 14,
    color: colours.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '800',
  },
  pinSetupError: {
    minHeight: 18,
    color: colours.red,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  pinSetupButton: {
    alignItems: 'center',
    backgroundColor: colours.cyan,
    borderRadius: 16,
    paddingVertical: 13,
  },
  pinSetupButtonText: {
    color: colours.background,
    fontSize: 15,
    fontWeight: '900',
  },
});
