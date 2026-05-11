import { secureGetItem, secureRemoveItem, secureSetItem } from './secureStorage';

const latestInviteLinkKey = 'forge:latest_invite_link';

export type LatestInviteLink = {
  url: string;
  label: string;
  expiresAt: string;
  createdAt: string;
};

function isLatestInviteLink(value: unknown): value is LatestInviteLink {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Record<keyof LatestInviteLink, unknown>>;
  return typeof candidate.url === 'string'
    && typeof candidate.label === 'string'
    && typeof candidate.expiresAt === 'string'
    && typeof candidate.createdAt === 'string';
}

export async function loadLatestInviteLink(now = new Date()): Promise<LatestInviteLink | null> {
  const stored = await secureGetItem(latestInviteLinkKey);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    if (!isLatestInviteLink(parsed)) {
      await secureRemoveItem(latestInviteLinkKey);
      return null;
    }
    if (new Date(parsed.expiresAt).getTime() <= now.getTime()) {
      await secureRemoveItem(latestInviteLinkKey);
      return null;
    }
    return parsed;
  } catch {
    await secureRemoveItem(latestInviteLinkKey);
    return null;
  }
}

export async function saveLatestInviteLink(link: LatestInviteLink): Promise<void> {
  await secureSetItem(latestInviteLinkKey, JSON.stringify(link));
}

export async function clearLatestInviteLink(): Promise<void> {
  await secureRemoveItem(latestInviteLinkKey);
}
