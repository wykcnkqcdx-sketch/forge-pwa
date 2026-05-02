import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

const DURESS_PIN = '0000';

type Props = {
  savedPin: string | null;
  setSavedPin: (pin: string | null) => void;
  isReady: boolean;
  onWipe: () => Promise<void>;
};

export function usePinLock({ savedPin, setSavedPin, isReady, onWipe }: Props) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pinSetupMode, setPinSetupMode] = useState<'set' | 'change' | null>(null);
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinSetupError, setPinSetupError] = useState('');

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (savedPin && isUnlocked) {
      inactivityTimer.current = setTimeout(() => setIsUnlocked(false), 3 * 60 * 1000);
    }
  }, [savedPin, isUnlocked]);

  useEffect(() => {
    resetInactivityTimer();
    return () => { if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [resetInactivityTimer]);

  // Auto-unlock when no PIN is set and data is ready
  useEffect(() => {
    if (isReady && !savedPin) setIsUnlocked(true);
  }, [isReady, savedPin]);

  function openPinSetup() {
    setNewPinInput('');
    setConfirmPinInput('');
    setPinSetupError('');
    setPinSetupMode(savedPin ? 'change' : 'set');
  }

  function closePinSetup() {
    setPinSetupMode(null);
    setNewPinInput('');
    setConfirmPinInput('');
    setPinSetupError('');
  }

  function savePinSetup() {
    if (!/^\d{4,8}$/.test(newPinInput)) {
      setPinSetupError('PIN must be 4 to 8 digits.');
      return;
    }
    if (newPinInput === DURESS_PIN) {
      setPinSetupError('0000 is reserved for duress wipe.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinSetupError('PIN entries do not match.');
      return;
    }
    setSavedPin(newPinInput);
    setIsUnlocked(false);
    closePinSetup();
    Alert.alert('PIN saved', 'Your app lock PIN has been updated.');
  }

  function handleSetPin() {
    if (savedPin) {
      Alert.alert('PIN options', 'Change or remove the current app lock PIN.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', onPress: openPinSetup },
        { text: 'Remove', style: 'destructive', onPress: () => { setSavedPin(null); setIsUnlocked(true); } },
      ]);
    } else {
      openPinSetup();
    }
  }

  async function executeDuressWipe() {
    setSavedPin(null);
    setIsUnlocked(true);
    setPinInput('');
    await onWipe();
  }

  function handlePinInput(val: string) {
    if (!savedPin) return;
    const numericVal = val.replace(/[^0-9]/g, '');
    setPinInput(numericVal);
    setPinError(false);
    if (numericVal === DURESS_PIN) {
      executeDuressWipe();
    } else if (numericVal.length === savedPin.length) {
      if (numericVal === savedPin) {
        setIsUnlocked(true);
        setPinInput('');
      } else {
        setPinError(true);
        setTimeout(() => setPinInput(''), 300);
      }
    }
  }

  function handleManualWipe() {
    if (typeof window !== 'undefined') {
      if (window.confirm('Permanently delete all local data? This cannot be undone.')) {
        executeDuressWipe();
      }
      return;
    }
    Alert.alert('OPSEC WIPE', 'Permanently delete all local data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'WIPE', style: 'destructive', onPress: executeDuressWipe },
    ]);
  }

  return {
    isUnlocked,
    pinInput,
    pinError,
    pinSetupMode,
    newPinInput, setNewPinInput,
    confirmPinInput, setConfirmPinInput,
    pinSetupError,
    resetInactivityTimer,
    openPinSetup,
    closePinSetup,
    savePinSetup,
    handleSetPin,
    handleManualWipe,
    handlePinInput,
  };
}
