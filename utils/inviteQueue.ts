import type { CloudInvite } from '../lib/squadCloud';
import { displayInviteStatus, isStalePendingInvite } from './inviteHealth';

export type CloudInviteFilter = 'all' | 'stale' | CloudInvite['status'];

export function cloudInviteLabel(invite: CloudInvite) {
  return invite.gymName || invite.displayName || invite.email || 'Invite';
}

export function cloudInviteMatchesFilter(invite: CloudInvite, filter: CloudInviteFilter, now = new Date()) {
  if (filter === 'all') return true;
  if (filter === 'stale') return isStalePendingInvite(invite, now);
  return displayInviteStatus(invite, now) === filter;
}

export function cloudInviteMatchesSearch(invite: CloudInvite, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [invite.email, invite.displayName, invite.gymName]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalized));
}

export function filterCloudInvites(invites: CloudInvite[], filter: CloudInviteFilter, query: string, now = new Date()) {
  return invites.filter((invite) => (
    cloudInviteMatchesFilter(invite, filter, now) && cloudInviteMatchesSearch(invite, query)
  ));
}

export function countCloudInvites(invites: CloudInvite[], now = new Date()) {
  return {
    pending: invites.filter((invite) => displayInviteStatus(invite, now) === 'pending').length,
    accepted: invites.filter((invite) => displayInviteStatus(invite, now) === 'accepted').length,
    expired: invites.filter((invite) => displayInviteStatus(invite, now) === 'expired').length,
    revoked: invites.filter((invite) => displayInviteStatus(invite, now) === 'revoked').length,
  };
}

export function firstStaleCloudInvite(invites: CloudInvite[], now = new Date()) {
  return invites
    .filter((invite) => isStalePendingInvite(invite, now))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0] ?? null;
}
