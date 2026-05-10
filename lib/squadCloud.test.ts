import { describe, expect, it, vi } from 'vitest';
import { fromRemoteTeamActivity, toRemoteTeamActivity } from './squadCloud';
import type { WorkoutCompletion } from '../data/domain';

vi.mock('./supabase', () => ({
  supabase: null,
}));

const completion: WorkoutCompletion = {
  id: 'completion-1',
  memberId: 'member-1',
  memberName: 'Doyle',
  groupId: 'alpha',
  membershipId: 'membership-1',
  completionType: 'assigned',
  sessionKind: 'Workout',
  assignment: 'Ruck Intervals',
  effort: 'About Right',
  durationMinutes: 45,
  note: 'Felt good.',
  volume: 300,
  completedAt: '2026-05-10T10:00:00.000Z',
};

describe('toRemoteTeamActivity', () => {
  it('keeps visible activity identifiable when Ghost Mode is off', () => {
    const activity = toRemoteTeamActivity('squad-1', completion, 'membership-1');

    expect(activity.actor_membership_id).toBe('membership-1');
    expect(activity.title).toBe('Doyle completed Ruck Intervals');
    expect(activity.body).toBe('Felt good.');
    expect(activity.metadata?.ghostMode).toBe(false);
  });

  it('anonymizes activity title and note when Ghost Mode is on', () => {
    const activity = toRemoteTeamActivity('squad-1', completion, 'membership-1', { ghostMode: true });

    expect(activity.actor_membership_id).toBe('membership-1');
    expect(activity.title).toBe('A teammate completed Ruck Intervals');
    expect(activity.body).toBeNull();
    expect(activity.metadata?.ghostMode).toBe(true);
  });
});

describe('fromRemoteTeamActivity', () => {
  it('maps remote rows into member-portal activity items', () => {
    const activity = fromRemoteTeamActivity({
      id: 'activity-1',
      squad_id: 'squad-1',
      actor_membership_id: 'membership-1',
      activity_type: 'workout_completed',
      title: 'A teammate completed Ruck Intervals',
      body: null,
      metadata: { ghostMode: true, volume: 300 },
      created_at: '2026-05-10T10:00:00.000Z',
    });

    expect(activity).toEqual({
      id: 'activity-1',
      squadId: 'squad-1',
      actorMembershipId: 'membership-1',
      type: 'workout_completed',
      title: 'A teammate completed Ruck Intervals',
      body: undefined,
      metadata: { ghostMode: true, volume: 300 },
      createdAt: '2026-05-10T10:00:00.000Z',
    });
  });
});
