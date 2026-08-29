"use client";
import React, { useEffect, useRef } from "react";

export default function WakeLockProvider({ active, children }: { active: boolean; children: React.ReactNode }) {
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let released = false;

    async function request() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock.current = await navigator.wakeLock.request('screen');
          wakeLock.current.addEventListener('release', () => { wakeLock.current = null; });
        }
      } catch (err) {
        console.warn("Wake lock request failed:", err);
      }
    }

    request();

    // Re-acquire on visibility change
    const handleVisibility = () => {
      if (!released && document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLock.current?.release().catch(() => {});
    };
  }, [active]);

  return <>{children}</>;
}
