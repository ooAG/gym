"use client";
import React, { useState, useEffect } from "react";
import { saveWarmupLog } from "@/app/actions";

interface Activity {
  id: number;
  name: string;
  duration: number;
}

interface Props {
  workoutId: number;
  activities: Activity[];
  onComplete: () => void;
}

type Status = 'pending' | 'active' | 'completed' | 'skipped';

export default function WarmupSection({ workoutId, activities, onComplete }: Props) {
  const [statuses, setStatuses] = useState<Record<number, Status>>(
    activities.reduce((acc, act) => ({ ...acc, [act.id]: 'pending' }), {})
  );
  
  const [countdowns, setCountdowns] = useState<Record<number, number>>(
    activities.reduce((acc, act) => ({ ...acc, [act.id]: act.duration }), {})
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const activeIds = Object.entries(statuses).filter(([_, s]) => s === 'active').map(([id]) => Number(id));
    
    if (activeIds.length > 0) {
      interval = setInterval(() => {
        setCountdowns(prev => {
          const next = { ...prev };
          activeIds.forEach(id => {
            if (next[id] > 0) {
              next[id] -= 1;
            }
          });
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [statuses]);

  useEffect(() => {
    Object.entries(countdowns).forEach(([id, time]) => {
      if (time === 0 && statuses[Number(id)] === 'active') {
        updateStatus(Number(id), 'completed');
      }
    });
  }, [countdowns, statuses]);

  const checkAllDone = (newStatuses: Record<number, Status>) => {
    const allDone = Object.values(newStatuses).every(s => s === 'completed' || s === 'skipped');
    if (allDone) {
      onComplete();
    }
  };

  const updateStatus = async (id: number, newStatus: Status) => {
    const next = { ...statuses, [id]: newStatus };
    setStatuses(next);
    const act = activities.find(a => a.id === id);
    const elapsed = act ? act.duration - (countdowns[id] ?? 0) : 0;
    await saveWarmupLog(workoutId, id, elapsed, newStatus === 'skipped');
    checkAllDone(next);
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const skipAll = async () => {
    const next = { ...statuses };
    for (const act of activities) {
      if (next[act.id] === 'pending' || next[act.id] === 'active') {
        next[act.id] = 'skipped';
        await saveWarmupLog(workoutId, act.id, 0, true);
      }
    }
    setStatuses(next);
    onComplete();
  };

  return (
    <div className="warmupSection">
      <h2 className="warmupTitle">🔥 Warm Up</h2>
      {activities.map(act => {
        const status = statuses[act.id];
        const countdown = formatDuration(countdowns[act.id]);
        return (
          <div className={`warmupCard ${status}`} key={act.id}>
            <div className="warmupInfo">
              <span className="warmupName">{act.name}</span>
              <span className="warmupDuration">{formatDuration(act.duration)}</span>
            </div>
            {status === 'active' && <div className="warmupTimer warmupTimerActive">{countdown}</div>}
            <div className="warmupActions">
              {status === 'pending' && <button className="warmupBtn" onClick={() => updateStatus(act.id, 'active')}>Start</button>}
              {status === 'active' && (
                <>
                  <button className="warmupBtnSkip" onClick={() => updateStatus(act.id, 'skipped')}>Skip</button>
                  <button className="warmupBtnComplete" onClick={() => updateStatus(act.id, 'completed')}>Done ✓</button>
                </>
              )}
              {status === 'completed' && <span className="warmupCompleted">✓ Done</span>}
              {status === 'skipped' && <span className="warmupCompleted">Skipped</span>}
            </div>
          </div>
        );
      })}
      <button className="warmupSkipAll" onClick={skipAll}>Skip Warmup →</button>
    </div>
  );
}
