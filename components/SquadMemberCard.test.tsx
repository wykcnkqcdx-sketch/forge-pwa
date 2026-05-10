import { describe, expect, it, vi } from 'vitest';
import { memberLifecycle } from './SquadMemberCard';
import type { SquadMember } from '../data/mockData';

vi.mock('react-native', async (importOriginal) => {
  return {
    View: 'View',
    Text: 'Text',
    Pressable: 'Pressable',
    StyleSheet: {
      create: (styles: unknown) => styles,
    },
    Dimensions: {
      get: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  };
});

const baseMember: SquadMember = {
  id: 'member-1',
  name: 'Pte Doyle',
  groupId: 'alpha',
  readiness: 70,
  compliance: 80,
  risk: 'Low',
  load: 60,
};

describe('memberLifecycle', () => {
  it('marks members with cloud membership IDs as assignment target ready', () => {
    const lifecycle = memberLifecycle({ ...baseMember, cloudMembershipId: '12345678-aaaa-bbbb-cccc-123456789abc' }, true);

    expect(lifecycle.label).toBe('Assignment Target Ready');
    expect(lifecycle.actionLabel).toBeUndefined();
  });

  it('offers sync action for accepted members that are not yet linked to a cloud target', () => {
    const lifecycle = memberLifecycle({ ...baseMember, inviteStatus: 'Joined' }, true);

    expect(lifecycle.label).toBe('Accepted');
    expect(lifecycle.actionLabel).toBe('Sync Now');
  });

  it('does not offer sync action for pending invites', () => {
    const lifecycle = memberLifecycle({ ...baseMember, inviteStatus: 'Invited' }, true);

    expect(lifecycle.label).toBe('Invited');
    expect(lifecycle.actionLabel).toBeUndefined();
  });
});
