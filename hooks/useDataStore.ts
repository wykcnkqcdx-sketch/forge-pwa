import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initialSessions, squadMembers, SquadMember, TrainingSession } from '../data/mockData';
import { migratePlaintextPin } from '../lib/pin';
import { isWeb } from '../lib/platform';

type ForgeBackup = {
  version: 1;
  exportedAt: string;
  sessions: TrainingSession[];
  members: SquadMember[];
};

const SESSION_TYPES: TrainingSession['type'][] = [
  'Ruck', 'Strength', 'Resistance', 'Cardio', 'Workout', 'Run', 'Mobility',
];

function validateSessions(value: unknown): TrainingSession[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.filter((item): item is TrainingSession => {
    if (!item || typeof item !== 'object') return false;
    const s = item as Record<string, unknown>;
    return (
      typeof s.id === 'string' &&
      typeof s.title === 'string' &&
      typeof s.score === 'number' &&
      typeof s.durationMinutes === 'number' &&
      typeof s.rpe === 'number' &&
      typeof s.type === 'string' &&
      SESSION_TYPES.includes(s.type as TrainingSession['type']) &&
      (s.completedAt === undefined || typeof s.completedAt === 'string')
    );
  });
  return valid.length === value.length ? valid : null;
}

function validateMembers(value: unknown): SquadMember[] | null {
  if (!Array.isArray(value)) return null;
  const valid = value.filter((item): item is SquadMember => {
    if (!item || typeof item !== 'object') return false;
    const m = item as Record<string, unknown>;
    return (
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      typeof m.groupId === 'string' &&
      typeof m.readiness === 'number' &&
      typeof m.compliance === 'number' &&
      typeof m.load === 'number' &&
      (m.risk === 'Low' || m.risk === 'Medium' || m.risk === 'High')
    );
  });
  return valid.length === value.length ? valid : null;
}

export function useDataStore() {
  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [members, setMembers] = useState<SquadMember[]>(squadMembers);
  const [savedPinEncoded, setSavedPinEncoded] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Load all persisted data in one pass so isReady only fires once everything is hydrated.
  useEffect(() => {
    async function load() {
      try {
        const [storedSessions, storedMembers, storedPin] = await Promise.all([
          AsyncStorage.getItem('forge:sessions'),
          AsyncStorage.getItem('forge:members'),
          AsyncStorage.getItem('forge:pin'),
        ]);
        if (storedSessions) setSessions(JSON.parse(storedSessions));
        if (storedMembers) setMembers(JSON.parse(storedMembers));
        if (storedPin) {
          const migrated = await migratePlaintextPin(storedPin);
          if (migrated) {
            if (migrated !== storedPin) await AsyncStorage.setItem('forge:pin', migrated);
            setSavedPinEncoded(migrated);
          }
        }
      } catch (error) {
        console.error('Failed to load local data', error);
      } finally {
        setIsReady(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (isReady) AsyncStorage.setItem('forge:sessions', JSON.stringify(sessions));
  }, [sessions, isReady]);

  useEffect(() => {
    if (isReady) AsyncStorage.setItem('forge:members', JSON.stringify(members));
  }, [members, isReady]);

  useEffect(() => {
    if (!isReady) return;
    if (savedPinEncoded === null) AsyncStorage.removeItem('forge:pin');
    else AsyncStorage.setItem('forge:pin', savedPinEncoded);
  }, [savedPinEncoded, isReady]);

  const addSession = useCallback((session: TrainingSession) => {
    setSessions((prev) => [session, ...prev]);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const editSession = useCallback((id: string, updates: Partial<TrainingSession>) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  }, []);

  const addMember = useCallback((member: SquadMember) => {
    setMembers((prev) => [member, ...prev]);
  }, []);

  const updateMember = useCallback((id: string, updates: Partial<SquadMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }, []);

  const wipeData = useCallback(() => {
    setSessions([]);
    setMembers([]);
    AsyncStorage.multiRemove(['forge:sessions', 'forge:members']);
  }, []);

  // Called by useCloudSync when hydrating from the remote snapshot.
  const applyCloudSnapshot = useCallback((s: TrainingSession[], m: SquadMember[]) => {
    if (s.length > 0) setSessions(s);
    if (m.length > 0) setMembers(m);
  }, []);

  function exportData() {
    if (!isWeb) {
      Alert.alert('Export unavailable', 'Data export is available in the web app.');
      return;
    }
    const backup: ForgeBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions,
      members,
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
    if (!isWeb) {
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
          const importedSessions = validateSessions(Array.isArray(parsed) ? parsed : parsed.sessions);
          const importedMembers =
            !Array.isArray(parsed) && parsed.members ? validateMembers(parsed.members) : null;
          if (!importedSessions) {
            Alert.alert('Import failed', 'That file does not look like a valid FORGE backup.');
            return;
          }
          setSessions(importedSessions);
          if (importedMembers) setMembers(importedMembers);
          Alert.alert(
            'Import complete',
            `${importedSessions.length} sessions restored${importedMembers ? ` and ${importedMembers.length} members restored` : ''}.`
          );
        } catch (error) {
          console.error('Failed to import backup', error);
          Alert.alert('Import failed', 'The selected backup file could not be read.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  return {
    sessions,
    members,
    savedPinEncoded,
    setSavedPinEncoded,
    isReady,
    addSession,
    deleteSession,
    editSession,
    addMember,
    updateMember,
    wipeData,
    applyCloudSnapshot,
    exportData,
    importData,
  };
}
