"use client";
import React from "react";

interface Props {
  workoutType: string;
  sequenceNo: number;
  exerciseIndex: number;
  totalExercises: number;
  daysMissed: number;
}

export default function WorkoutHeader({ workoutType, sequenceNo, exerciseIndex, totalExercises, daysMissed }: Props) {
  const progress = totalExercises > 0 ? ((exerciseIndex + 1) / totalExercises) * 100 : 0;

  return (
    <>
      <header className="appHeader">
        <div className="logo">GYM OS</div>
        <div className="headerRight">
          <span>{workoutType}</span>
          <span className="workoutNumber">#{sequenceNo}</span>
        </div>
      </header>
      
      {daysMissed > 0 && (
        <div className="missedDays">🔄 Missed {daysMissed} day{daysMissed !== 1 ? 's' : ''}. Picking up where you left off.</div>
      )}
      
      <div className="progressArea">
        <div className="progressText">
          <span>{exerciseIndex + 1} / {totalExercises}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="progressTrack">
          <div className="progressFill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </>
  );
}
