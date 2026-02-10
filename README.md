# isurollup

A Jira Forge app that computes aggregated metrics from child and grandchild issues and displays them as a color-coded custom field on parent issues.

## Features

- **Story Point Sum** — Total story points across all descendants
- **Story Point Average** — Average story points per child issue
- **% Complete** — Percentage of descendant issues in "Done" status, with progress bar
- **Remaining Work** — Story points from undone issues only
- **Child Count** — Total number of descendant issues
- **Blocked Count** — Number of issues with "Blocked" status
- **Custom Formulas** — A safe DSL with variables, math, comparisons, and functions (`ROUND`, `ABS`, `MIN`, `MAX`, `IF`)

## How It Works

1. When a child issue is created, updated, or deleted, the app walks up the hierarchy and recomputes metrics for every ancestor
2. Metrics are stored in Forge Storage for fast field reads and as issue properties for JQL access
3. The custom field renders a color-coded badge (green/yellow/red) based on configurable thresholds
4. An admin page lets you configure the formula type, thresholds, hierarchy depth, and story points field

## Architecture

```
src/
  index.ts       — Forge resolver, field value resolver, event trigger handler
  types.ts       — TypeScript type definitions
  hierarchy.ts   — Jira REST API calls for parent/child traversal
  formulas.ts    — Aggregation engine and safe expression parser

static/
  field-view/    — Custom UI for the issue detail view (badge + progress bar)
  field-list/    — Custom UI for the issue list/board view (compact badge)
  admin-page/    — Configuration UI for formula type, thresholds, and settings

__tests__/
  formulas.test.ts — Unit tests for the DSL parser and aggregation engine
```

## Setup

### Prerequisites

- [Forge CLI](https://developer.atlassian.com/platform/forge/getting-started/)
- Node.js 18+

### Install

```bash
npm run install:all
```

### Development

```bash
# Type check
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch
```

### Deploy

1. Register your app with `forge register`
2. Update the `app.id` in `manifest.yml` with your app ID
3. Deploy:

```bash
npm run deploy
```

4. Install the app on your Jira site with `forge install`

## Custom Formula DSL

When using the "Custom Formula" type, you can write expressions using:

**Variables:** `totalStoryPoints`, `doneCount`, `undoneCount`, `childCount`, `remainingPoints`, `percentComplete`

**Operators:** `+`, `-`, `*`, `/`, `>`, `<`, `>=`, `<=`, `==`, `!=`

**Functions:** `ROUND()`, `ABS()`, `MIN()`, `MAX()`, `IF(condition, then, else)`

### Examples

```
# Completion percentage
(doneCount * 100) / childCount

# Risk score
IF(percentComplete < 50, 3, IF(remainingPoints > 20, 2, 1))

# Average velocity
ROUND(totalStoryPoints / MAX(childCount, 1))
```

## Permissions

- `read:jira-work` — Read issue data and hierarchy
- `write:jira-work` — Write issue properties
- `storage:app` — Persist metrics and configuration

## License

MIT
