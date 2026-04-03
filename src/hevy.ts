/**
 * Hevy API v1 Client
 * Base URL: https://api.hevyapp.com/v1
 * Auth: api-key header
 */

const BASE = "https://api.hevyapp.com/v1";

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface EventParams extends PaginationParams {
  since?: string;
}

interface HistoryParams {
  start_date?: string;
  end_date?: string;
}

async function request(
  apiKey: string,
  method: string,
  path: string,
  params?: Record<string, string | number>,
  body?: unknown
): Promise<any> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url, {
    method,
    headers: {
      "api-key": apiKey,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Hevy API ${res.status}: ${text}`);
  }

  return res.json();
}

function get(apiKey: string, path: string, params?: Record<string, string | number>) {
  return request(apiKey, "GET", path, params);
}

function post(apiKey: string, path: string, body: unknown) {
  return request(apiKey, "POST", path, undefined, body);
}

function put(apiKey: string, path: string, body: unknown) {
  return request(apiKey, "PUT", path, undefined, body);
}

// ── User ────────────────────────────────────────────────────────────

export function getUserInfo(apiKey: string) {
  return get(apiKey, "/user/info");
}

// ── Workouts ────────────────────────────────────────────────────────

export function getWorkouts(apiKey: string, params?: PaginationParams) {
  return get(apiKey, "/workouts", params as Record<string, number>);
}

export function getWorkout(apiKey: string, workoutId: string) {
  return get(apiKey, `/workouts/${workoutId}`);
}

export function getWorkoutCount(apiKey: string) {
  return get(apiKey, "/workouts/count");
}

export function getWorkoutEvents(apiKey: string, params?: EventParams) {
  return get(apiKey, "/workouts/events", params as Record<string, string | number>);
}

export function createWorkout(apiKey: string, body: unknown) {
  return post(apiKey, "/workouts", body);
}

export function updateWorkout(apiKey: string, workoutId: string, body: unknown) {
  return put(apiKey, `/workouts/${workoutId}`, body);
}

// ── Routines ────────────────────────────────────────────────────────

export function getRoutines(apiKey: string, params?: PaginationParams) {
  return get(apiKey, "/routines", params as Record<string, number>);
}

export function getRoutine(apiKey: string, routineId: string) {
  return get(apiKey, `/routines/${routineId}`);
}

export function createRoutine(apiKey: string, body: unknown) {
  return post(apiKey, "/routines", body);
}

export function updateRoutine(apiKey: string, routineId: string, body: unknown) {
  return put(apiKey, `/routines/${routineId}`, body);
}

// ── Exercise Templates ──────────────────────────────────────────────

export function getExerciseTemplates(apiKey: string, params?: PaginationParams) {
  return get(apiKey, "/exercise_templates", params as Record<string, number>);
}

export function getExerciseTemplate(apiKey: string, templateId: string) {
  return get(apiKey, `/exercise_templates/${templateId}`);
}

export function createExerciseTemplate(apiKey: string, body: unknown) {
  return post(apiKey, "/exercise_templates", body);
}

// ── Routine Folders ─────────────────────────────────────────────────

export function getRoutineFolders(apiKey: string, params?: PaginationParams) {
  return get(apiKey, "/routine_folders", params as Record<string, number>);
}

export function getRoutineFolder(apiKey: string, folderId: string) {
  return get(apiKey, `/routine_folders/${folderId}`);
}

export function createRoutineFolder(apiKey: string, body: unknown) {
  return post(apiKey, "/routine_folders", body);
}

// ── Exercise History ────────────────────────────────────────────────

export function getExerciseHistory(apiKey: string, exerciseTemplateId: string, params?: HistoryParams) {
  return get(apiKey, `/exercise_history/${exerciseTemplateId}`, params as Record<string, string>);
}
