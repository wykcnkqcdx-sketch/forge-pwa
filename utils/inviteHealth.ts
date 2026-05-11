import type { SquadMember } from '../data/mockData';
import type { CloudInvite } from '../lib/squadCloud';

const stalePendingMs = 7 * 24 * 60 * 60 * 1000;

function displayInviteStatus(invite: CloudInvite, now: Date): CloudInvite['status'] {
  if (invite.status === 'pending' && new Date(invite.expiresAt).getTime() <= now.getTime()) return 'expired';
  return invite.status;
}

export function buildInviteHealth(members: SquadMember[], cloudInvites: CloudInvite[], now = new Date()) {
  const acceptedNeedsSync = members.filter((member) => !member.cloudMembershipId && member.inviteStatus === 'Joined').length;
  const targetReady = members.filter((member) => Boolean(member.cloudMembershipId)).length;
  const stalePending = cloudInvites.filter((invite) => (
    displayInviteStatus(invite, now) === 'pending'
    && now.getTime() - new Date(invite.createdAt).getTime() >= stalePendingMs
  )).length;
  const expired = cloudInvites.filter((invite) => displayInviteStatus(invite, now) === 'expired').length;
  const revoked = cloudInvites.filter((invite) => displayInviteStatus(invite, now) === 'revoked').length;
  const needsAction = stalePending + expired + revoked + acceptedNeedsSync;

  return {
    stalePending,
    expired,
    revoked,
    acceptedNeedsSync,
    targetReady,
    needsAction,
  };
}
