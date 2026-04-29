import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { encodePin, getPinLength, verifyPin } from '../lib/pin';

type PinSetupMode = 'set' | 'change' | null;

type Params = {
  savedPinEncoded: string | null;
  setSavedPinEncoded: (v: string | null) => void;
  wipeData: () => void;
};

export function usePinLock({ savedPinEncoded, setSavedPinEncoded, wipeData }: Params) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinSetupMode, setPinSetupMode] = useState<PinSetupMode>(null);
  const [newPinInput, setNewPinInputRaw] = useState('');
  const [confirmPinInput, setConfirmPinInputRaw] = useState('');
  const [pinSetupError, setPinSetupError] = useState('');
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wipeInProgress = useRef(false);

  const pinEnabled = savedPinEncoded !== null;
  const pinLength = savedPinEncoded ? getPinLength(savedPinEncoded) : 4;

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (savedPinEncoded && isUnlocked) {
      inactivityTimer.current = setTimeout(() => setIsUnlocked(false), 3 * 60 * 1000);
    }
  }, [savedPinEncoded, isUnlocked]);

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [resetInactivityTimer]);

  function executeDuressWipe() {
    if (wipeInProgress.current) return;
    wipeInProgress.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // Brief delay so an accidental "0000" can be noticed before data is destroyed.
    setTimeout(() => {
      wipeData();
      setSavedPinEncoded(null);
      setIsUnlocked(true);
      setPinInput('');
      wipeInProgress.current = false;
      Alert.alert('OPSEC WIPE', 'All local data has been permanently destroyed.');
    }, 800);
  }

  async function handlePinInput(val: string) {
    const numericVal = val.replace(/[^0-9]/g, '');
    setPinInput(numericVal);
    setPinError(false);

    if (numericVal === '0000') {
      executeDuressWipe();
      return;
    }

    if (savedPinEncoded && numericVal.length === getPinLength(savedPinEncoded)) {
      const correct = await verifyPin(numericVal, savedPinEncoded);
      if (correct) {
        setIsUnlocked(true);
        setPinInput('');
      } else {
        setPinError(true);
        setTimeout(() => setPinInput(''), 300);
      }
    }
  }

  function openPinSetup() {
    setNewPinInputRaw('');
    setConfirmPinInputRaw('');
    setPinSetupError('');
    setPinSetupMode(savedPinEncoded ? 'change' : 'set');
  }

  function closePinSetup() {
    setPinSetupMode(null);
    setNewPinInputRaw('');
    setConfirmPinInputRaw('');
    setPinSetupError('');
  }

  async function savePinSetup() {
    if (!/^\d{4,8}$/.test(newPinInput)) {
      setPinSetupError('PIN must be 4 to 8 digits.');
      return;
    }
    if (newPinInput === '0000') {
      setPinSetupError('0000 is reserved for duress wipe.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinSetupError('PIN entries do not match.');
      return;
    }
    const encoded = await encodePin(newPinInput);
    setSavedPinEncoded(encoded);
    setIsUnlocked(false);
    closePinSetup();
    Alert.alert('PIN saved', 'Your app lock PIN has been updated.');
  }

  function handleSetPin() {
    if (savedPinEncoded) {
      Alert.alert('PIN options', 'Change or remove the current app lock PIN.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', onPress: openPinSetup },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => { setSavedPinEncoded(null); setIsUnlocked(true); },
        },
      ]);
    } else {
      openPinSetup();
    }
  }

  function handleManualWipe() {
    Alert.alert('OPSEC WIPE', 'Permanently delete all local data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'WIPE', style: 'destructive', onPress: executeDuressWipe },
    ]);
  }

  function setNewPinInput(v: string) {
    setNewPinInputRaw(v.replace(/[^0-9]/g, ''));
    setPinSetupError('');
  }

  function setConfirmPinInput(v: string) {
    setConfirmPinInputRaw(v.replace(/[^0-9]/g, ''));
    setPinSetupError('');
  }

  return {
    pinEnabled,
    pinLength,
    isUnlocked,
    pinInput,
    pinError,
    pinSetupMode,
    newPinInput,
    confirmPinInput,
    pinSetupError,
    resetInactivityTimer,
    handlePinInput,
    closePinSetup,
    savePinSetup,
    handleSetPin,
    handleManualWipe,
    setNewPinInput,
    setConfirmPinInput,
  };
}
