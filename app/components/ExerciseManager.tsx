"use client";

import React, { useState, useEffect } from "react";
import {
  skipExercise,
  swapExercise,
  addExercise,
  removeExercise,
  restoreExercise,
  getExerciseLibrary,
  getRemovedExercises,
} from "@/app/actions";

interface Props {
  open: boolean;
  onClose: () => void;
  workoutId: number;
  workoutExerciseId: number;
  exerciseId: number;
  exerciseName: string;
  workoutTypeId: number;
  onExerciseChanged: () => void;
}

type ExerciseItem = {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string | null;
  active: boolean;
};

const MUSCLE_GROUPS = [
  "CHEST", "BACK", "SHOULDERS", "BICEPS", "TRICEPS",
  "QUADS", "HAMSTRINGS", "GLUTES", "CALVES", "CORE",
];

export default function ExerciseManager({
  open, onClose, workoutId, workoutExerciseId, exerciseId,
  exerciseName, workoutTypeId, onExerciseChanged,
}: Props) {
  const [view, setView] = useState<"actions" | "swap" | "add" | "restore">("actions");
  const [library, setLibrary] = useState<ExerciseItem[]>([]);
  const [removed, setRemoved] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Add form state
  const [addName, setAddName] = useState("");
  const [addMuscleGroup, setAddMuscleGroup] = useState("CHEST");
  const [addEquipment, setAddEquipment] = useState("");
  const [addSets, setAddSets] = useState(3);
  const [addMinReps, setAddMinReps] = useState(8);
  const [addMaxReps, setAddMaxReps] = useState(12);
  const [addIncrement, setAddIncrement] = useState(2.5);

  // Reset view on open
  useEffect(() => {
    if (!open) setView("actions");
  }, [open]);

  // Fetch data when view changes
  useEffect(() => {
    if (view === "swap") {
      setLoading(true);
      getExerciseLibrary(workoutTypeId)
        .then((data) => setLibrary(data.filter((e: ExerciseItem) => e.active && e.id !== exerciseId)))
        .finally(() => setLoading(false));
    } else if (view === "restore") {
      setLoading(true);
      getRemovedExercises(workoutTypeId)
        .then(setRemoved)
        .finally(() => setLoading(false));
    }
  }, [view, workoutTypeId, exerciseId]);

  const handleSkip = async () => {
    await skipExercise(workoutExerciseId);
    onExerciseChanged();
  };

  const handleRemove = async () => {
    if (!confirm(`Remove "${exerciseName}" permanently? You can restore it later.`)) return;
    await removeExercise(exerciseId);
    onExerciseChanged();
  };

  const handleSwap = async (newExerciseId: number) => {
    await swapExercise(workoutId, workoutExerciseId, newExerciseId);
    onExerciseChanged();
  };

  const handleRestore = async (id: number) => {
    await restoreExercise(id);
    // Refresh the list
    const updated = await getRemovedExercises(workoutTypeId);
    setRemoved(updated);
    if (updated.length === 0) setView("actions");
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;
    await addExercise({
      name: addName.trim(),
      muscleGroup: addMuscleGroup,
      equipment: addEquipment.trim(),
      workoutTypeId,
      sets: addSets,
      minReps: addMinReps,
      maxReps: addMaxReps,
      weightIncrement: addIncrement,
    });
    // Reset form
    setAddName("");
    setAddEquipment("");
    onExerciseChanged();
  };

  if (!open) return null;

  return (
    <div className="managerOverlay" onClick={onClose}>
      <div className="managerSheet" onClick={(e) => e.stopPropagation()}>
        <div className="managerHandle" />
        <h3 className="managerTitle">
          {view === "actions"
            ? exerciseName
            : view === "swap"
            ? "Swap Exercise"
            : view === "add"
            ? "Add New Exercise"
            : "Restore Removed"}
        </h3>

        {/* Actions view */}
        {view === "actions" && (
          <div className="managerActions">
            <button className="managerActionBtn" onClick={handleSkip}>
              <span className="managerActionIcon">⏭️</span>
              <span className="managerActionText">Skip Today</span>
              <span className="managerActionArrow">→</span>
            </button>
            <button className="managerActionBtn" onClick={() => setView("swap")}>
              <span className="managerActionIcon">🔄</span>
              <span className="managerActionText">Swap Exercise</span>
              <span className="managerActionArrow">→</span>
            </button>
            <div className="managerDivider" />
            <button className="managerActionBtn" onClick={() => setView("add")}>
              <span className="managerActionIcon">➕</span>
              <span className="managerActionText">Add New Exercise</span>
              <span className="managerActionArrow">→</span>
            </button>
            <button className="managerActionBtn" onClick={() => setView("restore")}>
              <span className="managerActionIcon">♻️</span>
              <span className="managerActionText">Restore Removed</span>
              <span className="managerActionArrow">→</span>
            </button>
            <div className="managerDivider" />
            <button className="managerActionBtn managerActionDanger" onClick={handleRemove}>
              <span className="managerActionIcon">🗑️</span>
              <span className="managerActionText">Remove Permanently</span>
              <span className="managerActionArrow">→</span>
            </button>
          </div>
        )}

        {/* Swap view */}
        {view === "swap" && (
          <div className="managerExerciseList">
            {loading && <div className="spinner" style={{ margin: "20px auto" }} />}
            {!loading && library.map((ex) => (
              <div className="managerExerciseItem" key={ex.id}>
                <div className="managerExerciseInfo">
                  <span className="managerExerciseName">{ex.name}</span>
                  <span className="managerExerciseMeta">
                    {ex.muscleGroup} · {ex.equipment || "Bodyweight"}
                  </span>
                </div>
                <button className="managerExerciseBtn" onClick={() => handleSwap(ex.id)}>
                  Select
                </button>
              </div>
            ))}
            {!loading && library.length === 0 && (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 20 }}>
                No alternative exercises available.
              </p>
            )}
            <button
              className="managerClose"
              style={{ marginTop: 12 }}
              onClick={() => setView("actions")}
            >
              ← Back
            </button>
          </div>
        )}

        {/* Add exercise form */}
        {view === "add" && (
          <form className="addExerciseForm" onSubmit={handleAdd}>
            <input
              className="addExerciseInput"
              placeholder="Exercise name"
              required
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
            />
            <select
              className="addExerciseSelect"
              value={addMuscleGroup}
              onChange={(e) => setAddMuscleGroup(e.target.value)}
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {m.charAt(0) + m.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <input
              className="addExerciseInput"
              placeholder="Equipment (e.g. Cable, Machine)"
              value={addEquipment}
              onChange={(e) => setAddEquipment(e.target.value)}
            />
            <div className="addExerciseRow">
              <input
                className="addExerciseInput"
                type="number"
                min={1}
                placeholder="Sets"
                value={addSets}
                onChange={(e) => setAddSets(Number(e.target.value))}
              />
              <input
                className="addExerciseInput"
                type="number"
                min={1}
                placeholder="Min Reps"
                value={addMinReps}
                onChange={(e) => setAddMinReps(Number(e.target.value))}
              />
              <input
                className="addExerciseInput"
                type="number"
                min={1}
                placeholder="Max Reps"
                value={addMaxReps}
                onChange={(e) => setAddMaxReps(Number(e.target.value))}
              />
            </div>
            <input
              className="addExerciseInput"
              type="number"
              step={0.5}
              min={0.5}
              placeholder="Weight increment (kg)"
              value={addIncrement}
              onChange={(e) => setAddIncrement(Number(e.target.value))}
            />
            <div className="addExerciseRow">
              <button
                type="button"
                className="managerClose"
                style={{ flex: 1 }}
                onClick={() => setView("actions")}
              >
                Cancel
              </button>
              <button type="submit" className="addExerciseSubmit" style={{ flex: 2 }}>
                Add Exercise
              </button>
            </div>
          </form>
        )}

        {/* Restore view */}
        {view === "restore" && (
          <div className="managerExerciseList">
            {loading && <div className="spinner" style={{ margin: "20px auto" }} />}
            {!loading && removed.map((ex) => (
              <div className="managerExerciseItem" key={ex.id}>
                <div className="managerExerciseInfo">
                  <span className="managerExerciseName">{ex.name}</span>
                  <span className="managerExerciseMeta">
                    {ex.muscleGroup} · {ex.equipment || "Bodyweight"}
                  </span>
                </div>
                <button className="managerExerciseBtn" onClick={() => handleRestore(ex.id)}>
                  Restore
                </button>
              </div>
            ))}
            {!loading && removed.length === 0 && (
              <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: 20 }}>
                No removed exercises to restore.
              </p>
            )}
            <button
              className="managerClose"
              style={{ marginTop: 12 }}
              onClick={() => setView("actions")}
            >
              ← Back
            </button>
          </div>
        )}

        <button className="managerClose" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
