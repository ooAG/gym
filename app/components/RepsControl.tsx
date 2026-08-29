"use client";
import React from "react";

interface Props {
  value: number;
  minReps: number;
  maxReps: number;
  onChange: (reps: number) => void;
}

export default function RepsControl({ value, minReps, maxReps, onChange }: Props) {
  const quickReps = Array.from(new Set([
    minReps,
    Math.floor((minReps + maxReps) / 2),
    maxReps,
    maxReps + 3
  ])).sort((a, b) => a - b);

  return (
    <div className="repsControl">
      <div className="inputLabel">REPS</div>
      <div className="repsBtnGroup">
        <button className="repsBtn repsBtnLarge" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <div className="repsDisplay">
          <span className="repsValue">{value}</span>
        </div>
        <button className="repsBtn repsBtnLarge" onClick={() => onChange(value + 1)}>+</button>
      </div>
      <div className="quickReps">
        {quickReps.map(r => (
          <button
            key={r}
            className={`quickRepBtn ${value === r ? 'quickRepBtnActive' : ''}`}
            onClick={() => onChange(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
