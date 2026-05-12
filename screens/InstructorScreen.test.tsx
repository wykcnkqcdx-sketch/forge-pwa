import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstructorScreen } from './InstructorScreen';
import type { CloudInvite } from '../lib/squadCloud';

const mocks = vi.hoisted(() => ({
  createCloudMemberInvite: vi.fn(),
  clearLatestInviteLink: vi.fn(),
  loadLatestInviteLink: vi.fn(),
  saveLatestInviteLink: vi.fn(),
  showAlert: vi.fn(),
  showConfirm: vi.fn((_title: string, _message: string, onConfirm: () => void, _confirmLabel?: string) => onConfirm()),
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const wrap = (tag: keyof HTMLElementTagNameMap) => ({ children, style: _style, onPress, contentContainerStyle, showsVerticalScrollIndicator, scrollIndicatorInsets, keyboardShouldPersistTaps, ...props }: any) => (
    ReactModule.createElement(tag, { ...props, onClick: onPress }, children)
  );

  return {
    View: wrap('div'),
    Text: wrap('span'),
    TextInput: ({ value, onChangeText, placeholder, style: _style, placeholderTextColor, autoCorrect, keyboardType, ...props }: any) => (
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
  showAlert: (...args: unknown[]) => mocks.showAlert(...args),
  showConfirm: (...args: unknown[]) => mocks.showConfirm(...args as [string, string, () => void, string?]),
}));

vi.mock('../lib/cloudInvites', () => ({
  createCloudMemberInvite: (...args: unknown[]) => mocks.createCloudMemberInvite(...args),
}));

vi.mock('../lib/latestInviteLink', () => ({
  clearLatestInviteLink: (...args: unknown[]) => mocks.clearLatestInviteLink(...args),
  loadLatestInviteLink: (...args: unknown[]) => mocks.loadLatestInviteLink(...args),
  saveLatestInviteLink: (...args: unknown[]) => mocks.saveLatestInviteLink(...args),
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
    mocks.createCloudMemberInvite.mockResolvedValue({
      inviteUrl: 'https://forge.test/?invite=fresh-token',
      expiresAt: '2026-05-24T12:00:00.000Z',
      trimmedEmail: 'member@example.com',
      displayName: 'Member',
      storageNote: 'Secure invite token stored in Supabase.',
    });
    mocks.loadLatestInviteLink.mockResolvedValue(null);
    mocks.saveLatestInviteLink.mockResolvedValue(undefined);
    mocks.clearLatestInviteLink.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
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

  it('shows invite health counts for coach action states', () => {
    const acceptedMember = {
      id: 'accepted-member',
      name: 'Accepted Member',
      groupId: 'alpha',
      readiness: 70,
      compliance: 80,
      risk: 'Low' as const,
      load: 45,
      inviteStatus: 'Joined' as const,
    };
    const readyMember = {
      ...acceptedMember,
      id: 'ready-member',
      name: 'Ready Member',
      cloudMembershipId: 'membership-1',
    };

    const { getAllByText, getByText } = render(<InstructorScreen
      {...baseProps}
      members={[acceptedMember, readyMember]}
      cloudInvites={[
        makeInvite({ id: 'stale', createdAt: '2026-05-01T12:00:00.000Z' }),
        makeInvite({ id: 'revoked', status: 'revoked' }),
        makeInvite({ id: 'expired', status: 'pending', expiresAt: '2026-05-01T12:00:00.000Z' }),
      ]}
    />);

    expect(getByText('4 need action')).toBeTruthy();
    expect(getByText('Stale 1')).toBeTruthy();
    expect(getByText('Expired 1')).toBeTruthy();
    expect(getByText('Revoked 1')).toBeTruthy();
    expect(getByText('Accepted 1')).toBeTruthy();
    expect(getByText('Ready 1')).toBeTruthy();
  });

  it('uses invite health chips to filter the cloud invite queue', () => {
    const { getByText, queryByText } = render(<InstructorScreen
      {...baseProps}
      cloudInvites={[
        makeInvite({ id: 'pending', displayName: 'Pending Invite', status: 'pending', createdAt: '2026-05-10T12:00:00.000Z' }),
        makeInvite({ id: 'stale', displayName: 'Stale Invite', status: 'pending', createdAt: '2026-05-01T12:00:00.000Z' }),
        makeInvite({ id: 'revoked', displayName: 'Revoked Invite', status: 'revoked' }),
        makeInvite({ id: 'expired', displayName: 'Expired Invite', status: 'pending', expiresAt: '2026-05-01T12:00:00.000Z' }),
      ]}
    />);

    fireEvent.click(getByText('Stale 1'));

    expect(getByText('Stale Invite')).toBeTruthy();
    expect(queryByText('Pending Invite')).toBeNull();
    expect(queryByText('Expired Invite')).toBeNull();
    expect(queryByText('Revoked Invite')).toBeNull();

    fireEvent.click(getByText('Expired 1'));

    expect(getByText('Expired Invite')).toBeTruthy();
    expect(queryByText('Pending Invite')).toBeNull();
    expect(queryByText('Revoked Invite')).toBeNull();

    fireEvent.click(getByText('Revoked 1'));

    expect(getByText('Revoked Invite')).toBeTruthy();
    expect(queryByText('Expired Invite')).toBeNull();
  });

  it('copies a fresh link for the oldest stale invite from invite health', async () => {
    const { getAllByText, getByText } = render(<InstructorScreen
      {...baseProps}
      cloudInvites={[
        makeInvite({ id: 'newer-stale', displayName: 'Newer Stale', email: 'newer@example.com', createdAt: '2026-05-02T12:00:00.000Z' }),
        makeInvite({ id: 'oldest-stale', displayName: 'Oldest Stale', email: 'oldest@example.com', createdAt: '2026-05-01T12:00:00.000Z' }),
      ]}
    />);

    fireEvent.click(getByText('Copy: Oldest Stale'));

    await waitFor(() => expect(mocks.createCloudMemberInvite).toHaveBeenCalledWith(expect.objectContaining({
      member: expect.objectContaining({
        name: 'Oldest Stale',
        email: 'oldest@example.com',
      }),
    })));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://forge.test/?invite=fresh-token'));
  });

  it('resends the oldest stale invite from invite health', async () => {
    const onCloudSync = vi.fn();
    const { getByText } = render(<InstructorScreen
      {...baseProps}
      onCloudSync={onCloudSync}
      cloudInvites={[
        makeInvite({ id: 'newer-stale', displayName: 'Newer Stale', email: 'newer@example.com', createdAt: '2026-05-02T12:00:00.000Z' }),
        makeInvite({ id: 'oldest-stale', displayName: 'Oldest Stale', email: 'oldest@example.com', createdAt: '2026-05-01T12:00:00.000Z' }),
      ]}
    />);

    fireEvent.click(getByText('Resend: Oldest Stale'));

    await waitFor(() => expect(mocks.createCloudMemberInvite).toHaveBeenCalledWith(expect.objectContaining({
      member: expect.objectContaining({
        name: 'Oldest Stale',
        email: 'oldest@example.com',
      }),
    })));
    await waitFor(() => expect(onCloudSync).toHaveBeenCalled());
  });

  it('searches cloud invite rows by email or name', () => {
    const { getByPlaceholderText, getByText, queryByText } = render(<InstructorScreen {...baseProps} cloudInvites={[
      makeInvite({ id: 'alpha', displayName: 'Alpha Invite', email: 'alpha@example.com' }),
      makeInvite({ id: 'bravo', displayName: 'Bravo Invite', email: 'bravo@example.com' }),
    ]} />);

    fireEvent.change(getByPlaceholderText('Search cloud invites'), { target: { value: 'bravo' } });

    expect(getByText('Bravo Invite')).toBeTruthy();
    expect(queryByText('Alpha Invite')).toBeNull();
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

    await waitFor(() => expect(mocks.createCloudMemberInvite).toHaveBeenCalledWith(expect.objectContaining({
      appBaseUrl: 'https://wykcnkqcdx-sketch.github.io/forge-pwa/',
      cloudEnabled: true,
      cloudSquadId: '11111111-1111-4111-8111-111111111111',
      member: expect.objectContaining({ name: 'Revoked Resend' }),
    })));
    await waitFor(() => expect(onCloudSync).toHaveBeenCalled());
  });

  it('copies a fresh invite link for manual roster members', async () => {
    const onUpdateMember = vi.fn();
    const member = {
      id: 'member-copy',
      name: 'Pte Copy',
      gymName: 'Copy',
      email: 'copy@example.com',
      groupId: 'alpha',
      readiness: 70,
      compliance: 80,
      risk: 'Low' as const,
      load: 45,
      inviteStatus: 'Manual' as const,
    };

    const { getAllByText } = render(<InstructorScreen
      {...baseProps}
      members={[member]}
      onUpdateMember={onUpdateMember}
    />);

    fireEvent.click(getAllByText('Copy Link')[0]);

    await waitFor(() => expect(mocks.createCloudMemberInvite).toHaveBeenCalledWith(expect.objectContaining({
      member: expect.objectContaining({ id: 'member-copy', name: 'Pte Copy' }),
    })));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://forge.test/?invite=fresh-token'));
    expect(onUpdateMember).toHaveBeenCalledWith('member-copy', expect.objectContaining({ inviteStatus: 'Invited' }));
    expect(mocks.saveLatestInviteLink).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://forge.test/?invite=fresh-token',
      label: 'Member',
      expiresAt: '2026-05-24T12:00:00.000Z',
    }));
    expect(mocks.showAlert).toHaveBeenCalledWith('Invite link copied', expect.stringContaining('clipboard'));
  });

  it('keeps the latest generated invite link available to copy again', async () => {
    mocks.createCloudMemberInvite.mockResolvedValueOnce({
      inviteUrl: 'https://forge.test/?invite=fresh-token',
      expiresAt: '2026-05-24T12:00:00.000Z',
      trimmedEmail: 'latest@example.com',
      displayName: 'Latest',
      storageNote: 'Secure invite token stored in Supabase.',
    });
    const member = {
      id: 'member-latest',
      name: 'Pte Latest',
      gymName: 'Latest',
      email: 'latest@example.com',
      groupId: 'alpha',
      readiness: 70,
      compliance: 80,
      risk: 'Low' as const,
      load: 45,
      inviteStatus: 'Manual' as const,
    };

    const { getAllByText, getByText } = render(<InstructorScreen
      {...baseProps}
      members={[member]}
    />);

    fireEvent.click(getAllByText('Copy Link')[0]);
    await waitFor(() => expect(getByText('Latest invite: Latest')).toBeTruthy());

    vi.mocked(navigator.clipboard.writeText).mockClear();
    fireEvent.click(getByText('Copy Again'));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://forge.test/?invite=fresh-token'));
    expect(mocks.showAlert).toHaveBeenCalledWith('Invite link copied', expect.stringContaining('latest invite link'));
  });

  it('loads a persisted latest invite link on mount', async () => {
    mocks.loadLatestInviteLink.mockResolvedValueOnce({
      url: 'https://forge.test/?invite=stored-token',
      label: 'Stored',
      expiresAt: '2026-05-24T12:00:00.000Z',
      createdAt: '2026-05-11T12:00:00.000Z',
    });

    const { getByText } = render(<InstructorScreen {...baseProps} />);

    await waitFor(() => expect(getByText('Latest invite: Stored')).toBeTruthy());
  });

  it('clears the persisted latest invite recovery row', async () => {
    mocks.loadLatestInviteLink.mockResolvedValueOnce({
      url: 'https://forge.test/?invite=stored-token',
      label: 'Stored',
      expiresAt: '2026-05-24T12:00:00.000Z',
      createdAt: '2026-05-11T12:00:00.000Z',
    });

    const { getByText, queryByText } = render(<InstructorScreen {...baseProps} />);
    await waitFor(() => expect(getByText('Latest invite: Stored')).toBeTruthy());

    fireEvent.click(getByText('Clear'));

    await waitFor(() => expect(mocks.clearLatestInviteLink).toHaveBeenCalled());
    expect(queryByText('Latest invite: Stored')).toBeNull();
  });
});

describe('InstructorScreen Assignment History', () => {
  const deployment = {
    id: 'deployment-1',
    title: 'Ruck Intervals',
    scope: 'squad' as const,
    targetMemberIds: ['member-1', 'member-2'],
    targetNames: ['Doyle', 'Walsh'],
    cloudReadyMemberIds: ['member-1'],
    completedMemberIds: ['member-1'],
    exerciseCount: 3,
    assignedAt: '2026-05-10T10:00:00.000Z',
  };

  it('shows assignment delivery health across recent deployments', () => {
    const { getAllByText, getByText } = render(<InstructorScreen
      {...baseProps}
      assignmentDeployments={[deployment]}
    />);

    expect(getByText('2')).toBeTruthy();
    expect(getAllByText('Need action').length).toBeGreaterThan(0);
    expect(getAllByText((_content, element) => element?.textContent === 'Cloud 1').length).toBeGreaterThan(0);
    expect(getAllByText((_content, element) => element?.textContent === 'Local 1').length).toBeGreaterThan(0);
    expect(getAllByText((_content, element) => element?.textContent === 'Done 1').length).toBeGreaterThan(0);
    expect(getAllByText((_content, element) => element?.textContent === 'Pending 1').length).toBeGreaterThan(0);
    expect(getAllByText((_content, element) => element?.textContent === 'Delivery 50%').length).toBeGreaterThan(0);
  });

  it('opens the first local-only assignment from delivery health', () => {
    const { getAllByText, getByText } = render(<InstructorScreen
      {...baseProps}
      assignmentDeployments={[deployment]}
    />);

    fireEvent.click(getAllByText((_content, element) => element?.textContent === 'Local 1')[0]);

    expect(getByText('Focused: Local-only targets')).toBeTruthy();
    expect(getAllByText('Doyle').length).toBeGreaterThan(0);
    expect(getAllByText('Walsh').length).toBeGreaterThan(0);
    expect(getByText((_content, element) => element?.textContent === 'Local only - Pending')).toBeTruthy();
    const detailRows = getAllByText((_content, element) => (
      element?.textContent === 'Local only - Pending' || element?.textContent === 'Cloud delivered - Completed'
    ));
    expect(detailRows[0].textContent).toBe('Local only - Pending');
  });

  it('opens the first pending assignment from delivery health', () => {
    const { getAllByText, getByText } = render(<InstructorScreen
      {...baseProps}
      assignmentDeployments={[deployment]}
    />);

    fireEvent.click(getAllByText((_content, element) => element?.textContent === 'Pending 1')[0]);

    expect(getByText('Focused: Pending targets')).toBeTruthy();
    expect(getByText((_content, element) => element?.textContent === 'Cloud delivered - Completed')).toBeTruthy();
    expect(getByText((_content, element) => element?.textContent === 'Local only - Pending')).toBeTruthy();
    const detailRows = getAllByText((_content, element) => (
      element?.textContent === 'Local only - Pending' || element?.textContent === 'Cloud delivered - Completed'
    ));
    expect(detailRows[0].textContent).toBe('Local only - Pending');
  });
});
