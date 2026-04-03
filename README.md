# Hevy MCP Server

MCP Server for the [Hevy API](https://api.hevyapp.com/docs/), deployed on fly.io. Connects Claude to your Hevy fitness data.

## Tools

| Tool | Description |
|------|-------------|
| `hevy_get_user_info` | User profile |
| `hevy_get_workouts` | Paginated workout list |
| `hevy_get_workout` | Single workout by ID |
| `hevy_get_workout_count` | Total workout count |
| `hevy_get_workout_events` | Update/delete events since date |
| `hevy_create_workout` | Create a new workout |
| `hevy_update_workout` | Update an existing workout |
| `hevy_get_routines` | Paginated routine list |
| `hevy_get_routine` | Single routine by ID |
| `hevy_create_routine` | Create a new routine |
| `hevy_update_routine` | Update an existing routine |
| `hevy_get_exercise_templates` | Paginated exercise template list |
| `hevy_get_exercise_template` | Single exercise template by ID |
| `hevy_create_exercise_template` | Create a custom exercise |
| `hevy_get_routine_folders` | Paginated folder list |
| `hevy_get_routine_folder` | Single folder by ID |
| `hevy_create_routine_folder` | Create a new folder |
| `hevy_get_exercise_history` | Exercise history for a template |

## Setup

### 1. Hevy API Key

1. Go to [hevy.com/settings?developer](https://hevy.com/settings?developer)
2. Generate an API key (requires Hevy Pro)

### 2. Deploy to fly.io

```bash
fly launch --no-deploy
fly secrets set \
  OAUTH_CLIENT_ID=<random-string> \
  OAUTH_CLIENT_SECRET=<random-string> \
  HEVY_API_KEY=<from-hevy-settings> \
  BASE_URL=https://hevy-mcp-connector.fly.dev
fly deploy
```

`OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` can be any random strings — they restrict access to your MCP server.

### 3. Connect Claude

In Claude Desktop go to **Settings → Connectors → Add custom connector**:

| Field | Value |
|-------|-------|
| Name | Hevy |
| Remote MCP server URL | `https://hevy-mcp-connector.fly.dev/mcp` |
| OAuth Client ID | Same value as `OAUTH_CLIENT_ID` |
| OAuth Client Secret | Same value as `OAUTH_CLIENT_SECRET` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OAUTH_CLIENT_ID` | Access control for Claude (you choose this) |
| `OAUTH_CLIENT_SECRET` | Access control for Claude (you choose this) |
| `HEVY_API_KEY` | From Hevy Developer Settings |
| `BASE_URL` | Public URL of this server (e.g. `https://hevy-mcp-connector.fly.dev`) |

## Local Development

```bash
cp .env.example .env
# fill in values
npm install
npm run dev
```
