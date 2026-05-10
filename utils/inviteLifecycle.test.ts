import { describe, expect, it } from 'vitest';
import type { SquadMember } from '../data/mockData';
import { groupInviteLifecycle } from './inviteLifecycle';

function member(id: string, updates: Partial<SquadMember> = {}): SquadMember {
  return {
    id,
    name: id,
    groupId: 'alpha',
    readiness: 70,
    compliance: 80,
    risk: 'Low',
    load: 60,
    ...updates,
  };
}

describe('groupInviteLifecycle', () => {
  it('groups roster members by invite lifecycle state', () => {
    const groups = groupInviteLifecycle([
      member('manual'),
      member('pending', { inviteStatus: 'Invited', email: 'pending@example.com' }),
      member('accepted', { inviteStatus: 'Joined', email: 'accepted@example.com' }),
      member('ready', { inviteStatus: 'Joined', cloudMembershipId: 'cloud-ready-1' }),
    ]);

    expect(Object.fromEntries(groups.map((group) => [group.key, group.members.map((item) => item.id)]))).toEqual({
      acceptedNeedsSync: ['accepted'],
      invited: ['pending'],
      manual: ['manual'],
      cloudReady: ['ready'],
    });
  });
});
