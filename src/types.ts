// ─── Metric Result ──────────────────────────────────────────────────────────
/** Shape stored in Forge Storage and returned by the custom field resolver. */
export interface MetricResult {
  value: number;
  label: string;
  /** Colour token used by the Custom UI badge. */
  color: 'green' | 'yellow' | 'red' | 'blue' | 'grey';
  /** The formula type that produced this result. */
  formulaType?: FormulaType;
  updatedAt: string;
}

// ─── Field Configuration ────────────────────────────────────────────────────
export type FormulaType =
  | 'storyPointSum'
  | 'percentComplete'
  | 'undoneWork'
  | 'storyPointAverage'
  | 'childCount'
  | 'blockedCount'
  | 'custom';

export interface FieldConfig {
  type: FormulaType;
  /** Only used when type === 'custom'. A safe DSL expression. */
  formula?: string;
  /** Colour thresholds — [yellow, red]. Values below yellow are green. */
  thresholds?: [number, number];
  /** Max hierarchy depth to traverse (default 3). */
  maxDepth?: number;
  /** Story points field name/ID (e.g. 'story_points' or 'customfield_10016'). */
  storyPointsField?: string;
}

// ─── Jira Structures (partial) ──────────────────────────────────────────────
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary?: string;
    status?: {
      name: string;
      statusCategory: { key: string; name: string };
    };
    issuetype?: { name: string };
    parent?: { id: string; key: string };
    /** story_points might live under a custom field; adjust to your instance. */
    story_points?: number;
    [customField: string]: any;
  };
}

export interface JiraSearchResponse {
  startAt: number;
  maxResults: number;
  total: number;
  issues: JiraIssue[];
}

// ─── Trigger Event ──────────────────────────────────────────────────────────
export interface IssueTriggerEvent {
  issue: {
    id: string;
    key: string;
  };
  changelog?: {
    items: Array<{
      field: string;
      fromString: string | null;
      toString: string | null;
    }>;
  };
  atlassianId: string;
}

// ─── Custom Formula Context ─────────────────────────────────────────────────
/** Variables exposed to custom formula expressions. */
export interface FormulaContext {
  /** All descendant issues. */
  children: JiraIssue[];
  /** Total count of descendants. */
  childCount: number;
  /** Sum of story points across all descendants. */
  totalStoryPoints: number;
  /** Number of issues in "done" status category. */
  doneCount: number;
  /** Number of issues NOT in "done" status category. */
  undoneCount: number;
  /** Remaining story points (undone issues only). */
  remainingPoints: number;
  /** Percentage complete (done / total * 100). */
  percentComplete: number;
}
