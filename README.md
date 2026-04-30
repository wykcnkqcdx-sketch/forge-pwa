# FORGE Tactical Fitness

FORGE Tactical Fitness is an Expo React Native / Progressive Web App prototype for tactical training, squad readiness, ruck load modelling, nutrition support, injury reporting, and coach-led member programming.

The product goal is to combine two worlds:

1. A **coach command dashboard** for planning, monitoring, and adjusting squad training.
2. A **member portal** that feels like a daily locker-room check-in rather than a dry logging tool.

The app is currently local-first with optional Supabase cloud sync. It can run as an Expo app, a web app, or a static PWA deployed to GitHub Pages.

## Table of Contents

- [Product Vision](#product-vision)
- [Current Status](#current-status)
- [Main Experiences](#main-experiences)
- [Feature Walkthrough](#feature-walkthrough)
- [Member Portal Details](#member-portal-details)
- [Coach Dashboard Details](#coach-dashboard-details)
- [Training Builder Logic](#training-builder-logic)
- [Ruck Modelling](#ruck-modelling)
- [Injury Reporting](#injury-reporting)
- [Data Storage and Privacy](#data-storage-and-privacy)
- [Supabase Cloud Sync](#supabase-cloud-sync)
- [Project Structure](#project-structure)
- [Setup](#setup)
- [Development Commands](#development-commands)
- [GitHub Pages Deployment](#github-pages-deployment)
- [Data Model Reference](#data-model-reference)
- [Known Limitations](#known-limitations)
- [Recommended Backend Roadmap](#recommended-backend-roadmap)
- [Troubleshooting](#troubleshooting)
- [Design Principles](#design-principles)

## Product Vision

FORGE is built around a simple tactical training loop:

```text
Coach assigns training -> Member completes it -> Team Pulse moves -> Coach adapts the next session
```

For coaches, the app should answer:

- Who is ready?
- Who is overloaded?
- Who needs review?
- What did the squad complete this week?
- What feedback did members give after training?
- Which assignments need changing?

For members, the app should answer:

- What am I doing today?
- How much do I need to think before starting?
- Did my work count toward the squad?
- Can I give quick feedback without writing a full training diary?
- Can I stay private if I do not want my name in the team feed?

The app is intentionally moving away from being only a utility. The member portal is designed to feel like a small daily experience: identity, progress, belonging, and low-friction logging.

## Current Status

This repository is a working prototype with:

- Local-first data persistence.
- Web/PWA export support.
- GitHub Pages deployment workflow.
- Optional Supabase authentication and sync.
- Coach dashboard.
- Member portal.
- Training builder.
- Ruck calculator/tracker.
- Readiness analytics.
- Body composition tools.
- Injury reporting body map.
- Local backup export/import.
- PIN lock and wipe support.

It is not yet a production multi-tenant coaching platform. The UI and local data flows are in place, but the backend needs a richer squad/invite/role schema before real team deployment across separate devices is secure and seamless.

## Main Experiences

### Coach Experience

The coach side lives primarily in:

```text
screens/InstructorScreen.tsx
```

Coach capabilities include:

- Add squad members.
- Assign a member a display/gym name.
- Invite a member by email draft.
- Create groups.
- Assign members to groups.
- Assign training blocks.
- Store coach-pinned exercises for a member assignment.
- View readiness, compliance, risk, load, notes, and assignments.
- Delete members.
- Export/import backup data.
- Configure PIN lock.
- Wipe local data.
- Monitor cloud sync state when Supabase is configured.

### Member Experience

The member side lives in:

```text
screens/MemberScreen.tsx
```

Member capabilities include:

- Open a personal portal link.
- See `Welcome back, [Gym Name]`.
- See streak/status badges.
- Toggle Ghost Mode.
- View current assigned workout.
- See coach-pinned exercises.
- Mark workout completion in one tap.
- Add a quick note for the coach.
- Move the squad Pulse immediately after completion.
- See recent teammate activity.
- Send a lightweight `Bump` to teammates.

### Training Experience

The training builder lives in:

```text
screens/TrainScreen.tsx
```

It supports:

- Training modes.
- Time targets.
- Exercise selection.
- Coach picks.
- Movement-pattern balance tips.
- Completion logging.

## Feature Walkthrough

### Home / Tactical Readiness

The home screen is the tactical overview.

File:

```text
screens/HomeScreen.tsx
```

It includes:

- Readiness score.
- Readiness status band.
- H2F-inspired physical domain cards.
- Loaded movement estimate.
- Body composition WHtR calculator.
- Injury report body map.
- Recent training load.

The readiness profile is built from recent sessions and load risk logic.

Related files:

```text
lib/performance.ts
lib/h2f.ts
lib/aiGuidance.ts
```

### Analytics / Intel

The analytics screen focuses on performance trends and readiness logs.

File:

```text
screens/AnalyticsScreen.tsx
```

It includes:

- Readiness metrics.
- Session analytics.
- Readiness log creation.
- Session editing/deleting.
- Risk/compliance style summaries.

### Fuel

The fuel screen estimates body metrics and nutrition/hydration targets.

File:

```text
screens/FuelScreen.tsx
```

It includes:

- Body weight.
- Height.
- Estimated body fat from skinfold.
- BMI.
- Calorie target.
- Protein target.
- Hydration target.
- Sleep/hydration style guidance.

### Ruck

The ruck screen supports load carriage planning and GPS route capture.

File:

```text
screens/RuckScreen.tsx
```

It includes:

- Body mass.
- Carried load.
- Speed.
- Grade.
- Terrain factor.
- Enhanced Pandolf-style metabolic estimate.
- Route tracking with Expo Location.
- Route persistence using AsyncStorage.

### Instructor / Coach

The instructor screen is the squad command center.

File:

```text
screens/InstructorScreen.tsx
```

It includes:

- Security and backup actions.
- Cloud status.
- Member count.
- Team score.
- AI coach guidance.
- Add team member.
- Create group.
- Wearable connection placeholders.
- Squad readiness member cards.
- Assignment panel.
- Programme builder placeholders.

### Member Portal

The member portal is intentionally simpler and more emotional than the coach dashboard.

File:

```text
screens/MemberScreen.tsx
```

It includes:

- Locker-room welcome.
- Status/streak badges.
- Readiness card.
- Ghost Mode toggle.
- Current workout card.
- One-tap effort buttons.
- Quick note.
- Team Pulse.
- Activity feed.
- Bump button.

## Member Portal Details

### Invite Link Format

Member links currently use:

```text
?member=<member-id>
```

Example:

```text
https://wykcnkqcdx-sketch.github.io/forge-pwa/?member=member-123
```

When the app loads, `App.tsx` reads the query parameter and opens the member portal:

```text
App.tsx -> activeMemberId -> MemberScreen
```

### Important Invite Limitation

The current invite link works when the app has access to the member record locally or through the current cloud snapshot.

For true separate-device onboarding, the app still needs:

- Invite tokens.
- A backend `member_invites` table.
- Role pinning.
- Member account claim flow.
- Row-level security for coach/member access.

### Locker Room Identity

Each member can have:

- `name`: formal or roster name.
- `gymName`: display name in the member portal.

The member portal prefers `gymName`, then falls back to `name`.

Example:

```ts
const displayName = member?.gymName || member?.name || 'Athlete';
```

### Status Badges

Status is currently derived from streak:

- `On Fire`: 5 or more streak days.
- `Active`: 2 or more streak days.
- `Ready`: default state.

This gives the member immediate identity feedback without needing a complex achievement system yet.

### Ghost Mode

Ghost Mode is a member privacy toggle.

When enabled:

- Their own portal still shows their data.
- The team Pulse still counts their contribution.
- The activity feed can anonymize them as `A teammate` for other members.

This is important because team motivation should not force public visibility.

### One-Tap Completion

The member does not need to enter every set or rep.

Completion options:

- `Too Easy`
- `About Right`
- `Too Hard`

Those effort choices adjust local readiness/load slightly:

- `Too Easy`: small readiness bump, low load increase.
- `About Right`: moderate progress.
- `Too Hard`: load increases more, readiness drops slightly.

The member can also add:

```text
How did this feel?
```

That note is saved to:

```ts
lastWorkoutNote
```

and appears on the coach dashboard member card.

### Team Pulse

The Pulse is the collective momentum layer.

Current logic:

- Weekly team goal: `10,000` volume units.
- Member completion adds planned volume.
- Progress bar updates immediately.
- Recent activity feed updates from member completion data.
- Bump action increments `hypeCount`.

Current Pulse fields live on `SquadMember`:

- `weeklyVolume`
- `lastWorkoutTitle`
- `lastWorkoutAt`
- `hypeCount`

This is intentionally optimistic. In a production backend, completions should be separate rows in a `workout_completions` table.

## Coach Dashboard Details

### Adding a Member

The coach can add:

- Name/callsign.
- Gym name.
- Email.
- Group.

If email is provided, the app creates a `mailto:` draft with a portal link.

Current behavior:

- Member is added immediately.
- `inviteStatus` becomes `Invited`.
- Email app opens if the browser/device supports `mailto:`.
- If no mail client is configured, the coach can copy the shown invite link.

Important:

The app does not send email from a backend service yet.

### Assigning Training

Coach assignment flow:

1. Open `Assign`.
2. Select member.
3. Select group.
4. Select training block.
5. Apply assignment.

Assignment updates:

- `groupId`
- `assignment`
- `pinnedExerciseIds`

`pinnedExerciseIds` come from the selected training mode's `coachPinnedExerciseIds`.

### Deleting Members

The delete flow uses a web-safe confirmation path. This was added because native `Alert.alert` callbacks are not always reliable in React Native Web/PWA builds.

On web:

```ts
window.confirm(...)
```

On native:

```ts
Alert.alert(...)
```

### Wipe Data

The wipe flow clears:

- sessions
- members
- groups
- readiness logs
- PIN
- active member portal mode
- local secure storage keys

On web, the wipe confirmation uses `window.confirm`.

## Training Builder Logic

### Training Modes

Training modes are defined in:

```text
data/mockData.ts
```

Current modes:

- Strength
- Resistance
- Cardio
- Workout
- Elite

Each mode includes:

- `key`
- `type`
- `label`
- `title`
- `icon`
- `tone`
- `rpe`
- `score`
- `coach`
- `defaultExerciseIds`
- `coachPinnedExerciseIds`
- optional `unlockLevel`

### Exercise Library

Exercises include:

- `id`
- `name`
- `category`
- optional `pattern`
- `dose`
- `guidance`
- `cues`

Categories:

- Strength
- Resistance
- Cardio
- Workout
- Mobility

Movement patterns:

- Push
- Pull
- Legs
- Carry
- Core
- Conditioning
- Mobility

`pattern` is optional for backward compatibility. If missing, the training screen derives a fallback.

### Duration to Exercise Count

The time target controls the recommended exercise count:

```text
20 min -> 3 exercises
30 min -> 4 exercises
45 min -> 5 exercises
60 min -> 7 exercises
```

This is implemented in:

```text
screens/TrainScreen.tsx
```

Function:

```ts
targetCountForMinutes(minutes)
```

### Selection Status

Members are not blocked from adding more exercises.

Instead, the app changes guidance:

- Green: selection fits the time target.
- Amber: selection may run long.
- Red: selection is likely too dense.

This creates guidance without removing member agency.

### Coach Picks

Coach-pinned exercises:

- Sort to the top of the library.
- Show a `Coach's Pick` badge.
- Cannot be removed from the selected list.
- Appear in the member portal workout.

### Balance Tips

Balance tips are based on movement patterns.

Examples:

- Too much push and no pull:

  ```text
  Balance tip: add a pull movement to offset pressing volume.
  ```

- Too much pull and no push:

  ```text
  Balance tip: add a push movement so the session is not all pulling.
  ```

- Heavy leg density:

  ```text
  Balance tip: lots of legs today. Consider core or mobility if fatigue climbs.
  ```

## Ruck Modelling

Ruck logic is handled in:

```text
lib/h2f.ts
screens/RuckScreen.tsx
```

The model considers:

- body mass
- carried load
- load/body ratio
- speed
- grade
- terrain factor

The app distinguishes between:

- simple navigation time estimates
- loaded movement/metabolic load estimates

Route data can include:

- latitude
- longitude
- altitude
- accuracy
- timestamp

Type:

```ts
TrackPoint
```

## Injury Reporting

The injury reporting UI uses:

```text
components/BodyMap.tsx
```

It supports:

- anterior view
- posterior view
- 74 total CHOIR-style segments
- selected segment state
- pain intensity map
- active segment count
- hotspot list

Pain intensity is color-coded:

- 0: muted/low
- 1-3: green
- 4-6: amber
- 7-8: orange
- 9-10: red

The body map uses a separate `Pressable` hit layer over the SVG drawing. This improves selection reliability on web/PWA builds where SVG press events can be inconsistent.

## Data Storage and Privacy

The app is local-first by default.

### Local Keys

Current local storage keys:

```text
forge:sessions
forge:members
forge:groups
forge:readiness_logs
forge:pin
forge:local_crypto_secret
forge:ruck_route
```

### Secure Storage

File:

```text
lib/secureStorage.ts
```

Behavior:

- On web with IndexedDB, the app uses Dexie.
- Sensitive values are stored through `dexie-encrypted`.
- On native/fallback, the app uses AsyncStorage.

### PIN Lock

PIN behavior:

- User can set a 4-8 digit PIN.
- PIN lock protects the local app after unlock timeout.
- `0000` is reserved as a duress wipe code and cannot be used as the saved PIN.

### OPSEC Wipe

Wipe clears in-memory state and local storage.

It is intentionally local. If cloud sync is configured, a full production wipe policy would also need a clear cloud-delete or cloud-disconnect decision.

## Supabase Cloud Sync

Supabase is optional.

File:

```text
lib/supabase.ts
```

Environment variables:

```sh
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

If both are present:

- Supabase client is created.
- Auth screen is shown when not signed in.
- Local data can hydrate from remote.
- Local changes can push to remote.

If not present:

- The app stays in local-only mode.

### Current Remote Tables

Schema file:

```text
supabase/schema.sql
```

Current tables:

- `training_sessions`
- `squad_members`

### Current RLS

Current row-level security is owner-private:

```sql
auth.uid() = user_id
```

This is enough for personal backup-style sync but not enough for production team sharing.

### Current Cloud Sync Shape

File:

```text
lib/cloud.ts
```

It maps:

- app sessions to `training_sessions`
- app squad members to `squad_members`

Current snapshot sync:

- fetch sessions and members for the signed-in user
- if remote has records, hydrate local state
- otherwise push local snapshot
- later local changes debounce and push to remote

## Project Structure

```text
.
├── App.tsx
├── README.md
├── app.config.js
├── app.json
├── index.html
├── package.json
├── tsconfig.json
├── data/
│   ├── domain.ts
│   └── mockData.ts
├── components/
│   ├── BodyMap.tsx
│   ├── Card.tsx
│   ├── MetricCard.tsx
│   ├── ProgressBar.tsx
│   ├── Screen.tsx
│   ├── SessionCard.tsx
│   ├── SessionCard1.tsx
│   └── SessionEditModal.tsx
├── lib/
│   ├── aiGuidance.ts
│   ├── cloud.ts
│   ├── h2f.ts
│   ├── performance.ts
│   ├── secureStorage.ts
│   └── supabase.ts
├── screens/
│   ├── AnalyticsScreen.tsx
│   ├── AuthScreen.tsx
│   ├── FuelScreen.tsx
│   ├── HomeScreen.tsx
│   ├── InstructorScreen.tsx
│   ├── MemberScreen.tsx
│   ├── RuckScreen.tsx
│   ├── TrainScreen.tsx
│   └── readiness.test.ts
├── supabase/
│   └── schema.sql
├── public/
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/
├── utils/
│   ├── mapUtils.ts
│   └── styling.ts
└── .github/
    └── workflows/
        └── deploy-pages.yml
```

## Setup

### Requirements

- Node.js
- npm
- Expo-compatible environment

The GitHub Pages workflow currently uses:

```text
Node 24
```

### Install Dependencies

For normal local development:

```sh
npm install
```

For CI-equivalent install:

```sh
npm ci
```

### Start Expo

```sh
npm start
```

### Start Web Development Server

```sh
npm run web
```

### Export Static Web App

```sh
npm run export:web
```

This writes output to:

```text
dist/
```

### Serve Static Export Locally

```sh
npm run serve:web
```

Then open:

```text
http://127.0.0.1:8080
```

## Development Commands

```sh
npm run start       # Start Expo
npm run android     # Start Expo for Android
npm run ios         # Start Expo for iOS
npm run web         # Start Expo web dev target
npm run typecheck   # TypeScript check
npm run export:web  # Static web export
npm run serve:web   # Serve dist on 127.0.0.1:8080
```

## GitHub Pages Deployment

Workflow:

```text
.github/workflows/deploy-pages.yml
```

Triggers:

- push to `main`
- manual workflow dispatch

Workflow steps:

1. Checkout repository.
2. Setup Node.
3. Run `npm ci`.
4. Run `npm run typecheck`.
5. Configure GitHub Pages.
6. Export the web app.
7. Upload `dist`.
8. Deploy Pages artifact.

The export step uses:

```sh
EXPO_BASE_URL=/forge-pwa npm run export:web
```

`app.config.js` reads `EXPO_BASE_URL` and passes it into Expo experiments config so generated web assets work under the GitHub Pages subpath.

## Data Model Reference

### TrainingSession

Defined in:

```text
data/domain.ts
```

Fields:

```ts
type TrainingSession = {
  id: string;
  type: 'Ruck' | 'Strength' | 'Resistance' | 'Cardio' | 'Workout' | 'Run' | 'Mobility';
  title: string;
  score: number;
  durationMinutes: number;
  rpe: number;
  loadKg?: number;
  routePoints?: TrackPoint[];
  completedAt?: string;
};
```

### TrackPoint

```ts
type TrackPoint = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
};
```

### ReadinessLog

```ts
type ReadinessLog = {
  id: string;
  date: string;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  soreness: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  hydration: 'Poor' | 'Adequate' | 'Optimal';
  restingHR?: number;
  hrv?: number;
};
```

### SquadMember

Defined in:

```text
data/mockData.ts
```

Fields:

```ts
type SquadMember = {
  id: string;
  name: string;
  gymName?: string;
  email?: string;
  groupId: string;
  readiness: number;
  compliance: number;
  risk: 'Low' | 'Medium' | 'High';
  load: number;
  inviteStatus?: 'Manual' | 'Invited' | 'Joined';
  assignment?: string;
  pinnedExerciseIds?: string[];
  ghostMode?: boolean;
  streakDays?: number;
  weeklyVolume?: number;
  lastWorkoutTitle?: string;
  lastWorkoutAt?: string;
  lastWorkoutNote?: string;
  hypeCount?: number;
};
```

### TrainingGroup

```ts
type TrainingGroup = {
  id: string;
  name: string;
  focus: string;
  targetScore: number;
};
```

### Exercise

```ts
type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  pattern?: MovementPattern;
  dose: string;
  guidance: string;
  cues: string[];
};
```

`pattern` is optional for compatibility with older data.

### TrainingMode

```ts
type TrainingMode = {
  key: string;
  type: TrainingSession['type'];
  label: string;
  title: string;
  icon: TrainingModeIcon;
  tone: string;
  rpe: number;
  score: number;
  coach: string;
  defaultExerciseIds: string[];
  coachPinnedExerciseIds?: string[];
  unlockLevel?: number;
};
```

## Known Limitations

### Invite System

Current invite links are not secure production invite tokens yet.

They currently use:

```text
?member=<member-id>
```

This is fine for prototype routing, but production needs:

- random invite tokens
- expiration
- accepted/revoked state
- role assignment
- backend claim flow

### Email Sending

The app currently opens a `mailto:` draft.

It does not:

- send email through a server
- track email delivery
- track invite opens
- resend invites automatically

### Multi-Device Team Sharing

The UI is ready for team sharing, but the backend is not complete.

Current Supabase sync is owner-private. A real team deployment needs a squad-level schema where:

- coaches own squads
- members belong to squads
- assignments are shared
- completions are member-owned
- aggregate progress can be read by squad members

### Role Pinning

The app does not yet pin roles into Supabase auth metadata.

Production should ensure:

- invite claim sets role to `member`
- coach accounts have `coach` role
- UI and RLS both enforce role boundaries

### Activity Feed

The activity feed currently derives recent activity from fields on `SquadMember`.

Production should use an append-only table:

```text
team_activity
```

or:

```text
workout_completions
```

### Team Pulse

Pulse currently uses optimistic local state.

Production should compute weekly team progress from completion rows.

## Recommended Backend Roadmap

### Tables

Recommended next tables:

```sql
squads
squad_memberships
member_invites
assignments
assignment_exercises
workout_completions
team_activity
member_privacy_settings
```

### squads

Purpose:

- represents a coach-owned team/squad

Suggested columns:

- `id`
- `coach_user_id`
- `name`
- `created_at`

### squad_memberships

Purpose:

- connects users to squads
- stores role and display identity

Suggested columns:

- `id`
- `squad_id`
- `user_id`
- `role`
- `display_name`
- `gym_name`
- `ghost_mode`
- `created_at`

Roles:

- `coach`
- `member`

### member_invites

Purpose:

- secure invite claim flow

Suggested columns:

- `id`
- `squad_id`
- `email`
- `gym_name`
- `token_hash`
- `role`
- `expires_at`
- `accepted_at`
- `revoked_at`
- `created_by`

Important:

Store token hashes, not raw tokens.

### assignments

Purpose:

- current and historical programming

Suggested columns:

- `id`
- `squad_id`
- `member_id`
- `training_mode`
- `title`
- `target_minutes`
- `status`
- `starts_on`
- `due_on`
- `created_by`

### assignment_exercises

Purpose:

- detailed assigned workout contents

Suggested columns:

- `id`
- `assignment_id`
- `exercise_id`
- `position`
- `dose`
- `is_pinned`

### workout_completions

Purpose:

- member logging history

Suggested columns:

- `id`
- `assignment_id`
- `member_id`
- `effort`
- `note`
- `volume`
- `completed_at`

### team_activity

Purpose:

- recent feed and social proof

Suggested columns:

- `id`
- `squad_id`
- `member_id`
- `type`
- `title`
- `metadata`
- `created_at`

### RLS Direction

Coach should:

- read/write squads they own
- read/write member assignments in their squads
- read member completion notes in their squads

Member should:

- read their own assignment
- write their own completion
- read team aggregate Pulse
- read visible teammate activity
- not read private notes for other members
- not access coach admin tools

Ghost Mode should:

- keep contribution in aggregates
- hide member identity from feed entries for other members

## Troubleshooting

### GitHub Pages Typecheck Fails on `pattern`

If CI says exercises are missing `pattern`, ensure:

- `Exercise.pattern` is optional.
- `TrainScreen.tsx` uses `getExercisePattern(exercise)`.
- The branch includes the latest `data/mockData.ts`.

### Web Button Opens Nothing

Some React Native `Alert.alert` callbacks are unreliable on web/PWA. For destructive or critical web actions, use:

```ts
window.confirm(...)
window.alert(...)
```

This has already been applied to:

- member delete
- data wipe
- member assignment feedback

### Body Map Cannot Select Segments

The body map uses an SVG drawing plus a standard `Pressable` hit layer. If selection fails:

- check `components/BodyMap.tsx`
- ensure the hit layer is rendered above the SVG
- ensure SVG uses `pointerEvents="none"`

### Member Invite Opens Coach View

Check that the URL includes:

```text
?member=<member-id>
```

Also check that the local/cloud member list contains that member id.

### Static Assets Broken on GitHub Pages

Check:

```text
app.config.js
.github/workflows/deploy-pages.yml
```

The workflow should export with:

```sh
EXPO_BASE_URL=/forge-pwa
```

### Supabase Login Not Showing

The auth screen only appears when both env vars are present:

```sh
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

If they are missing, the app intentionally runs local-only.

## Design Principles

### Member Portal

Member UI should be:

- mobile-first
- dark by default
- easy to tap with one hand
- minimal typing
- focused on today's workout
- emotionally rewarding
- privacy-aware

Avoid:

- dense tables
- multi-month programme views
- forms that feel like homework
- forcing public visibility

### Coach Dashboard

Coach UI can be denser because coaches need oversight.

Coach UI should prioritize:

- scanability
- group/member comparison
- risk flags
- assignment speed
- notes from members
- backup and control tools

### Training Builder

Training builder should guide without blocking.

The app should:

- recommend volume based on time
- warn when overloaded
- let members exceed recommendations
- protect coach-pinned exercises
- suggest balance improvements

## Testing and Verification

Before pushing:

```sh
npm run typecheck
```

Before deploying static web:

```sh
npm run export:web
```

For local static preview:

```sh
npm run serve:web
```

Then open:

```text
http://127.0.0.1:8080
```

## Product Direction

Near-term focus:

1. Real invite-token flow.
2. Member role pinning.
3. Squad-scoped Supabase schema.
4. Assignment/completion tables.
5. Coach view of member notes and completion history.
6. Team Pulse from backend aggregates.
7. Safer Ghost Mode enforcement.

Longer-term ideas:

- Health Connect / Apple Health integrations.
- Garmin, Fitbit, Strava, Oura, Whoop integrations.
- Coach-authored training blocks.
- More detailed exercise prescriptions.
- Injury trend reports.
- Load management alerts.
- Offline-first sync conflict handling.
- Push notifications for assigned training.
- PR tracking.
- Team challenges.

## Summary

FORGE is a tactical fitness PWA prototype that already covers:

- readiness
- training
- ruck modelling
- injury reports
- coach assignment
- member workout completion
- team Pulse
- local backup
- optional cloud sync

The current architecture is intentionally simple and local-first. The next major leap is backend identity: real squads, invite tokens, role-pinned member accounts, and row-level security that makes the coach/member boundary real beyond the UI.

The product loop to protect is:

```text
Open app -> see today's assignment -> finish in one tap -> add optional note -> team Pulse moves -> coach adapts training
```
