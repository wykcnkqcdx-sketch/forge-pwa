import { describe, expect, it } from 'vitest';
import type { CloudInvite } from '../lib/squadCloud';
import { cloudInviteLabel, cloudInviteMatchesFilter, filterCloudInvites, firstStaleCloudInvite } from './inviteQueue';

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

describe('invite queue helpers', () => {
  it('uses gym name, display name, email, then fallback for invite labels', () => {
    expect(cloudInviteLabel(invite('gym', { gymName: 'Doyle', displayName: 'Pte Doyle' }))).toBe('Doyle');
    expect(cloudInviteLabel(invite('display', { email: undefined, displayName: 'Pte Doyle' }))).toBe('Pte Doyle');
    expect(cloudInviteLabel(invite('email', { email: 'email@example.com' }))).toBe('email@example.com');
    expect(cloudInviteLabel(invite('none', { email: undefined }))).toBe('Invite');
  });

  it('matches stale, expired, and status filters consistently', () => {
    const now = new Date('2026-05-11T12:00:00.000Z');
    expect(cloudInviteMatchesFilter(invite('stale', { createdAt: '2026-05-01T12:00:00.000Z' }), 'stale', now)).toBe(true);
    expect(cloudInviteMatchesFilter(invite('fresh', { createdAt: '2026-05-10T12:00:00.000Z' }), 'stale', now)).toBe(false);
    expect(cloudInviteMatchesFilter(invite('expired', { expiresAt: '2026-05-01T12:00:00.000Z' }), 'expired', now)).toBe(true);
    expect(cloudInviteMatchesFilter(invite('revoked', { status: 'revoked' }), 'revoked', now)).toBe(true);
  });

  it('filters by status and search text together', () => {
    const now = new Date('2026-05-11T12:00:00.000Z');
    const filtered = filterCloudInvites([
      invite('alpha', { displayName: 'Alpha Invite' }),
      invite('bravo', { displayName: 'Bravo Invite', status: 'revoked' }),
    ], 'revoked', 'bravo', now);

    expect(filtered.map((item) => item.id)).toEqual(['bravo']);
  });

  it('returns the oldest stale invite', () => {
    const now = new Date('2026-05-11T12:00:00.000Z');
    const first = firstStaleCloudInvite([
      invite('newer', { createdAt: '2026-05-02T12:00:00.000Z' }),
      invite('fresh', { createdAt: '2026-05-10T12:00:00.000Z' }),
      invite('oldest', { createdAt: '2026-05-01T12:00:00.000Z' }),
    ], now);

    expect(first?.id).toBe('oldest');
  });
});
