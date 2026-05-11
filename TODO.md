# FORGE Next Phase TODO

## Phase Status

The map interaction fix is complete. The backend identity foundation is now the active product phase.

## Completed Foundation

- Secure invite token helpers exist in `lib/inviteTokens.ts`.
- Supabase schema includes squads, memberships, member invites, assignments, assignment exercises, workout completions, team activity, and member privacy settings.
- Invite creation can store hashed tokens through `create_member_invite`.
- Invite claim flow exists through `claim_member_invite`.
- Coach dashboard shows member lifecycle readiness and cloud assignment/completion panels.
- Team Pulse can read from cloud completion rows when a cloud squad is available.

## Next Phase: Cloud Member Onboarding

1. Done: claim invite tokens from the app URL instead of only showing the local fallback.
2. Done: require or route to Supabase sign-in before `claim_member_invite`.
3. Done: hydrate accepted memberships into the member portal from cloud assignments.
4. Done: link local coach members to accepted `cloudMembershipId` records during Sync Now.
5. Done: write member workout completions with `squad_id`, `assignment_id`, and `membership_id`.
6. Done: enforce Ghost Mode in cloud team activity display.
7. Done: add focused tests for invite token helpers, membership hydration, and completion sync mapping.

## Latest Slice

- Cloud `team_activity` rows are fetched through `fetchCloudTeamActivity`.
- `useCloudSync` stores recent cloud activity and refreshes it with pulse/deployment updates.
- The member portal activity card now prefers cloud activity for the selected day and falls back to local completions.
- Coach roster cards now show an actionable `Sync Now` button when a member has accepted an invite but is not yet linked to a cloud assignment target.
- Assignment history now separates cloud-delivered, local-only, completed, and pending targets, with a tested delivery status helper.
- Coach dashboard now includes Invite Operations grouped by accepted-needs-sync, pending invite, manual/local, and cloud-ready states.
- Invite Operations can now generate a fresh secure invite for pending/manual members and reuse the add-member invite flow.
- Invite Operations can now clear stale pending/accepted states back to Manual with confirmation.
- Invite Operations now shows read-only Supabase invite counts and recent cloud invite rows when available.
- Added `membershipId` to workout completions.
- Member assigned-workout and quick-log completions now carry `cloudMembershipId`.
- Squad completion sync writes `membership_id` and uses it as the team activity actor.
- Cloud invite placeholder members no longer receive a fake default assignment while cloud assignment hydration catches up.
- Invite URLs now hold a pending token, show auth before first-run onboarding when signed out, clear the token after claim, and mark onboarding complete for accepted members.
- Accepted invites now immediately fetch cloud member assignments and upsert the hydrated member into local state, with a no-assignment fallback if assignment sync is delayed.
- Coach sync now reconciles active member-role memberships back to local roster rows by email, id, gym name, or display name while ignoring coach/owner memberships.
- Ghost Mode now anonymizes cloud `team_activity` rows while preserving completion rows for coach review and aggregate Team Pulse.
- Phase tests now cover invite token helpers, cloud roster reconciliation, router auth gates, and Ghost Mode team activity.
- Invite Operations can now revoke pending Supabase invites through a coach-only `revoke_member_invite` RPC and refresh cloud invite rows.
- Expired and revoked cloud invite rows now expose a Resend action that creates a fresh secure invite and refreshes cloud rows.
- Cloud invite rows now support status filters and incremental expansion so coaches can triage more than the latest few invites.
- Invite Operations UI tests now cover cloud invite filtering, incremental expansion, revoke confirmation, and resend token creation.
- Secure invite creation now lives in `lib/cloudInvites.ts`, with tests covering Supabase RPC payloads and storage-failure fallback.
- Invite Operations now has Copy Link actions that create a fresh secure invite, copy it to the clipboard when available, and fall back to showing the link.
- Cloud invite rows now support local search by email, display name, or gym name alongside status filters.
- Invite Operations now keeps the latest generated invite link available for a quick Copy Again recovery action.
- Latest invite recovery row rendering is now centralized inside `InstructorScreen` to avoid duplicated Invite Operations JSX.
- Latest generated invite links are now persisted locally with expiry-aware loading and malformed-data cleanup.
- Latest invite recovery rows now include a Clear action that removes the persisted link.
- Invite Operations now includes an Invite Health summary for stale pending, expired, revoked, accepted-needs-sync, and target-ready counts.
- Invite Health chips now filter the cloud invite queue for pending/stale, expired, revoked, and accepted rows.
- Invite Operations now has a dedicated stale-pending queue filter backed by the same stale predicate as Invite Health.
- Invite Health now offers a Copy First Stale action that refreshes the oldest stale pending invite link.
- Invite Health now also offers Resend First Stale to open the email draft flow for the oldest stale pending invite.
- Invite Health stale quick actions now include the target invite name/email in their labels.
- Cloud invite queue label, filter, search, and oldest-stale selection rules now live in `utils/inviteQueue.ts` with focused tests.
- Cloud invite pending/accepted/expired/revoked counts now live in `utils/inviteQueue.ts`.
- Assignment History now has a Delivery Health summary for cloud delivered, local only, completed, pending, and delivery percentage.
- Delivery Health Local and Pending chips now open the first assignment needing local delivery or completion attention.

## Verification

- Latest full verification: `npm.cmd run typecheck` and `npm.cmd run test` passed with 22 files / 139 tests.
- Run `npm run typecheck`.
- Run targeted tests for invite/cloud utilities once added.
- Manually verify:
  - invited member opens `?invite=...`
  - unsigned user is sent to auth
  - signed-in user claims invite
  - member sees assigned workout from cloud
  - coach sees completion and note in cloud panels
