import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as hevy from "./hevy.ts";

const paginationSchema = {
  page: z.number().optional().describe("Page number (starting at 1)"),
  pageSize: z.number().optional().describe("Items per page (max 10)"),
};

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function registerTools(server: McpServer, apiKey: string) {
  // ── User ────────────────────────────────────────────────────────

  server.tool(
    "hevy_get_user_info",
    "Get the authenticated user's profile info (name, URL). Use to identify the user.",
    {},
    async () => json(await hevy.getUserInfo(apiKey))
  );

  // ── Workouts ────────────────────────────────────────────────────

  server.tool(
    "hevy_get_workouts",
    "Get a paginated list of workouts. Each workout contains exercises with sets (weight, reps, duration, distance). Use to analyze training history and progress.",
    paginationSchema,
    async (params) => json(await hevy.getWorkouts(apiKey, params))
  );

  server.tool(
    "hevy_get_workout",
    "Get a single workout by ID. Returns full details including all exercises and sets with weight_kg, reps, distance_meters, duration_seconds, and RPE.",
    { workoutId: z.string().describe("Workout ID") },
    async ({ workoutId }) => json(await hevy.getWorkout(apiKey, workoutId))
  );

  server.tool(
    "hevy_get_workout_count",
    "Get the total number of workouts on the account. Quick way to understand training volume.",
    {},
    async () => json(await hevy.getWorkoutCount(apiKey))
  );

  server.tool(
    "hevy_get_workout_events",
    "Get workout update/delete events since a given date. Useful for syncing or detecting changes.",
    {
      ...paginationSchema,
      since: z.string().optional().describe("ISO 8601 date to fetch events from (default: 1970-01-01T00:00:00Z)"),
    },
    async (params) => json(await hevy.getWorkoutEvents(apiKey, params))
  );

  server.tool(
    "hevy_create_workout",
    "Create a new workout. Requires title, start_time, end_time, and exercises with sets. Set types: normal, warmup, dropset, failure. Weight in kg.",
    {
      workout: z.object({
        title: z.string().describe("Workout title"),
        description: z.string().nullable().optional().describe("Optional description"),
        start_time: z.string().describe("Start time (ISO 8601)"),
        end_time: z.string().describe("End time (ISO 8601)"),
        is_private: z.boolean().optional().describe("Whether workout is private"),
        exercises: z.array(z.object({
          exercise_template_id: z.string().describe("Exercise template ID"),
          supersets_id: z.number().nullable().optional().describe("Superset group ID"),
          notes: z.string().optional().describe("Exercise notes"),
          sets: z.array(z.object({
            type: z.enum(["normal", "warmup", "dropset", "failure"]).optional(),
            weight_kg: z.number().nullable().optional(),
            reps: z.number().nullable().optional(),
            distance_meters: z.number().nullable().optional(),
            duration_seconds: z.number().nullable().optional(),
            rpe: z.number().nullable().optional(),
            custom_metric: z.number().nullable().optional(),
          })),
        })),
      }),
    },
    async ({ workout }) => json(await hevy.createWorkout(apiKey, { workout }))
  );

  server.tool(
    "hevy_update_workout",
    "Update an existing workout. Same structure as create. Replaces the entire workout.",
    {
      workoutId: z.string().describe("Workout ID to update"),
      workout: z.object({
        title: z.string().describe("Workout title"),
        description: z.string().nullable().optional(),
        start_time: z.string().describe("Start time (ISO 8601)"),
        end_time: z.string().describe("End time (ISO 8601)"),
        is_private: z.boolean().optional(),
        exercises: z.array(z.object({
          exercise_template_id: z.string().describe("Exercise template ID"),
          supersets_id: z.number().nullable().optional(),
          notes: z.string().optional(),
          sets: z.array(z.object({
            type: z.enum(["normal", "warmup", "dropset", "failure"]).optional(),
            weight_kg: z.number().nullable().optional(),
            reps: z.number().nullable().optional(),
            distance_meters: z.number().nullable().optional(),
            duration_seconds: z.number().nullable().optional(),
            rpe: z.number().nullable().optional(),
            custom_metric: z.number().nullable().optional(),
          })),
        })),
      }),
    },
    async ({ workoutId, workout }) => json(await hevy.updateWorkout(apiKey, workoutId, { workout }))
  );

  // ── Routines ────────────────────────────────────────────────────

  server.tool(
    "hevy_get_routines",
    "Get a paginated list of workout routines. Routines are templates for workouts with predefined exercises and rep ranges.",
    paginationSchema,
    async (params) => json(await hevy.getRoutines(apiKey, params))
  );

  server.tool(
    "hevy_get_routine",
    "Get a single routine by ID with all exercises and set configurations.",
    { routineId: z.string().describe("Routine ID") },
    async ({ routineId }) => json(await hevy.getRoutine(apiKey, routineId))
  );

  server.tool(
    "hevy_create_routine",
    "Create a new workout routine with exercises and rep/set targets.",
    {
      routine: z.object({
        title: z.string().describe("Routine title"),
        folder_id: z.number().nullable().optional().describe("Folder ID to organize routine"),
        notes: z.string().optional().describe("Routine notes"),
        exercises: z.array(z.object({
          exercise_template_id: z.string().describe("Exercise template ID"),
          supersets_id: z.number().nullable().optional(),
          notes: z.string().optional(),
          sets: z.array(z.object({
            type: z.enum(["normal", "warmup", "dropset", "failure"]).optional(),
            weight_kg: z.number().nullable().optional(),
            reps: z.number().nullable().optional(),
            distance_meters: z.number().nullable().optional(),
            duration_seconds: z.number().nullable().optional(),
            rpe: z.number().nullable().optional(),
            custom_metric: z.number().nullable().optional(),
          })),
        })),
      }),
    },
    async ({ routine }) => json(await hevy.createRoutine(apiKey, { routine }))
  );

  server.tool(
    "hevy_update_routine",
    "Update an existing routine. Replaces the entire routine.",
    {
      routineId: z.string().describe("Routine ID to update"),
      routine: z.object({
        title: z.string().describe("Routine title"),
        notes: z.string().nullable().optional(),
        exercises: z.array(z.object({
          exercise_template_id: z.string().describe("Exercise template ID"),
          supersets_id: z.number().nullable().optional(),
          notes: z.string().optional(),
          sets: z.array(z.object({
            type: z.enum(["normal", "warmup", "dropset", "failure"]).optional(),
            weight_kg: z.number().nullable().optional(),
            reps: z.number().nullable().optional(),
            distance_meters: z.number().nullable().optional(),
            duration_seconds: z.number().nullable().optional(),
            rpe: z.number().nullable().optional(),
            custom_metric: z.number().nullable().optional(),
          })),
        })),
      }),
    },
    async ({ routineId, routine }) => json(await hevy.updateRoutine(apiKey, routineId, { routine }))
  );

  // ── Exercise Templates ──────────────────────────────────────────

  server.tool(
    "hevy_get_exercise_templates",
    "Get a paginated list of exercise templates (both built-in and custom). Includes muscle groups, equipment type, and exercise type. Use to find exercise_template_id for creating workouts.",
    {
      page: z.number().optional().describe("Page number (starting at 1)"),
      pageSize: z.number().optional().describe("Items per page (max 100)"),
    },
    async (params) => json(await hevy.getExerciseTemplates(apiKey, params))
  );

  server.tool(
    "hevy_get_exercise_template",
    "Get a single exercise template by ID. Shows title, type, primary/secondary muscle groups, and whether it's custom.",
    { exerciseTemplateId: z.string().describe("Exercise template ID") },
    async ({ exerciseTemplateId }) => json(await hevy.getExerciseTemplate(apiKey, exerciseTemplateId))
  );

  server.tool(
    "hevy_create_exercise_template",
    "Create a new custom exercise template. Requires title, exercise_type, equipment_category, muscle_group. Types: weight_reps, reps_only, bodyweight_reps, duration, etc. Muscle groups: chest, biceps, triceps, shoulders, lats, quadriceps, hamstrings, glutes, etc.",
    {
      exercise: z.object({
        title: z.string().describe("Exercise name"),
        exercise_type: z.enum([
          "weight_reps", "reps_only", "bodyweight_reps", "bodyweight_assisted_reps",
          "duration", "weight_duration", "distance_duration", "short_distance_weight",
        ]).describe("Exercise type"),
        equipment_category: z.enum([
          "none", "barbell", "dumbbell", "kettlebell", "machine",
          "plate", "resistance_band", "suspension", "other",
        ]).describe("Equipment type"),
        muscle_group: z.enum([
          "abdominals", "shoulders", "biceps", "triceps", "forearms",
          "quadriceps", "hamstrings", "calves", "glutes", "abductors",
          "adductors", "lats", "upper_back", "traps", "lower_back",
          "chest", "cardio", "neck", "full_body", "other",
        ]).describe("Primary muscle group"),
        other_muscles: z.array(z.enum([
          "abdominals", "shoulders", "biceps", "triceps", "forearms",
          "quadriceps", "hamstrings", "calves", "glutes", "abductors",
          "adductors", "lats", "upper_back", "traps", "lower_back",
          "chest", "cardio", "neck", "full_body", "other",
        ])).optional().describe("Secondary muscle groups"),
      }),
    },
    async ({ exercise }) => json(await hevy.createExerciseTemplate(apiKey, { exercise }))
  );

  // ── Routine Folders ─────────────────────────────────────────────

  server.tool(
    "hevy_get_routine_folders",
    "Get a paginated list of routine folders. Folders organize routines into groups.",
    paginationSchema,
    async (params) => json(await hevy.getRoutineFolders(apiKey, params))
  );

  server.tool(
    "hevy_get_routine_folder",
    "Get a single routine folder by ID.",
    { folderId: z.string().describe("Folder ID") },
    async ({ folderId }) => json(await hevy.getRoutineFolder(apiKey, folderId))
  );

  server.tool(
    "hevy_create_routine_folder",
    "Create a new routine folder to organize routines.",
    {
      routine_folder: z.object({
        title: z.string().describe("Folder title"),
      }),
    },
    async ({ routine_folder }) => json(await hevy.createRoutineFolder(apiKey, { routine_folder }))
  );

  // ── Exercise History ────────────────────────────────────────────

  server.tool(
    "hevy_get_exercise_history",
    "Get the workout history for a specific exercise template. Shows all sets performed across workouts with weight, reps, distance, duration, and RPE. Filter by date range. Excellent for tracking progress on individual exercises.",
    {
      exerciseTemplateId: z.string().describe("Exercise template ID"),
      start_date: z.string().optional().describe("Start date filter (ISO 8601)"),
      end_date: z.string().optional().describe("End date filter (ISO 8601)"),
    },
    async ({ exerciseTemplateId, ...params }) =>
      json(await hevy.getExerciseHistory(apiKey, exerciseTemplateId, params))
  );
}
