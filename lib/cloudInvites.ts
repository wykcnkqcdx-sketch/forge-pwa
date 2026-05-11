import type { SquadMember } from '../data/mockData';
import { buildSecureInviteUrl, generateInviteToken, hashInviteToken, inviteExpiry } from './inviteTokens';
import { supabase } from './supabase';

type InviteMember = Pick<SquadMember, 'name' | 'gymName' | 'email' | 'groupId'>;

type CreateCloudMemberInviteInput = {
  appBaseUrl: string;
  cloudEnabled: boolean;
  cloudSquadId?: string | null;
  member: InviteMember;
};

export type CreatedCloudMemberInvite = {
  inviteUrl: string;
  expiresAt: string;
  trimmedEmail: string;
  displayName: string;
  storageNote: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createCloudMemberInvite({
  appBaseUrl,
  cloudEnabled,
  cloudSquadId,
  member,
}: CreateCloudMemberInviteInput): Promise<CreatedCloudMemberInvite> {
  const trimmedEmail = member.email?.trim().toLowerCase() ?? '';
  const displayName = member.gymName || member.name;
  const inviteToken = generateInviteToken();
  const tokenHash = await hashInviteToken(inviteToken);
  const inviteUrl = buildSecureInviteUrl(appBaseUrl, inviteToken);
  const expiresAt = inviteExpiry();
  let storageNote = `Token hash ${tokenHash.slice(0, 12)}... is ready for member_invites storage.`;

  const inviteSquadId = cloudSquadId ?? (uuidPattern.test(member.groupId) ? member.groupId : null);
  if (cloudEnabled && supabase && inviteSquadId) {
    const { error } = await supabase.rpc('create_member_invite', {
      p_squad_id: inviteSquadId,
      p_token_hash: tokenHash,
      p_email: trimmedEmail || null,
      p_display_name: member.name,
      p_gym_name: displayName,
      p_role: 'member',
      p_expires_at: expiresAt,
    });

    if (error) {
      console.error('Failed to create secure invite row', error);
      storageNote = `Invite created, but Supabase invite storage failed: ${error.message}`;
    } else {
      storageNote = 'Secure invite token stored in Supabase.';
    }
  }

  return {
    inviteUrl,
    expiresAt,
    trimmedEmail,
    displayName,
    storageNote,
  };
}
