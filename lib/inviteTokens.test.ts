import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSecureInviteUrl, generateInviteToken, hashInviteToken, inviteExpiry } from './inviteTokens';

describe('invite token helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates URL-safe 32 character invite tokens', () => {
    const token = generateInviteToken();

    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes invite tokens with SHA-256 when crypto subtle is available', async () => {
    await expect(hashInviteToken('forge-invite')).resolves.toBe(
      'b13a61f71a011173e254cac112256f475e79490a02f91c3870dc38b9590b1ec1',
    );
  });

  it('builds secure invite URLs without dropping existing query params', () => {
    const url = buildSecureInviteUrl('https://example.com/forge?utm=coach', 'token-123');

    expect(url).toBe('https://example.com/forge?utm=coach&invite=token-123');
  });

  it('creates an ISO expiry date using the requested day offset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));

    expect(inviteExpiry(7)).toBe('2026-05-17T12:00:00.000Z');
  });
});
