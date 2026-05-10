import type { SquadMember } from '../data/mockData';

export type InviteLifecycleGroupKey = 'manual' | 'invited' | 'acceptedNeedsSync' | 'cloudReady';

export type InviteLifecycleGroup = {
  key: InviteLifecycleGroupKey;
  label: string;
  action: string;
  members: SquadMember[];
};

export function groupInviteLifecycle(members: SquadMember[]): InviteLifecycleGroup[] {
  const cloudReady = members.filter((member) => Boolean(member.cloudMembershipId));
  const invited = members.filter((member) => !member.cloudMembershipId && member.inviteStatus === 'Invited');
  const acceptedNeedsSync = members.filter((member) => !member.cloudMembershipId && member.inviteStatus === 'Joined');
  const manual = members.filter((member) => !member.cloudMembershipId && (!member.inviteStatus || member.inviteStatus === 'Manual'));

  return [
    {
      key: 'acceptedNeedsSync',
      label: 'Accepted, needs sync',
      action: 'Run Sync Now to attach the cloud target.',
      members: acceptedNeedsSync,
    },
    {
      key: 'invited',
      label: 'Invite pending',
      action: 'Send a new secure invite if the member lost the link.',
      members: invited,
    },
    {
      key: 'manual',
      label: 'Manual/local',
      action: 'Add an email and send a secure invite before cloud delivery.',
      members: manual,
    },
    {
      key: 'cloudReady',
      label: 'Cloud-ready',
      action: 'Assignments can sync to these member portals.',
      members: cloudReady,
    },
  ];
}
