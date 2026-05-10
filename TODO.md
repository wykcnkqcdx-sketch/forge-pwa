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
- Added `membershipId` to workout completions.
- Member assigned-workout and quick-log completions now carry `cloudMembershipId`.
- Squad completion sync writes `membership_id` and uses it as the team activity actor.
- Cloud invite placeholder members no longer receive a fake default assignment while cloud assignment hydration catches up.
- Invite URLs now hold a pending token, show auth before first-run onboarding when signed out, clear the token after claim, and mark onboarding complete for accepted members.
- Accepted invites now immediately fetch cloud member assignments and upsert the hydrated member into local state, with a no-assignment fallback if assignment sync is delayed.
- Coach sync now reconciles active member-role memberships back to local roster rows by email, id, gym name, or display name while ignoring coach/owner memberships.
- Ghost Mode now anonymizes cloud `team_activity` rows while preserving completion rows for coach review and aggregate Team Pulse.
- Phase tests now cover invite token helpers, cloud roster reconciliation, router auth gates, and Ghost Mode team activity.

## Verification

- Run `npm run typecheck`.
- Run targeted tests for invite/cloud utilities once added.
- Manually verify:
  - invited member opens `?invite=...`
  - unsigned user is sent to auth
  - signed-in user claims invite
  - member sees assigned workout from cloud
  - coach sees completion and note in cloud panels
