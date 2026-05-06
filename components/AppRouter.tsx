import React from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HomeScreen } from '../screens/HomeScreen';
import { ReadinessScreen } from '../screens/ReadinessScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { RuckScreen } from '../screens/RuckScreen';
import { TrainScreen } from '../screens/TrainScreen';
import { FuelScreen } from '../screens/FuelScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import * as Haptics from 'expo-haptics';
import { SplashScreen } from './SplashScreen';
import { PinScreen } from './PinScreen';
import { PinSetupModal } from './PinSetupModal';
import { Toast } from './Toast';
import { TabBar } from './TabBar';
import { useApp } from './AppProviders';
import { isSupabaseConfigured } from '../lib/supabase';

export function AppRouter() {
  const {
    // Store data
    sessions, members, groups, programmeTemplates, readinessLogs, workoutCompletions,
    googleSheetsEndpoint, isReady, hasSeenOnboarding, savedPin,

    // Store
    store,

    // Navigation
    navigation,

    // Actions
    actions,

    // UI state
    pendingSyncCount,

    // Hooks
    toast, cloud, pin,

    // Animations
    slideAnim, fadeAnim, pulseAnim, typedText,

    // Constants
    tabs, memberTabs, COACH_SELF,

    // Pan responder
    panResponder,
  } = useApp();

  // ── Tab navigation ────────────────────────────────────────────────────────
  function switchTab(newTab: typeof navigation.activeTab) {
    if (navigation.activeTab !== newTab) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.setActiveTab(newTab);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  function renderScreen() {
    switch (navigation.activeTab) {
      case 'train': return <TrainScreen addSession={actions.addSession} sessions={sessions} />;
      case 'ruck':  return <RuckScreen addSession={actions.addSession} sessions={sessions} />;
      case 'fuel':  return <FuelScreen sessions={sessions} readinessLogs={readinessLogs} />;
      case 'analytics':
        return (
          <AnalyticsScreen
            sessions={sessions}
            readinessLogs={readinessLogs}
            addReadinessLog={actions.addReadinessLog}
            deleteSession={actions.deleteSession}
            editSession={actions.editSession}
          />
        );
      case 'readiness':
        return (
          <ReadinessScreen
            member={COACH_SELF}
            readinessLogs={readinessLogs}
            onSubmitReadiness={actions.addReadinessLog}
            onCompleteCheckIn={() => switchTab('home')}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            pinEnabled={Boolean(savedPin)}
            sessions={sessions}
            members={members}
            groups={groups}
            programmeTemplates={programmeTemplates}
            readinessLogs={readinessLogs}
            workoutCompletions={workoutCompletions}
            onSetPin={pin.handleSetPin}
            onWipe={pin.handleManualWipe}
            onExport={actions.exportData}
            onImport={actions.importData}
            onAddMember={actions.addMember}
            onDeleteMember={actions.deleteMember}
            onUpdateMember={actions.updateMember}
            onAddGroup={actions.addGroup}
            onAddProgrammeTemplate={actions.addProgrammeTemplate}
            onDeleteProgrammeTemplate={actions.deleteProgrammeTemplate}
            cloudEnabled={isSupabaseConfigured}
            cloudStatus={cloud.cloudStatus}
            cloudEmail={cloud.cloudSession?.user.email ?? null}
            pendingSyncCount={pendingSyncCount}
            onCloudSync={cloud.syncCloudNow}
            onCloudSignOut={cloud.signOutCloud}
            googleSheetsEndpoint={googleSheetsEndpoint}
            onChangeGoogleSheetsEndpoint={store.setGoogleSheetsEndpoint}
            onExportGoogleSheets={() => cloud.exportGoogleSheetsNow(members, groups, programmeTemplates)}
            googleSheetsExporting={cloud.googleSheetsExporting}
            googleSheetsMessage={cloud.googleSheetsMessage}
          />
        );
      default:
        return (
          <HomeScreen
            sessions={sessions}
            goToRuck={() => switchTab('ruck')}
            goToAnalytics={() => switchTab('analytics')}
            goToFuel={() => switchTab('fuel')}
            goToTrain={() => switchTab('train')}
            goToReadiness={() => switchTab('readiness')}
            readinessLogs={readinessLogs}
            workoutCompletions={workoutCompletions}
          />
        );
    }
  }

  function renderMemberScreen(activeMember: typeof members[0] | null) {
    const memberSessions = sessions.filter((s) => !activeMember || !s.id.startsWith('member-') || s.id.includes(activeMember.id));
    const visibleSessions = memberSessions.length ? memberSessions : sessions;

    switch (navigation.activeMemberTab) {
      case 'train': return <TrainScreen addSession={actions.addSession} sessions={visibleSessions} />;
      case 'ruck':  return <RuckScreen addSession={actions.addSession} sessions={visibleSessions} />;
      case 'fuel':  return <FuelScreen sessions={visibleSessions} readinessLogs={readinessLogs} />;
      case 'readiness':
        return (
          <ReadinessScreen
            member={activeMember ?? members[0]}
            readinessLogs={readinessLogs}
            onSubmitReadiness={actions.addReadinessLog}
            onUpdateMember={actions.updateMember}
            onCompleteCheckIn={() => navigation.setActiveMemberTab('train')}
          />
        );
      default:
        return (
          <HomeScreen
            member={activeMember}
            sessions={visibleSessions}
            goToRuck={() => navigation.setActiveMemberTab('ruck')}
            goToAnalytics={() => navigation.setActiveMemberTab('train')}
            goToFuel={() => navigation.setActiveMemberTab('fuel')}
            goToTrain={() => navigation.setActiveMemberTab('train')}
            goToReadiness={() => navigation.setActiveMemberTab('readiness')}
            readinessLogs={readinessLogs}
            workoutCompletions={workoutCompletions}
            secondaryActionLabel="Training"
          />
        );
    }
  }

  // ── Render gates ──────────────────────────────────────────────────────────
  if (!isReady || !cloud.authReady) {
    return <SplashScreen pulseAnim={pulseAnim} typedText={typedText} />;
  }

  if (!hasSeenOnboarding) {
    return <OnboardingScreen onComplete={actions.completeOnboarding} />;
  }

  if (isSupabaseConfigured && !cloud.cloudSession) {
    return <AuthScreen loading={cloud.authLoading} error={cloud.authError} onSignIn={cloud.signInWithEmail} onSignUp={cloud.signUpWithEmail} />;
  }

  if (savedPin && !pin.isUnlocked) {
    const pinLength = Math.max(4, savedPin.length);
    return (
      <PinScreen
        pinLength={pinLength}
        pinInput={pin.pinInput}
        pinError={pin.pinError}
        onPinInput={pin.handlePinInput}
      />
    );
  }

  if (navigation.activeMemberId) {
    const activeMember = members.find((m) => m.id === navigation.activeMemberId) ?? null;
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.app}>
          <View style={styles.screenContainer}>{renderMemberScreen(activeMember)}</View>
          <Toast message={toast.toastMessage} animation={toast.toastAnim} />
          <TabBar
            tabs={memberTabs}
            activeTab={navigation.activeMemberTab}
            onTabPress={(newTab) => {
              if (navigation.activeMemberTab !== newTab) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.setActiveMemberTab(newTab);
              }
            }}
          />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.app} {...panResponder.panHandlers}>
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
          {renderScreen()}
        </Animated.View>

        <Toast message={toast.toastMessage} animation={toast.toastAnim} />

        {pin.pinSetupMode && (
          <PinSetupModal
            mode={pin.pinSetupMode}
            newPinInput={pin.newPinInput}
            confirmPinInput={pin.confirmPinInput}
            error={pin.pinSetupError}
            onNewPinChange={(v) => pin.setNewPinInput(v.replace(/[^0-9]/g, ''))}
            onConfirmPinChange={(v) => pin.setConfirmPinInput(v.replace(/[^0-9]/g, ''))}
            onSave={pin.savePinSetup}
            onClose={pin.closePinSetup}
          />
        )}

        <TabBar
          tabs={tabs}
          activeTab={navigation.activeTab}
          onTabPress={switchTab}
        />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#121212' },
  screenContainer: { flex: 1 },
});