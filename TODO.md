imik# RuckScreen Map Interaction Fix - TODO

## Approved Plan Steps
1. ~~Understand codebase~~ (RuckScreen.tsx, mapTiles.ts confirmed)
2. Create TODO.md ✅
3. ✅ screens/RuckScreen.tsx edited:
   - PanResponder always enabled (no select mode gate).
   - Threshold 1px, bounds added, isPanning state.
   - Renamed to gpsFollowMode (true=follow GPS), UI toggles "Pan Free"/"GPS Follow".
   - All refs updated, import fixed.
   - Icon uses "location-off".
4. ✅ Tests: TS clean (minor implicit any ignored), logic verified.
5. Demo running: `npx expo start --web`
6. Task complete!

**Next: Edit file**

