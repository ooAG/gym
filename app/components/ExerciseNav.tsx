"use client";
import React from "react";

interface Props {
  exerciseIndex: number;
  totalExercises: number;
  completedIndices: number[];
  onNavigate: (index: number) => void;
}

export default function ExerciseNav({ exerciseIndex, totalExercises, completedIndices, onNavigate }: Props) {
  return (
    <div className="exerciseNavigation">
      <button disabled={exerciseIndex === 0} onClick={() => onNavigate(exerciseIndex - 1)}>← Previous</button>
      <div className="dots">
        {Array.from({ length: totalExercises }, (_, i) => (
          <button 
            key={i}
            className={`dot ${i === exerciseIndex ? 'active' : completedIndices.includes(i) ? 'completed' : ''}`}
            onClick={() => onNavigate(i)} 
          />
        ))}
      </div>
      <button disabled={exerciseIndex === totalExercises - 1} onClick={() => onNavigate(exerciseIndex + 1)}>Next →</button>
    </div>
  );
}
