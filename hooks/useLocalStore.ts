import { useEffect, useState } from 'react';
import { initialSessions, programmeTemplates as initialProgrammeTemplates, squadMembers, trainingGroups } from '../data/mockData';
import type { ProgrammeTemplate, SquadMember, TrainingGroup, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';
import { secureGetItem, secureRemoveItem, secureSetItem } from '../lib/secureStorage';

function safeJsonParse<T>(json: string, key: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    console.error(`Corrupted stored data for "${key}", falling back to defaults`);
    return null;
  }
}

export function useLocalStore() {
  const [isReady, setIsReady] = useState(false);
  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [members, setMembers] = useState<SquadMember[]>(squadMembers);
  const [groups, setGroups] = useState<TrainingGroup[]>(trainingGroups);
  const [programmeTemplates, setProgrammeTemplates] = useState<ProgrammeTemplate[]>(initialProgrammeTemplates);
  const [readinessLogs, setReadinessLogs] = useState<ReadinessLog[]>([]);
  const [workoutCompletions, setWorkoutCompletions] = useState<WorkoutCompletion[]>([]);
  const [googleSheetsEndpoint, setGoogleSheetsEndpoint] = useState('');
  const [savedPin, setSavedPin] = useState<string | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const storedSessions = await secureGetItem('forge:sessions');
        const parsedSessions = storedSessions ? safeJsonParse<TrainingSession[]>(storedSessions, 'forge:sessions') : null;
        if (parsedSessions) setSessions(parsedSessions);

        const storedMembers = await secureGetItem('forge:members');
        const parsedMembers = storedMembers ? safeJsonParse<SquadMember[]>(storedMembers, 'forge:members') : null;
        if (parsedMembers) setMembers(parsedMembers);

        const storedGroups = await secureGetItem('forge:groups');
        const parsedGroups = storedGroups ? safeJsonParse<TrainingGroup[]>(storedGroups, 'forge:groups') : null;
        if (parsedGroups) setGroups(parsedGroups);

        const storedTemplates = await secureGetItem('forge:programme_templates');
        const parsedTemplates = storedTemplates ? safeJsonParse<ProgrammeTemplate[]>(storedTemplates, 'forge:programme_templates') : null;
        if (parsedTemplates) setProgrammeTemplates(parsedTemplates);

        const storedReadiness = await secureGetItem('forge:readiness_logs');
        const parsedReadiness = storedReadiness ? safeJsonParse<ReadinessLog[]>(storedReadiness, 'forge:readiness_logs') : null;
        if (parsedReadiness) setReadinessLogs(parsedReadiness);

        const storedCompletions = await secureGetItem('forge:workout_completions');
        const parsedCompletions = storedCompletions ? safeJsonParse<WorkoutCompletion[]>(storedCompletions, 'forge:workout_completions') : null;
        if (parsedCompletions) setWorkoutCompletions(parsedCompletions);

        const storedEndpoint = await secureGetItem('forge:google_sheets_endpoint');
        if (storedEndpoint) setGoogleSheetsEndpoint(storedEndpoint);

        const storedPin = await secureGetItem('forge:pin');
        if (storedPin) setSavedPin(storedPin);

        const storedOnboarding = await secureGetItem('forge:has_seen_onboarding');
        if (storedOnboarding === 'true') setHasSeenOnboarding(true);
      } catch (error) {
        console.error('Failed to load local data', error);
      } finally {
        setIsReady(true);
      }
    }
    loadData();
  }, []);

  useEffect(() => { if (isReady) secureSetItem('forge:sessions', JSON.stringify(sessions)); }, [sessions, isReady]);
  useEffect(() => { if (isReady) secureSetItem('forge:members', JSON.stringify(members)); }, [members, isReady]);
  useEffect(() => { if (isReady) secureSetItem('forge:groups', JSON.stringify(groups)); }, [groups, isReady]);
  useEffect(() => { if (isReady) secureSetItem('forge:programme_templates', JSON.stringify(programmeTemplates)); }, [programmeTemplates, isReady]);
  useEffect(() => { if (isReady) secureSetItem('forge:readiness_logs', JSON.stringify(readinessLogs)); }, [readinessLogs, isReady]);
  useEffect(() => { if (isReady) secureSetItem('forge:workout_completions', JSON.stringify(workoutCompletions)); }, [workoutCompletions, isReady]);
  useEffect(() => { if (isReady) secureSetItem('forge:google_sheets_endpoint', googleSheetsEndpoint); }, [googleSheetsEndpoint, isReady]);
  useEffect(() => {
    if (!isReady) return;
    if (savedPin === null) secureRemoveItem('forge:pin');
    else secureSetItem('forge:pin', savedPin);

    if (hasSeenOnboarding !== undefined) {
      secureSetItem('forge:has_seen_onboarding', hasSeenOnboarding ? 'true' : 'false');
    }
  }, [savedPin, hasSeenOnboarding, isReady]);

  return {
    isReady,
    sessions, setSessions,
    members, setMembers,
    groups, setGroups,
    programmeTemplates, setProgrammeTemplates,
    readinessLogs, setReadinessLogs,
    workoutCompletions, setWorkoutCompletions,
    googleSheetsEndpoint, setGoogleSheetsEndpoint,
    savedPin, setSavedPin,
    hasSeenOnboarding, setHasSeenOnboarding,
  };
}
