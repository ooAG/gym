"use client";
import React from "react";

interface Props {
  value: number | null;
  onChange: (rir: number) => void;
}

export default function RirSelector({ value, onChange }: Props) {
  return (
    <div>
      <div className="inputLabel">REPS IN RESERVE</div>
      <div className="rirGrid">
        {[0, 1, 2, 3, 4].map(rir => (
          <button 
            key={rir} 
            className={`rirButton ${value === rir ? 'selected' : ''}`}
            onClick={() => onChange(rir)}
          >
            {rir === 4 ? '4+' : rir}
          </button>
        ))}
      </div>
    </div>
  );
}
