import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

export function useToast() {
  const [toastMessage, setToastMessage] = useState('');
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();

    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToastMessage('');
      });
    }, 3200);
  }, [toastAnim]);

  return { toastMessage, toastAnim, showToast };
}
