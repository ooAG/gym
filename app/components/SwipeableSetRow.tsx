"use client";
import React, { useState, useRef } from "react";
import RepsControl from "./RepsControl";
import RirSelector from "./RirSelector";

interface Props {
  setNumber: number;
  totalSets: number;
  reps: number;
  rir: number | null;
  completed: boolean;
  previousReps: number | null;
  previousWeight: number | null;
  targetMin: number;
  targetMax: number;
  onRepsChange: (reps: number) => void;
  onRirChange: (rir: number) => void;
  onComplete: () => void;
  onClear: () => void;
}

export default function SwipeableSetRow({
  setNumber, totalSets, reps, rir, completed,
  previousReps, previousWeight, targetMin, targetMax,
  onRepsChange, onRirChange, onComplete, onClear
}: Props) {
  const [offset, setOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (completed) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (completed || touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    setOffset(diff);
  };

  const handleTouchEnd = () => {
    if (completed || touchStartX.current === null) return;
    if (offset > 100) {
      onComplete();
    } else if (offset < -100) {
      onClear();
    }
    setOffset(0);
    touchStartX.current = null;
  };

  return (
    <div className={`swipeRow ${completed ? 'setCompleted' : ''}`}>
      <div className="swipeBgComplete"><span className="swipeBgIcon">✓</span></div>
      <div className="swipeBgClear"><span className="swipeBgIcon">✕</span></div>
      <div 
        className="swipeContent" 
        ref={contentRef} 
        style={{ transform: `translateX(${offset}px)`, transition: touchStartX.current === null ? 'transform 0.2s' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="setCard">
          <div className="setHeader">
            <div>
              <span className="setLabel">SET</span>
              <strong>{setNumber}<span> / {totalSets}</span></strong>
            </div>
            <span className="setTarget">{targetMin}–{targetMax} reps</span>
          </div>
          {!completed ? (
            <>
              <RepsControl value={reps} minReps={targetMin} maxReps={targetMax} onChange={onRepsChange} />
              <RirSelector value={rir} onChange={onRirChange} />
            </>
          ) : (
            <div className="setRowInner">
              <strong>{reps} reps</strong>
              {rir !== null && <span>RIR {rir}</span>}
              <span className="swipeBgIcon">✓</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
