import React, { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { formatElapsed } from '../utils/ruck';

export function LiveTimerText({
  startTime,
  isTracking,
  staticSeconds,
  style,
}: {
  startTime: Date | null;
  isTracking: boolean;
  staticSeconds: number;
  style: StyleProp<TextStyle>;
}) {
  const [elapsed, setElapsed] = useState(staticSeconds);

  useEffect(() => {
    if (!isTracking || !startTime) {
      setElapsed(staticSeconds);
      return;
    }

    setElapsed(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)));
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime.getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [isTracking, startTime, staticSeconds]);

  return <Text style={style}>{formatElapsed(elapsed)}</Text>;
}
