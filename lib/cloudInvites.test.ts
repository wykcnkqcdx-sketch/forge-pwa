import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudMemberInvite } from './cloudInvites';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('./supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock('./inviteTokens', () => ({
  buildSecureInviteUrl: (_base: string, token: string) => `https://forge.test/?invite=${token}`,
  generateInviteToken: vi.fn(() => 'fresh-token'),
  hashInviteToken: vi.fn(async () => 'fresh-token-hash'),
  inviteExpiry: vi.fn(() => '2026-05-24T12:00:00.000Z'),
}));

describe('createCloudMemberInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it('creates a secure invite row when cloud is enabled', async () => {
    const invite = await createCloudMemberInvite({
      appBaseUrl: 'https://forge.test/',
      cloudEnabled: true,
      cloudSquadId: '11111111-1111-4111-8111-111111111111',
      member: {
        name: 'Pte Doyle',
        gymName: 'Doyle',
        email: ' DOYLE@EXAMPLE.COM ',
        groupId: 'alpha',
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith('create_member_invite', {
      p_squad_id: '11111111-1111-4111-8111-111111111111',
      p_token_hash: 'fresh-token-hash',
      p_email: 'doyle@example.com',
      p_display_name: 'Pte Doyle',
      p_gym_name: 'Doyle',
      p_role: 'member',
      p_expires_at: '2026-05-24T12:00:00.000Z',
    });
    expect(invite).toMatchObject({
      inviteUrl: 'https://forge.test/?invite=fresh-token',
      trimmedEmail: 'doyle@example.com',
      displayName: 'Doyle',
      storageNote: 'Secure invite token stored in Supabase.',
    });
  });

  it('returns a local storage note when cloud storage is unavailable', async () => {
    const invite = await createCloudMemberInvite({
      appBaseUrl: 'https://forge.test/',
      cloudEnabled: false,
      cloudSquadId: null,
      member: {
        name: 'Pte Local',
        email: '',
        groupId: 'alpha',
      },
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(invite.storageNote).toBe('Token hash fresh-token-... is ready for member_invites storage.');
  });

  it('keeps the invite usable when Supabase storage fails', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'permission denied' } });

    const invite = await createCloudMemberInvite({
      appBaseUrl: 'https://forge.test/',
      cloudEnabled: true,
      cloudSquadId: '11111111-1111-4111-8111-111111111111',
      member: {
        name: 'Pte Retry',
        email: 'retry@example.com',
        groupId: 'alpha',
      },
    });

    expect(invite.inviteUrl).toBe('https://forge.test/?invite=fresh-token');
    expect(invite.storageNote).toBe('Invite created, but Supabase invite storage failed: permission denied');
  });
});
