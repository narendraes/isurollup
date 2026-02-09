/**
 * index.ts — Main entry point for the Forge app.
 *
 * Exports:
 *   handler             — Forge Resolver for Custom UI bridge calls
 *   computeFieldValue   — Custom field value resolver
 *   recomputeParentMetrics — Event trigger handler
 */
import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
import { getDescendants, getAncestorKeys } from './hierarchy';
import { computeAggregate } from './formulas';
import type {
  FieldConfig,
  MetricResult,
  IssueTriggerEvent,
} from './types';

// ─── Defaults ───────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: FieldConfig = { 
  type: 'storyPointSum',
  storyPointsField: 'story_points'
};

// ─── Resolver (Custom UI bridge) ────────────────────────────────────────────
const resolver = new Resolver();

/**
 * Called by the admin-page Custom UI to persist config.
 */
resolver.define('saveFieldConfig', async ({ payload }: any) => {
  const config: FieldConfig = {
    type: payload.type ?? 'storyPointSum',
    formula: payload.formula,
    thresholds: payload.thresholds,
    maxDepth: payload.maxDepth,
    storyPointsField: payload.storyPointsField ?? 'story_points',
  };
  await storage.set('global-field-config', config);
  return { ok: true };
});

/**
 * Called by the admin-page Custom UI to read current config.
 */
resolver.define('getFieldConfig', async () => {
  const config = await storage.get('global-field-config');
  return config ?? DEFAULT_CONFIG;
});

/**
 * Called by field-view / field-list Custom UI to get the metric value
 * for a specific issue (alternative to the fieldValue from context).
 */
resolver.define('getMetrics', async ({ context }: any) => {
  const issueKey: string =
    context?.extension?.issue?.key ?? context?.extension?.issueKey;
  if (!issueKey) return null;
  const data = await storage.get(`metrics-${issueKey}`);
  return data ?? null;
});

/**
 * Force-recompute for a single parent (called from admin UI).
 */
resolver.define('forceRecompute', async ({ payload }: any) => {
  const parentKey: string = payload.issueKey;
  if (!parentKey) return { ok: false, error: 'Missing issueKey' };
  await recomputeForParent(parentKey);
  return { ok: true };
});

export const handler = resolver.getDefinitions();

// ─── Custom Field Value Resolver ────────────────────────────────────────────
/**
 * Forge calls this when Jira needs the field value for an issue.
 * We return the pre-computed JSON string from Forge Storage.
 */
export async function computeFieldValue({ context }: any): Promise<string | null> {
  const issueKey: string = context?.extension?.issue?.key;
  if (!issueKey) return null;

  const metrics: MetricResult | null = await storage.get(`metrics-${issueKey}`);
  if (!metrics) {
    // First access — compute on the fly so the field isn't blank.
    const freshMetrics = await recomputeForParent(issueKey);
    return freshMetrics ? JSON.stringify(freshMetrics) : null;
  }

  return JSON.stringify(metrics);
}

// ─── Event Trigger ──────────────────────────────────────────────────────────
/**
 * Fires on child/grandchild create / update / delete.
 * Walks up the hierarchy and recomputes every ancestor.
 * Uses debouncing to prevent redundant calculations during bulk operations.
 */
export async function recomputeParentMetrics(
  event: IssueTriggerEvent,
): Promise<void> {
  const issueKey = event.issue?.key;
  if (!issueKey) return;

  const config = await getConfig();
  const maxDepth = config.maxDepth ?? 3;

  // Get all ancestors that might need updating
  const ancestors = await getAncestorKeys(issueKey, maxDepth);

  // Also recompute for the issue itself (it might be a parent too)
  const keysToRecompute = [issueKey, ...ancestors];

  // Schedule debounced recomputation for each key
  for (const key of keysToRecompute) {
    await scheduleDebounced(key);
  }
}

// ─── Debouncing ─────────────────────────────────────────────────────────────
const DEBOUNCE_WINDOW_MS = 5000; // 5 second window for deduplication

/**
 * Schedule a recomputation for the given key with rate limiting.
 * Uses a simple time-based lock to prevent excessive recomputations.
 */
async function scheduleDebounced(issueKey: string): Promise<void> {
  const lockKey = `recompute-lock-${issueKey}`;
  const now = Date.now();
  
  try {
    // Check if we recently computed for this key
    const lastCompute = await storage.get(lockKey);
    if (lastCompute && (now - lastCompute.timestamp) < DEBOUNCE_WINDOW_MS) {
      // Skip this recomputation - we did it recently
      console.log(`Skipping recomputation for ${issueKey} (debounced)`);
      return;
    }
    
    // Set lock with TTL and perform computation
    await storage.set(lockKey, { timestamp: now });
    await recomputeForParent(issueKey);
    
  } catch (err) {
    // Fall back to immediate execution if debouncing fails
    console.warn(`Debouncing failed for ${issueKey}, executing anyway:`, err);
    await recomputeForParent(issueKey);
  }
}

// ─── Core Recomputation ─────────────────────────────────────────────────────

async function recomputeForParent(parentKey: string): Promise<MetricResult | null> {
  try {
    const config = await getConfig();
    const descendants = await getDescendants(
      parentKey, 
      config.maxDepth ?? 3,
      config.storyPointsField ?? 'story_points'
    );

    // No children → nothing to aggregate
    if (descendants.length === 0) {
      await storage.delete(`metrics-${parentKey}`);
      return null;
    }

    const metrics = computeAggregate(descendants, config);

    // Persist in Forge Storage (fast reads for the field resolver)
    await storage.set(`metrics-${parentKey}`, metrics);

    // Also write as an issue property (for JQL / external tools)
    try {
      await api.asApp().requestJira(
        route`/rest/api/3/issue/${parentKey}/properties/isurollup`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metrics),
        },
      );
    } catch (propErr) {
      // Non-fatal — the field still works via Forge Storage
      console.warn(`Could not set issue property on ${parentKey}:`, propErr);
    }

    return metrics;
  } catch (err) {
    console.error(`Recomputation failed for ${parentKey}:`, err);
    return null;
  }
}

async function getConfig(): Promise<FieldConfig> {
  const config = await storage.get('global-field-config');
  return (config as FieldConfig) ?? DEFAULT_CONFIG;
}
