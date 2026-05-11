import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLatestInviteLink, loadLatestInviteLink, saveLatestInviteLink, type LatestInviteLink } from './latestInviteLink';
import * as secureStorage from './secureStorage';

vi.mock('./secureStorage', () => ({
  secureGetItem: vi.fn().mockResolvedValue(null),
  secureSetItem: vi.fn().mockResolvedValue(undefined),
  secureRemoveItem: vi.fn().mockResolvedValue(undefined),
}));

const mockGet = secureStorage.secureGetItem as ReturnType<typeof vi.fn>;
const mockSet = secureStorage.secureSetItem as ReturnType<typeof vi.fn>;
const mockRemove = secureStorage.secureRemoveItem as ReturnType<typeof vi.fn>;

const link: LatestInviteLink = {
  url: 'https://forge.test/?invite=fresh-token',
  label: 'Pte Doyle',
  expiresAt: '2026-05-24T12:00:00.000Z',
  createdAt: '2026-05-11T12:00:00.000Z',
};

describe('latest invite link storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue(null);
    mockSet.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  it('saves the latest invite link', async () => {
    await saveLatestInviteLink(link);

    expect(mockSet).toHaveBeenCalledWith('forge:latest_invite_link', JSON.stringify(link));
  });

  it('loads an unexpired invite link', async () => {
    mockGet.mockResolvedValue(JSON.stringify(link));

    await expect(loadLatestInviteLink(new Date('2026-05-12T12:00:00.000Z'))).resolves.toEqual(link);
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('clears expired invite links during load', async () => {
    mockGet.mockResolvedValue(JSON.stringify(link));

    await expect(loadLatestInviteLink(new Date('2026-05-25T12:00:00.000Z'))).resolves.toBeNull();
    expect(mockRemove).toHaveBeenCalledWith('forge:latest_invite_link');
  });

  it('clears malformed invite link storage', async () => {
    mockGet.mockResolvedValue('{bad json');

    await expect(loadLatestInviteLink()).resolves.toBeNull();
    expect(mockRemove).toHaveBeenCalledWith('forge:latest_invite_link');
  });

  it('clears latest invite link on request', async () => {
    await clearLatestInviteLink();

    expect(mockRemove).toHaveBeenCalledWith('forge:latest_invite_link');
  });
});
