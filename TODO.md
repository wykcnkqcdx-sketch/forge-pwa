# FORGE Refactor — Implementation Tracker

## Phase 1: Critical Fixes & Component Extraction

- [ ] 1. Fix mapUtils imports & move file to `utils/`
- [ ] 2. Update `package.json` with missing dependencies
- [ ] 3. Extract `components/SessionCard.tsx` from HomeScreen + AnalyticsScreen
- [ ] 4. Extract `components/SessionEditModal.tsx` from HomeScreen + AnalyticsScreen
- [ ] 5. Fix StyleSheet percentage type hacks (use inline styles for dynamic positions)
- [ ] 6. Split `data/mockData.ts` → `types/index.ts` + `data/mockData.ts`
- [ ] 7. Update all type imports across screens

## Phase 2: State Management Refactor

- [ ] 8. Create `contexts/DataContext.tsx` (sessions, members, CRUD, persistence)
- [ ] 9. Create `contexts/AuthContext.tsx` (PIN, lock, inactivity, duress wipe)
- [ ] 10. Refactor `App.tsx` to use contexts — strip out state/hooks
- [ ] 11. Update screens to consume contexts instead of prop drilling
- [ ] 12. Extract `hooks/useImportExport.ts` for backup/restore logic
- [ ] 13. Extract `hooks/usePanNavigation.ts` for swipe gesture handling

## Phase 3: Security & Data Hardening

- [ ] 14. Add `completedAt` timestamp to `TrainingSession`
- [ ] 15. Persist `FuelProfile` to AsyncStorage
- [ ] 16. Encrypt PIN storage (`expo-secure-store` native / Web Crypto web)
- [ ] 17. Add Zod schemas for import validation

## Phase 4: Polish & DevEx

- [ ] 18. Add ESLint + Prettier config
- [ ] 19. Add TypeScript path aliases (`@/components`, etc.)
- [ ] 20. Add basic unit tests for mapUtils and validators
- [ ] 21. Replace `DeviceEventEmitter` with custom EventEmitter

---

**Status:** Phase 1 in progress
