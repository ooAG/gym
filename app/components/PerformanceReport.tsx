"use client";

import React, { useEffect, useState } from "react";
import { getPerformanceReport, type PerformanceReport as ReportType } from "@/app/actions";

interface PerformanceReportProps {
  workoutId: number;
  workoutType: string;
  sequenceNo: number;
  onDone: () => void;
}

export default function PerformanceReport({
  workoutId,
  workoutType,
  sequenceNo,
  onDone,
}: PerformanceReportProps) {
  const [report, setReport] = useState<ReportType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const data = await getPerformanceReport(workoutId);
        setReport(data);
      } catch (error) {
        console.error("Failed to fetch performance report", error);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [workoutId]);

  if (loading) {
    return (
      <div className="reportScreen">
        <div className="loadingSpinner">Loading report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="reportScreen">
        <p>Could not load report.</p>
        <button className="primaryButton" onClick={onDone}>Start Next Workout →</button>
      </div>
    );
  }

  const volumeDelta = report.volumeDelta;

  return (
    <div className="reportScreen">
      <div className="reportHeader">
        <div className="reportIcon">🏆</div>
        <div className="reportTag">WORKOUT COMPLETE</div>
        <h1>{workoutType} Day — Crushed! 🔥</h1>
        <p>Workout #{sequenceNo} • {report.duration} min</p>
      </div>

      <div className="reportStatsGrid">
        <div className="reportStat">
          <div className={`reportStatValue ${volumeDelta > 0 ? 'reportStatUp' : volumeDelta < 0 ? 'reportStatDown' : ''}`}>
            {report.totalVolume.toLocaleString('en-IN')} kg
          </div>
          <div className="reportStatLabel">
            Total Volume {volumeDelta !== 0 && `(${volumeDelta > 0 ? '+' : ''}${volumeDelta.toLocaleString('en-IN')} kg)`}
          </div>
        </div>
        <div className="reportStat">
          <div className="reportStatValue">{report.totalSets}</div>
          <div className="reportStatLabel">Sets</div>
        </div>
        <div className="reportStat">
          <div className="reportStatValue">{report.totalReps}</div>
          <div className="reportStatLabel">Total Reps</div>
        </div>
      </div>

      <div className="reportDivider" />

      <div className="reportExercises">
        {report.exercises.map(ex => (
          <div className="reportExerciseCard" key={ex.name}>
            <div className="reportExerciseName">
              {ex.name}
              {ex.estimated1RM && <span className="report1rm">Est. 1RM: <strong className="report1rmValue">{ex.estimated1RM} kg</strong></span>}
            </div>
            <div className="reportExerciseSets">
              {ex.sets.map(set => (
                <div className="reportSetRow" key={set.setNumber}>
                  <span className="reportSetLabel">Set {set.setNumber}</span>
                  <span className="reportSetValue">{set.weight} kg × {set.reps} reps</span>
                  {set.previousWeight !== null && (
                    <span className={`reportSetDelta ${
                      set.weightDelta > 0 || set.repsDelta > 0 ? 'reportDeltaUp' :
                      set.weightDelta < 0 || set.repsDelta < 0 ? 'reportDeltaDown' : 'reportDeltaSame'
                    }`}>
                      {set.weightDelta > 0 ? `↑ +${set.weightDelta} kg` :
                       set.repsDelta > 0 ? `↑ +${set.repsDelta} reps` :
                       set.weightDelta < 0 ? `↓ ${Math.abs(set.weightDelta)} kg` :
                       set.repsDelta < 0 ? `↓ ${Math.abs(set.repsDelta)} reps` : '→ Same'}
                    </span>
                  )}
                  {set.previousWeight === null && (
                    <span className="reportDeltaSame">🆕 First time</span>
                  )}
                </div>
              ))}
            </div>
            <div className="reportVolumeBar">
              <div className="reportVolumeFill" style={{
                width: `${Math.min(100, ex.previousVolume > 0 ? (ex.totalVolume / ex.previousVolume) * 100 : 100)}%`
              }} />
            </div>
            <span className="reportStatLabel">
              Volume: {ex.totalVolume.toLocaleString('en-IN')} kg
              {ex.volumeDelta !== 0 && ` (${ex.volumeDelta > 0 ? '+' : ''}${ex.volumeDelta.toLocaleString('en-IN')} kg)`}
            </span>
          </div>
        ))}
      </div>

      <button className="primaryButton" onClick={onDone}>Start Next Workout →</button>
    </div>
  );
}
