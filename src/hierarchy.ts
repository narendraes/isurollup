/**
 * hierarchy.ts — Traverses parent → child → grandchild relationships
 * using JQL and the Jira REST API via the Forge bridge.
 */
import api, { route } from '@forge/api';
import type { JiraIssue, JiraSearchResponse } from './types';

// ─── Configuration ──────────────────────────────────────────────────────────
const PAGE_SIZE = 100; // Jira search max per page
const DEFAULT_MAX_DEPTH = 3; // parent → child → grandchild

/**
 * Default story-point field name.
 * Many Jira Cloud instances store story points in a custom field.
 * This can be overridden via the admin configuration.
 */
export const DEFAULT_STORY_POINTS_FIELD = 'story_points';

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Returns every descendant of `parentKey` up to `maxDepth` levels deep.
 * Depth 1 = direct children, depth 2 = + grandchildren, etc.
 */
export async function getDescendants(
  parentKey: string,
  maxDepth: number = DEFAULT_MAX_DEPTH,
  storyPointsField: string = DEFAULT_STORY_POINTS_FIELD,
): Promise<JiraIssue[]> {
  const all: JiraIssue[] = [];
  await collectDescendants(parentKey, 1, maxDepth, all, new Set(), storyPointsField);
  return all;
}

/**
 * Given an issue key, walk up to find its top-most ancestor within
 * `maxDepth` levels. Returns an array of ancestor keys (closest first)
 * that should all have their metrics recomputed.
 */
export async function getAncestorKeys(
  issueKey: string,
  maxDepth: number = DEFAULT_MAX_DEPTH,
): Promise<string[]> {
  const ancestors: string[] = [];
  let currentKey: string | null = issueKey;

  for (let i = 0; i < maxDepth && currentKey; i++) {
    const parentKey = await getParentKey(currentKey);
    if (!parentKey) break;
    ancestors.push(parentKey);
    currentKey = parentKey;
  }

  return ancestors; // closest parent first
}

/**
 * Fetch the parent key of a single issue.  Returns null if no parent.
 */
export async function getParentKey(issueKey: string): Promise<string | null> {
  try {
    const res = await api.asApp().requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=parent`,
      { method: 'GET' },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.fields?.parent?.key ?? null;
  } catch {
    return null;
  }
}

// ─── Internals ──────────────────────────────────────────────────────────────

async function collectDescendants(
  parentKey: string,
  currentDepth: number,
  maxDepth: number,
  accumulator: JiraIssue[],
  visited: Set<string>,
  storyPointsField: string,
): Promise<void> {
  if (currentDepth > maxDepth) return;
  if (visited.has(parentKey)) return; // prevent cycles
  visited.add(parentKey);

  const children = await fetchChildren(parentKey, storyPointsField);

  for (const child of children) {
    if (visited.has(child.key)) continue;
    accumulator.push(child);
    // Recurse for grandchildren etc.
    await collectDescendants(child.key, currentDepth + 1, maxDepth, accumulator, visited, storyPointsField);
  }
}

/**
 * Paginated JQL search for direct children of a given parent key.
 */
async function fetchChildren(parentKey: string, storyPointsField: string): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let startAt = 0;
  let total = Infinity;

  const fields = [
    'summary',
    'status',
    'issuetype',
    'parent',
    storyPointsField,
    // Add additional custom field IDs here as needed:
    // 'customfield_10016',  // example: story points
    // 'timetracking',       // for logged time
  ].join(',');

  while (startAt < total) {
    const jql = `parent = "${parentKey}" ORDER BY created ASC`;
    const res = await api.asApp().requestJira(
      route`/rest/api/3/search?jql=${jql}&startAt=${startAt}&maxResults=${PAGE_SIZE}&fields=${fields}`,
      { method: 'GET' },
    );

    if (!res.ok) {
      console.error(`JQL search failed for parent=${parentKey}: ${res.status}`);
      break;
    }

    const data: JiraSearchResponse = await res.json();
    total = data.total;
    issues.push(...data.issues);
    startAt += PAGE_SIZE;
  }

  return issues;
}
