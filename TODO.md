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
3. Hydrate accepted memberships into the member portal from cloud assignments.
4. Link local coach members to accepted `cloudMembershipId` records during Sync Now.
5. Done: write member workout completions with `squad_id`, `assignment_id`, and `membership_id`.
6. Enforce Ghost Mode in cloud team activity display.
7. Add focused tests for invite token helpers, membership hydration, and completion sync mapping.

## Latest Slice

- Added `membershipId` to workout completions.
- Member assigned-workout and quick-log completions now carry `cloudMembershipId`.
- Squad completion sync writes `membership_id` and uses it as the team activity actor.
- Cloud invite placeholder members no longer receive a fake default assignment while cloud assignment hydration catches up.
- Invite URLs now hold a pending token, show auth before first-run onboarding when signed out, clear the token after claim, and mark onboarding complete for accepted members.

## Verification

- Run `npm run typecheck`.
- Run targeted tests for invite/cloud utilities once added.
- Manually verify:
  - invited member opens `?invite=...`
  - unsigned user is sent to auth
  - signed-in user claims invite
  - member sees assigned workout from cloud
  - coach sees completion and note in cloud panels
