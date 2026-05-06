import type { ProgrammeTemplate, SquadMember, TrainingGroup, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';

export type Tab = 'home' | 'train' | 'ruck' | 'fuel' | 'analytics' | 'settings' | 'readiness';
export type MemberTab = 'portal' | 'train' | 'ruck' | 'fuel' | 'readiness';

export type PendingMemberInvite = {
  id: string;
  name: string;
  gymName: string;
  email?: string;
  groupId: string;
};

export type ForgeBackup = {
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

export type AppNavigation = {
  activeTab: Tab;
  activeMemberId: string | null;
  activeMemberTab: MemberTab;
  setActiveTab: (tab: Tab) => void;
  setActiveMemberId: (id: string | null) => void;
  setActiveMemberTab: (tab: MemberTab) => void;
};

export type AppActions = {
  addSession: (session: TrainingSession) => void;
  deleteSession: (id: string) => void;
  editSession: (id: string, updates: Partial<TrainingSession>) => void;
  addMember: (member: SquadMember) => void;
  deleteMember: (id: string) => void;
  updateMember: (id: string, updates: Partial<SquadMember>) => void;
  addGroup: (group: TrainingGroup) => void;
  addProgrammeTemplate: (template: ProgrammeTemplate) => void;
  deleteProgrammeTemplate: (id: string) => void;
  addReadinessLog: (log: ReadinessLog) => void;
  completeOnboarding: (mode: 'fresh' | 'demo') => void;
  exportData: () => void;
  importData: () => void;
};

// Re-export types from other modules for convenience
export type { ProgrammeTemplate, SquadMember, TrainingGroup, TrainingSession } from '../data/mockData';
export type { ReadinessLog, WorkoutCompletion } from '../data/domain';
