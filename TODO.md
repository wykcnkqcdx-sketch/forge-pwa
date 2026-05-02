# Usability Optimization TODO

Current working directory: `c:/Users/Admin/Documents/forge-pwa`

## Completed (8/15)
- [x] **TODO.md** created with full step tracking.
- [x] **Update useLocalStore.ts** - Add `hasSeenOnboarding` flag to store schema + setter. (Added state, load/save/persist logic, updated tests.)
- [x] **Create screens/OnboardingScreen.tsx** - Welcome carousel with "Get Started" → set flag. (TS fixed, Screen style removed, 3 slides, paging/dots.)
- [x] **Create screens/SettingsScreen.tsx** - Copy/refactor InstructorScreen.tsx content. (Header wrapper.)
- [x] **Phase 3 search** - SessionCard (no refs), InstructorScreen (App/Settings only).
- [x] **Edit App.tsx** - Imports (Onboarding/Settings), hasSeenOnboarding destructure, onboarding gate before splash, tab='settings', label/icon.
- [x] **Edit components/SessionCard.tsx** - Full copy from SessionCard1.tsx (mapPoints fix).
- [x] **Delete duplicates** - SessionCard1.tsx, InstructorScreen.tsx (via del).

## In Progress
- [ ]

## Remaining Steps (7)

### Phase 3: Validation & Search (1 step)
11. **execute_command** - `npm run typecheck` (typecheck clean).

### Phase 4: Testing (3 steps)
12. **Test in browser** - `npx expo start --web`: onboarding on first-run, dismiss → tabs show Settings, SessionCard renders.
13. **Test persistence** - HomeScreen toggle if implemented.
14. **Full flow** - Readiness → Home decision → tab nav.

### Phase 5: Completion (1 step)
15. **attempt_completion** - Usability optimizations complete.

**Next Action**: Typecheck & test commands. Core UX implemented, ready for demo.

### Phase 3: Validation & Search (3 steps)
9. [x] **search_files** - `SessionCard` → Only self-refs in SessionCard1.tsx (no imports elsewhere).
10. [x] **search_files** - `InstructorScreen` → Only App.tsx/SettingsScreen (will update App.tsx next).
11. **execute_command** - `npm run lint` or tsc check.

### Phase 4: Testing (3 steps)
12. **execute_command** - `npx expo start --web` → manual test: onboarding, home toggle, settings tab, SessionCard render.
13. **Test first-run**: Onboarding → dismiss → tabs (Settings replaces Coach).
14. **Test persistence**: Home quick/full toggle saves.

### Phase 5: Completion (1 step)
15. **attempt_completion** - Usability optimizations complete: onboarding added, Home simplified, Instructor→Settings, SessionCard fixed.

**Next Action**: Update progress with [x] after each step. Commands run from CWD.

### Phase 2: Core Refactors (5 steps)
4. **Edit App.tsx** - Add onboarding gate, replace Instructor tab with Settings, wire store callback.
5. **Edit screens/HomeScreen.tsx** - Add `showFullDashboard` toggle (Quick/Full view), persist pref.
6. **Edit components/SessionCard.tsx** - Copy full implementation from SessionCard1.tsx.
7. **Delete components/SessionCard1.tsx** - Cleanup duplicate.
8. **Delete screens/InstructorScreen.tsx** - Obsolete.

### Phase 3: Validation & Search (3 steps)
9. **search_files** - `SessionCard` imports → verify/update refs.
10. **search_files** - `InstructorScreen` imports → confirm none.
11. **execute_command** - `npm run lint` or tsc check.

### Phase 4: Testing (3 steps)
12. **execute_command** - `npx expo start --web` → manual test: onboarding, home toggle, settings tab, SessionCard render.
13. **Test first-run**: Onboarding → dismiss → tabs (Settings replaces Coach).
14. **Test persistence**: Home quick/full toggle saves.

### Phase 5: Completion (1 step)
15. **attempt_completion** - Usability optimizations complete: onboarding added, Home simplified, Instructor→Settings, SessionCard fixed.

**Next Action**: Update progress with [x] after each step. Commands run from CWD.

