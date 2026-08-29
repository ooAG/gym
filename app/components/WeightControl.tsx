"use client";
import React from "react";

interface Props {
  weight: number;
  increment: number;
  onChange: (newWeight: number) => void;
}

export default function WeightControl({ weight, increment, onChange }: Props) {
  const adjust = (amount: number) => {
    const newWeight = Math.max(0, weight + amount);
    onChange(Number(newWeight.toFixed(1)));
  };

  const formatWeight = (w: number) => {
    return w % 1 === 0 ? w.toString() : w.toFixed(1);
  };

  return (
    <div className="targetCard">
      <div className="targetHeader">
        <span>TODAY'S WEIGHT</span>
      </div>
      <div className="weightControl">
        <div className="weightButtons">
          <button className="weightBtn" onClick={() => adjust(-5)}>
            <span className="weightBtnLabel">−5</span>
          </button>
          <button className="weightBtn" onClick={() => adjust(-increment)}>
            <span className="weightBtnLabel">−{increment}</span>
          </button>
        </div>
        <div className="weightDisplay">
          <strong>{formatWeight(weight)}</strong>
          <span>kg</span>
        </div>
        <div className="weightButtons">
          <button className="weightBtn" onClick={() => adjust(+increment)}>
            <span className="weightBtnLabel">+{increment}</span>
          </button>
          <button className="weightBtn" onClick={() => adjust(+5)}>
            <span className="weightBtnLabel">+5</span>
          </button>
        </div>
      </div>
    </div>
  );
}
