import {useCallback, useEffect, useRef} from 'react';

const SHIELD_HOLD_DURATION_MS = 5000;
const SHIELD_MULTI_TAP_REQUIRED = 5;
const SHIELD_TAP_WINDOW_MS = 2500;

export function useAdminShieldTrigger(onUnlock?: () => void) {
  const holdTimerRef = useRef<number | null>(null);
  const holdTriggeredRef = useRef(false);
  const tapStateRef = useRef<{count: number; lastTs: number}>({count: 0, lastTs: 0});

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, [clearHoldTimer]);

  const onPointerDown = useCallback(() => {
    if (!onUnlock) return;
    holdTriggeredRef.current = false;
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      holdTriggeredRef.current = true;
      tapStateRef.current = {count: 0, lastTs: 0};
      onUnlock();
    }, SHIELD_HOLD_DURATION_MS);
  }, [clearHoldTimer, onUnlock]);

  const onPointerCancelOrLeave = useCallback(() => {
    clearHoldTimer();
  }, [clearHoldTimer]);

  const onClick = useCallback(() => {
    clearHoldTimer();
    if (!onUnlock) return;
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - tapStateRef.current.lastTs > SHIELD_TAP_WINDOW_MS) {
      tapStateRef.current = {count: 1, lastTs: now};
      return;
    }
    const nextCount = tapStateRef.current.count + 1;
    tapStateRef.current = {count: nextCount, lastTs: now};
    if (nextCount >= SHIELD_MULTI_TAP_REQUIRED) {
      tapStateRef.current = {count: 0, lastTs: 0};
      onUnlock();
    }
  }, [clearHoldTimer, onUnlock]);

  return {
    onPointerDown,
    onPointerUp: onPointerCancelOrLeave,
    onPointerLeave: onPointerCancelOrLeave,
    onPointerCancel: onPointerCancelOrLeave,
    onClick,
  };
}
