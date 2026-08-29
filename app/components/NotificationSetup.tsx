"use client";

import React, { useState, useEffect } from 'react';

interface NotificationSetupProps {
  workoutType: string;
}

export default function NotificationSetup({ workoutType }: NotificationSetupProps) {
  const [status, setStatus] = useState<string>('default');

  useEffect(() => {
    if (!('Notification' in window)) {
      setStatus('unsupported');
    } else {
      setStatus(Notification.permission);
    }
  }, []);

  const enable = async () => {
    if (!('Notification' in window)) return;
    
    try {
      const permission = await Notification.requestPermission();
      setStatus(permission);
      
      if (permission === 'granted') {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register('/sw.js');
          localStorage.setItem('gymOS_nextWorkout', workoutType);
        }
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    }
  };

  return (
    <div className="notifCard">
      <h3 className="notifCardTitle">🔔 Gym Reminders</h3>
      <p className="notifCardText">
        {status === 'unsupported' ? 'Your browser doesn\'t support notifications.' :
         status === 'granted' ? 'Reminders active! Mon–Sat hourly until you log a workout.' :
         status === 'denied' ? 'Notifications blocked. Enable in browser settings.' :
         'Get hourly reminders to hit the gym (Mon–Sat). No spam on Sundays.'}
      </p>
      {status === 'default' && (
        <button className="notifBtn" onClick={enable}>Enable Reminders</button>
      )}
    </div>
  );
}
