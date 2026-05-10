import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructorScreen } from './InstructorScreen';
import type { CloudInvite } from '../lib/squadCloud';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({ error: null }),
  showConfirm: vi.fn((_title: string, _message: string, onConfirm: () => void, _confirmLabel?: string) => onConfirm()),
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const wrap = (tag: keyof HTMLElementTagNameMap) => ({ children, style: _style, onPress, ...props }: any) => (
    ReactModule.createElement(tag, { ...props, onClick: onPress }, children)
  );

  return {
    View: wrap('div'),
    Text: wrap('span'),
    TextInput: ({ value, onChangeText, placeholder, style: _style, ...props }: any) => (
      <input {...props} placeholder={placeholder} value={value ?? ''} onChange={(event) => onChangeText?.(event.currentTarget.value)} />
    ),
    Pressable: wrap('button'),
    FlatList: ({ data = [], renderItem, keyExtractor }: any) => (
      <div>{data.map((item: unknown, index: number) => (
        <ReactModule.Fragment key={keyExtractor?.(item, index) ?? index}>{renderItem({ item, index })}</ReactModule.Fragment>
      ))}</div>
    ),
    SafeAreaView: wrap('div'),
    ScrollView: wrap('div'),
    StyleSheet: { create: (styles: unknown) => styles, absoluteFillObject: {} },
    Platform: { OS: 'ios' },
    Linking: { openURL: vi.fn().mockResolvedValue(undefined) },
    Dimensions: {
      get: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span />,
}));

vi.mock('../components/ProgrammeBuilder', () => ({
  ProgrammeBuilder: () => null,
}));

vi.mock('../components/SquadMemberCard', () => ({
  SquadMemberCard: () => <div />,
  completionTone: () => '#fff',
}));

vi.mock('../lib/dialogs', () => ({
  showAlert: vi.fn(),
  showConfirm: (...args: unknown[]) => mocks.showConfirm(...args as [string, string, () => void, string?]),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { rpc: mocks.rpc },
}));

vi.mock('../lib/inviteTokens', () => ({
  buildSecureInviteUrl: (_base: string, token: string) => `https://forge.test/?invite=${token}`,
  generateInviteToken: vi.fn(() => 'fresh-token'),
  hashInviteToken: vi.fn(async () => 'fresh-token-hash'),
  inviteExpiry: vi.fn(() => '2026-05-24T12:00:00.000Z'),
}));

function makeInvite(overrides: Partial<CloudInvite>): CloudInvite {
  return {
    id: overrides.id ?? 'invite-1',
    squadId: overrides.squadId ?? '11111111-1111-4111-8111-111111111111',
    email: overrides.email ?? 'member@example.com',
    displayName: overrides.displayName ?? 'Member',
    gymName: overrides.gymName,
    role: overrides.role ?? 'member',
    status: overrides.status ?? 'pending',
    expiresAt: overrides.expiresAt ?? '2026-05-24T12:00:00.000Z',
    acceptedAt: overrides.acceptedAt,
    revokedAt: overrides.revokedAt,
    createdAt: overrides.createdAt ?? '2026-05-10T12:00:00.000Z',
  };
}

const baseProps: React.ComponentProps<typeof InstructorScreen> = {
  pinEnabled: false,
  sessions: [],
  members: [],
  groups: [{ id: 'alpha', name: 'Alpha', focus: 'Ruck', targetScore: 80 }],
  programmeTemplates: [],
  readinessLogs: [],
  workoutCompletions: [],
  assignmentDeployments: [],
  onSetPin: vi.fn(),
  onWipe: vi.fn(),
  onExport: vi.fn(),
  onImport: vi.fn(),
  onAddMember: vi.fn(),
  onDeleteMember: vi.fn(),
  onUpdateMember: vi.fn(),
  onAddAssignmentDeployment: vi.fn(),
  onAddGroup: vi.fn(),
  onAddProgrammeTemplate: vi.fn(),
  onDeleteProgrammeTemplate: vi.fn(),
  cloudEnabled: true,
  cloudStatus: 'synced',
  cloudEmail: 'coach@example.com',
  cloudSquadId: '11111111-1111-4111-8111-111111111111',
  cloudTeamPulse: null,
  cloudInvites: [],
  pendingSyncCount: 0,
  onCloudSync: vi.fn(),
  onCloudSignOut: vi.fn(),
  onRevokeCloudInvite: vi.fn(async () => undefined),
  googleSheetsEndpoint: '',
  onChangeGoogleSheetsEndpoint: vi.fn(),
  onExportGoogleSheets: vi.fn(),
  googleSheetsExporting: false,
  googleSheetsMessage: '',
};

describe('InstructorScreen Invite Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('filters cloud invite rows by status and treats past pending rows as expired', () => {
    const { getAllByText, getByText, queryByText } = render(<InstructorScreen {...baseProps} cloudInvites={[
      makeInvite({ id: 'pending', displayName: 'Pending Invite', status: 'pending' }),
      makeInvite({ id: 'revoked', displayName: 'Revoked Invite', status: 'revoked' }),
      makeInvite({ id: 'old', displayName: 'Old Pending Invite', status: 'pending', expiresAt: '2026-05-01T12:00:00.000Z' }),
    ]} />);

    fireEvent.click(getAllByText('Expired').at(-1)!);

    expect(getByText('Old Pending Invite')).toBeTruthy();
    expect(queryByText('Pending Invite')).toBeNull();
    expect(queryByText('Revoked Invite')).toBeNull();
  });

  it('expands the cloud invite queue in batches', () => {
    const invites = Array.from({ length: 6 }, (_, index) => makeInvite({
      id: `invite-${index}`,
      displayName: `Invite ${index + 1}`,
      email: `member${index + 1}@example.com`,
    }));

    const { getByText, queryByText } = render(<InstructorScreen {...baseProps} cloudInvites={invites} />);

    expect(getByText('Invite 5')).toBeTruthy();
    expect(queryByText('Invite 6')).toBeNull();

    fireEvent.click(getByText('Show 1 more'));

    expect(getByText('Invite 6')).toBeTruthy();
  });

  it('confirms and revokes pending cloud invites', async () => {
    const onRevokeCloudInvite = vi.fn(async () => undefined);
    const { getAllByText } = render(<InstructorScreen
      {...baseProps}
      onRevokeCloudInvite={onRevokeCloudInvite}
      cloudInvites={[makeInvite({ id: 'pending-revoke', displayName: 'Pending Revoke' })]}
    />);

    fireEvent.click(getAllByText('Revoke')[0]);

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'Revoke invite',
      expect.stringContaining('Pending Revoke'),
      expect.any(Function),
      'Revoke',
    );
    await waitFor(() => expect(onRevokeCloudInvite).toHaveBeenCalledWith('pending-revoke'));
  });

  it('resends revoked cloud invites with a fresh secure token row', async () => {
    const onCloudSync = vi.fn();
    const { getByText } = render(<InstructorScreen
      {...baseProps}
      onCloudSync={onCloudSync}
      cloudInvites={[makeInvite({ id: 'revoked-resend', displayName: 'Revoked Resend', status: 'revoked' })]}
    />);

    fireEvent.click(getByText('Resend'));

    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('create_member_invite', expect.objectContaining({
      p_squad_id: '11111111-1111-4111-8111-111111111111',
      p_token_hash: 'fresh-token-hash',
      p_display_name: 'Revoked Resend',
    })));
    await waitFor(() => expect(onCloudSync).toHaveBeenCalled());
  });
});
