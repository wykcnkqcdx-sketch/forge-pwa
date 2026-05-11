import { describe, expect, it } from 'vitest';
import { buildAssignmentDeliveryHealth, buildAssignmentDeliveryRows, firstAssignmentWithLocalOnly, firstAssignmentWithPending } from './assignmentDelivery';
import type { SquadMember } from '../data/mockData';
import type { WorkoutCompletion } from '../data/domain';

const members: SquadMember[] = [
  {
    id: 'member-1',
    name: 'Pte Doyle',
    gymName: 'Doyle',
    groupId: 'alpha',
    readiness: 70,
    compliance: 80,
    risk: 'Low',
    load: 60,
    cloudMembershipId: 'cloud-1',
  },
  {
    id: 'member-2',
    name: 'Pte Walsh',
    gymName: 'Walsh',
    groupId: 'alpha',
    readiness: 65,
    compliance: 75,
    risk: 'Low',
    load: 62,
  },
];

const completions: WorkoutCompletion[] = [
  {
    id: 'completion-1',
    memberId: 'member-1',
    memberName: 'Doyle',
    groupId: 'alpha',
    completionType: 'assigned',
    sessionKind: 'Workout',
    assignment: 'Ruck Intervals',
    effort: 'About Right',
    durationMinutes: 45,
    note: 'Good pace.',
    volume: 300,
    completedAt: '2026-05-10T11:00:00.000Z',
  },
];

describe('buildAssignmentDeliveryRows', () => {
  it('derives cloud/local and completion status for deployment targets', () => {
    const delivery = buildAssignmentDeliveryRows({
      assignmentTitle: 'Ruck Intervals',
      assignedAt: '2026-05-10T10:00:00.000Z',
      targetMemberIds: ['member-1', 'member-2'],
      targetNames: ['Doyle', 'Walsh'],
      cloudReadyMemberIds: ['member-1'],
      members,
      workoutCompletions: completions,
    });

    expect(delivery.cloudDeliveredCount).toBe(1);
    expect(delivery.localOnlyCount).toBe(1);
    expect(delivery.completedCount).toBe(1);
    expect(delivery.rows.map((row) => [row.name, row.deliveryLabel, row.completionLabel])).toEqual([
      ['Doyle', 'Cloud delivered', 'Completed'],
      ['Walsh', 'Local only', 'Pending'],
    ]);
    expect(delivery.rows[0].note).toBe('Good pace.');
  });
});

describe('buildAssignmentDeliveryHealth', () => {
  it('summarizes assignment delivery and completion health', () => {
    const health = buildAssignmentDeliveryHealth([
      { targetCount: 3, cloudReadyCount: 2, localOnlyCount: 1, completedCount: 1 },
      { targetCount: 2, cloudReadyCount: 1, completedCount: 2 },
    ]);

    expect(health).toEqual({
      totalTargets: 5,
      cloudDelivered: 3,
      localOnly: 2,
      completed: 3,
      pending: 2,
      deliveryPercent: 60,
      completionPercent: 60,
      needsAction: 4,
    });
  });

  it('finds the first assignment with local-only targets', () => {
    const assignments = [
      { key: 'ready', targetCount: 2, cloudReadyCount: 2, completedCount: 0 },
      { key: 'local', targetCount: 3, cloudReadyCount: 2, completedCount: 0 },
    ];

    expect(firstAssignmentWithLocalOnly(assignments)?.key).toBe('local');
  });

  it('finds the first assignment with pending completions', () => {
    const assignments = [
      { key: 'done', targetCount: 2, cloudReadyCount: 2, completedCount: 2 },
      { key: 'pending', targetCount: 3, cloudReadyCount: 3, completedCount: 1 },
    ];

    expect(firstAssignmentWithPending(assignments)?.key).toBe('pending');
  });
});
