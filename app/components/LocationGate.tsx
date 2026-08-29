"use client";
import React, { useState, useEffect } from "react";
import { verifyLocation, overrideLocation } from "@/app/actions";

interface Props {
  workoutId: number;
  onVerified: () => void;
  onSkip: () => void;
}

export default function LocationGate({ workoutId, onVerified, onSkip }: Props) {
  const [status, setStatus] = useState<'checking' | 'verified' | 'failed'>('checking');
  const [distance, setDistance] = useState<number>(0);
  const [branchName, setBranchName] = useState<string>('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('failed');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await verifyLocation(workoutId, position.coords.latitude, position.coords.longitude);
          setDistance(res.distance);
          setBranchName(res.nearest);
          
          if (res.verified) {
            setStatus('verified');
            setTimeout(onVerified, 1500);
          } else {
            setStatus('failed');
          }
        } catch (err) {
          setStatus('failed');
        }
      },
      (err) => {
        setStatus('failed');
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  const handleOverride = async () => {
    await overrideLocation(workoutId);
    onVerified();
  };

  return (
    <div className="locationGate">
      <div className="locationIcon">📍</div>
      
      {status === 'checking' && (
        <div className="locationChecking">
          Checking your location...
        </div>
      )}
      
      {status === 'verified' && (
        <div className="locationSuccess">✓ You're at {branchName}</div>
      )}
      
      {status === 'failed' && (
        <div className="locationError">
          <p>You're {distance}m from the nearest Cult.Fit</p>
          <p className="locationDistance">Nearest: {branchName || 'Unknown'}</p>
          <button className="locationBtnOverride" onClick={handleOverride}>Override & Continue</button>
        </div>
      )}
      
      <button className="locationBtn" onClick={onSkip}>Skip Verification</button>
    </div>
  );
}
