"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  seconds: number;
  onComplete: () => void;
  onSkip: () => void;
  onAdd: (seconds: number) => void;
}

export default function RestTimer({ seconds, onComplete, onSkip, onAdd }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const totalRef = useRef(seconds);
  const onCompleteRef = useRef(onComplete);

  // Keep refs current
  onCompleteRef.current = onComplete;

  // Sync when initial seconds changes (e.g. +30/-30 from parent)
  useEffect(() => {
    setRemaining(seconds);
    if (seconds > totalRef.current) totalRef.current = seconds;
  }, [seconds]);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          // Vibrate on complete
          try { navigator.vibrate?.(200); } catch {}
          // Use setTimeout to avoid state update during render
          setTimeout(() => onCompleteRef.current(), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []); // Only run once on mount

  const formatTime = (sec: number) => {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = totalRef.current > 0 ? (remaining / totalRef.current) * 100 : 0;
  const isUrgent = remaining <= 10 && remaining > 0;

  return (
    <div className="restTimerOverlay">
      <div className="restTimerContent">
        <span className="restTimerLabel">REST</span>
        <div className={`restTimerTime ${isUrgent ? "restTimerUrgent" : ""}`}>
          {formatTime(remaining)}
        </div>
        <div className="restTimerProgress">
          <div
            className="restTimerProgressFill"
            style={{ width: `${Math.max(0, progress)}%` }}
          />
        </div>
        <div className="restTimerButtons">
          <button className="restTimerBtn" onClick={() => { setRemaining(r => Math.max(0, r - 30)); onAdd(-30); }}>
            −30s
          </button>
          <button className="restTimerBtn" onClick={() => { setRemaining(r => r + 30); totalRef.current += 30; onAdd(30); }}>
            +30s
          </button>
          <button className="restTimerBtnSkip" onClick={onSkip}>
            Skip Rest →
          </button>
        </div>
      </div>
    </div>
  );
}
