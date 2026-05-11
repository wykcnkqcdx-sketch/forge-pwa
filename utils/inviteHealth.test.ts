import { describe, expect, it } from 'vitest';
import type { SquadMember } from '../data/mockData';
import type { CloudInvite } from '../lib/squadCloud';
import { buildInviteHealth } from './inviteHealth';

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

function invite(id: string, updates: Partial<CloudInvite> = {}): CloudInvite {
  return {
    id,
    squadId: 'squad-1',
    email: `${id}@example.com`,
    role: 'member',
    status: 'pending',
    expiresAt: '2026-05-30T12:00:00.000Z',
    createdAt: '2026-05-10T12:00:00.000Z',
    ...updates,
  };
}

describe('buildInviteHealth', () => {
  it('summarizes cloud invite and roster states that need coach action', () => {
    const health = buildInviteHealth(
      [
        member('accepted', { inviteStatus: 'Joined' }),
        member('ready', { cloudMembershipId: 'membership-1' }),
      ],
      [
        invite('fresh', { createdAt: '2026-05-09T12:00:00.000Z' }),
        invite('stale', { createdAt: '2026-05-01T12:00:00.000Z' }),
        invite('expired-by-status', { status: 'expired' }),
        invite('expired-by-date', { expiresAt: '2026-05-05T12:00:00.000Z' }),
        invite('revoked', { status: 'revoked' }),
      ],
      new Date('2026-05-11T12:00:00.000Z'),
    );

    expect(health).toEqual({
      stalePending: 1,
      expired: 2,
      revoked: 1,
      acceptedNeedsSync: 1,
      targetReady: 1,
      needsAction: 5,
    });
  });
});
