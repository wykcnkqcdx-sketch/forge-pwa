import type { ProgrammeTemplate, SquadMember, TrainingGroup, TrainingSession } from '../data/mockData';
import type { ReadinessLog, WorkoutCompletion } from '../data/domain';

export type GoogleSheetsExportPayload = {
  exportedAt: string;
  app: 'FORGE Tactical Fitness';
  version: 1;
  coachEmail?: string | null;
  tabs: {
    members: Array<Record<string, string | number | boolean | null>>;
    groups: Array<Record<string, string | number | boolean | null>>;
    sessions: Array<Record<string, string | number | boolean | null>>;
    assignments: Array<Record<string, string | number | boolean | null>>;
    completions: Array<Record<string, string | number | boolean | null>>;
    readiness: Array<Record<string, string | number | boolean | null>>;
    programmeTemplates: Array<Record<string, string | number | boolean | null>>;
  };
};

export type GoogleSheetsExportResult = {
  delivery: 'opaque' | 'json';
  ok: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  exportedAt?: string;
};

export function buildGoogleSheetsPayload(
  sessions: TrainingSession[],
  members: SquadMember[],
  groups: TrainingGroup[],
  programmeTemplates: ProgrammeTemplate[],
  readinessLogs: ReadinessLog[],
  workoutCompletions: WorkoutCompletion[],
  coachEmail?: string | null
): GoogleSheetsExportPayload {
  return {
    exportedAt: new Date().toISOString(),
    app: 'FORGE Tactical Fitness',
    version: 1,
    coachEmail: coachEmail ?? null,
    tabs: {
      members: members.map((member) => ({
        member_id: member.id,
        name: member.name,
        gym_name: member.gymName ?? null,
        email: member.email ?? null,
        group_id: member.groupId,
        readiness: member.readiness,
        compliance: member.compliance,
        risk: member.risk,
        load: member.load,
        invite_status: member.inviteStatus ?? null,
        assignment: member.assignment ?? null,
        streak_days: member.streakDays ?? null,
        weekly_volume: member.weeklyVolume ?? null,
        ghost_mode: member.ghostMode ?? false,
        last_workout_title: member.lastWorkoutTitle ?? null,
        last_workout_at: member.lastWorkoutAt ?? null,
        last_workout_note: member.lastWorkoutNote ?? null,
        hype_count: member.hypeCount ?? null,
        device_sync_provider: member.deviceSyncProvider ?? null,
        device_sync_status: member.deviceSyncStatus ?? null,
      })),
      groups: groups.map((group) => ({
        group_id: group.id,
        name: group.name,
        focus: group.focus,
        target_score: group.targetScore,
      })),
      sessions: sessions.map((session) => ({
        session_id: session.id,
        type: session.type,
        title: session.title,
        score: session.score,
        duration_minutes: session.durationMinutes,
        rpe: session.rpe,
        load_kg: session.loadKg ?? null,
        completed_at: session.completedAt ?? null,
        route_point_count: session.routePoints?.length ?? 0,
      })),
      assignments: members.flatMap((member) =>
        (member.assignmentSession?.exercises ?? []).map((exercise, index) => ({
          assignment_id: member.assignmentSession?.id ?? null,
          member_id: member.id,
          member_name: member.name,
          group_id: member.groupId,
          assignment_title: member.assignmentSession?.title ?? member.assignment ?? null,
          assignment_type: member.assignmentSession?.type ?? null,
          assignment_status: member.assignmentSession?.status ?? null,
          assigned_at: member.assignmentSession?.assignedAt ?? null,
          coach_note: member.assignmentSession?.coachNote ?? null,
          exercise_order: index + 1,
          exercise_id: exercise.exerciseId,
          exercise_name: exercise.name,
          prescribed_sets: exercise.prescribed?.sets ?? null,
          prescribed_reps: exercise.prescribed?.reps ?? null,
          prescribed_load: exercise.prescribed?.load ?? null,
          prescribed_load_unit: exercise.prescribed?.loadUnit ?? null,
          prescribed_duration_minutes: exercise.prescribed?.durationMinutes ?? null,
          prescribed_rest_seconds: exercise.prescribed?.restSeconds ?? null,
          actual_sets: exercise.actual?.sets ?? null,
          actual_reps: exercise.actual?.reps ?? null,
          actual_load: exercise.actual?.load ?? null,
          actual_duration_minutes: exercise.actual?.durationMinutes ?? null,
          exercise_status: exercise.status ?? null,
          coach_pinned: exercise.coachPinned ?? false,
        }))
      ),
      completions: workoutCompletions.map((completion) => ({
        completion_id: completion.id,
        member_id: completion.memberId,
        member_name: completion.memberName,
        group_id: completion.groupId,
        completion_type: completion.completionType,
        session_kind: completion.sessionKind,
        assignment: completion.assignment,
        effort: completion.effort,
        duration_minutes: completion.durationMinutes,
        volume: completion.volume,
        note: completion.note ?? null,
        exercise_count: completion.exercises?.length ?? 0,
        completed_at: completion.completedAt,
      })),
      readiness: readinessLogs.map((log) => ({
        readiness_id: log.id,
        logged_at: log.date,
        member_id: log.memberId ?? null,
        member_name: log.memberName ?? null,
        group_id: log.groupId ?? null,
        sleep_hours: log.sleepHours ?? null,
        sleep_quality: log.sleepQuality,
        soreness: log.soreness,
        stress: log.stress ?? null,
        pain: log.pain ?? null,
        hydration: log.hydration,
        mood: log.mood ?? null,
        illness: log.illness ?? null,
        pain_area: log.painArea ?? null,
        limits_training: log.limitsTraining ?? null,
        resting_hr: log.restingHR ?? null,
        hrv: log.hrv ?? null,
      })),
      programmeTemplates: programmeTemplates.flatMap((template) =>
        template.exercises.map((exercise, index) => ({
          template_id: template.id,
          template_name: template.name,
          assignment_title: template.assignmentTitle,
          type: template.type,
          evidence_label: template.evidenceLabel ?? null,
          evidence_updated_at: template.evidenceUpdatedAt ?? null,
          evidence_summary: template.evidenceSummary ?? null,
          summary: template.summary ?? null,
          weekly_volume: template.weeklyVolume ?? null,
          intensity: template.intensity ?? null,
          coach_note: template.coachNote ?? null,
          created_at: template.createdAt,
          exercise_order: index + 1,
          exercise_id: exercise.exerciseId,
          exercise_name: exercise.name,
          prescribed_sets: exercise.prescribed?.sets ?? null,
          prescribed_reps: exercise.prescribed?.reps ?? null,
          prescribed_load: exercise.prescribed?.load ?? null,
          prescribed_load_unit: exercise.prescribed?.loadUnit ?? null,
          prescribed_duration_minutes: exercise.prescribed?.durationMinutes ?? null,
          prescribed_rest_seconds: exercise.prescribed?.restSeconds ?? null,
          coach_pinned: exercise.coachPinned ?? false,
        }))
      ),
    },
  };
}

export async function exportToGoogleSheets(endpointUrl: string, payload: GoogleSheetsExportPayload): Promise<GoogleSheetsExportResult> {
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    mode: 'no-cors',
    body: JSON.stringify(payload),
  });

  if (response.type === 'opaque') {
    return {
      delivery: 'opaque',
      ok: true,
      exportedAt: payload.exportedAt,
    };
  }

  if (!response.ok) {
    throw new Error(`Google Sheets export failed with status ${response.status}.`);
  }

  const data = await response.json();
  return {
    delivery: 'json',
    ok: Boolean(data?.ok),
    spreadsheetId: data?.spreadsheetId,
    spreadsheetUrl: data?.spreadsheetUrl,
    exportedAt: data?.exportedAt,
  };
}
