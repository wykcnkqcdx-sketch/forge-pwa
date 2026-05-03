import 'react-native-gesture-handler';
import './lib/backgroundTasks'; // Register background tasks globally for headless execution
import React from 'react';
import { AppProviders } from './components/AppProviders';
import { AppRouter } from './components/AppRouter';

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
    right: 10,
    bottom: 14,
    zIndex: 40,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 7,
    borderRadius: 24, borderWidth: 1, borderColor: colours.border,
    backgroundColor: 'rgba(4, 8, 15, 0.94)', overflow: 'hidden',
  },
  tabBarHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: colours.borderGlass },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: touchTarget, borderRadius: 20 },
  tabItemPressed: { opacity: 0.70 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colours.cyan, borderRadius: 18, paddingHorizontal: 7, paddingVertical: 7, ...shadow.cyan },
  activePillLabel: { color: colours.background, fontSize: 9, fontWeight: '900', letterSpacing: 0.2 },
  inactiveItem: { alignItems: 'center', gap: 3 },
  inactiveLabel: { color: colours.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0 },
  lockScreen: { flex: 1, backgroundColor: colours.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  lockContent: { alignItems: 'center', width: '100%', maxWidth: 320 },
  brand: { color: colours.cyan, fontSize: 24, fontWeight: '900', letterSpacing: 4, marginBottom: 8 },
  lockSub: { color: colours.muted, fontSize: 14, textAlign: 'center', marginBottom: 32 },
  pinWrapper: { position: 'relative', width: 240, height: 64, marginBottom: 16 },
  pinDisplay: { flexDirection: 'row', justifyContent: 'space-between', height: '100%' },
  pinBox: { width: 50, height: 64, borderWidth: 2, borderColor: colours.border, borderRadius: 12, backgroundColor: 'rgba(2, 5, 8, 0.58)', alignItems: 'center', justifyContent: 'center' },
  pinBoxFilled: { borderColor: colours.cyan },
  pinDot: { color: colours.cyan, fontSize: 32 },
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 },
  pinErrorText: { color: colours.red, fontSize: 12, fontWeight: '700', minHeight: 16 },
  pinSetupOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.62)' },
  pinSetupPanel: { borderWidth: 1, borderColor: colours.border, borderRadius: 20, padding: 18, backgroundColor: colours.surface },
  pinSetupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  pinSetupKicker: { color: colours.cyan, fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  pinSetupTitle: { color: colours.text, fontSize: 24, fontWeight: '900', marginTop: 3 },
  pinSetupClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  pinSetupCopy: { color: colours.muted, fontSize: 13, lineHeight: 19, marginTop: 10, marginBottom: 14 },
  pinSetupInput: { borderWidth: 1, borderColor: colours.borderSoft, borderRadius: 14, color: colours.text, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, fontSize: 16, fontWeight: '800' },
  pinSetupError: { minHeight: 18, color: colours.red, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  pinSetupButton: { alignItems: 'center', backgroundColor: colours.cyan, borderRadius: 16, paddingVertical: 13 },
  pinSetupButtonText: { color: colours.background, fontSize: 15, fontWeight: '900' },
});
