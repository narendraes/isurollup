/**
 * formulas.ts — Aggregation engine.
 *
 * Preset formulas + a lightweight safe expression evaluator for custom ones.
 */
import type {
  JiraIssue,
  FieldConfig,
  MetricResult,
  FormulaContext,
} from './types';
import { DEFAULT_STORY_POINTS_FIELD } from './hierarchy';

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute the metric value for a parent issue given its descendants
 * and the configured formula.
 */
export function computeAggregate(
  descendants: JiraIssue[],
  config: FieldConfig,
): MetricResult {
  const ctx = buildContext(descendants, config.storyPointsField);
  let result: MetricResult;

  switch (config.type) {
    case 'storyPointSum':
      result = applyThresholds(
        ctx.totalStoryPoints,
        `${ctx.totalStoryPoints} SP`,
        config,
        { low: 20, high: 50 },
      );
      break;

    case 'storyPointAverage': {
      const avg = ctx.childCount
        ? Math.round((ctx.totalStoryPoints / ctx.childCount) * 10) / 10
        : 0;
      result = applyThresholds(avg, `${avg} SP avg`, config, { low: 3, high: 8 });
      break;
    }

    case 'percentComplete': {
      const pct = ctx.percentComplete;
      // Inverted thresholds: higher is better
      result = {
        value: pct,
        label: `${pct}%`,
        color: pct === 100 ? 'green' : pct >= 50 ? 'yellow' : 'red',
        updatedAt: now(),
      };
      break;
    }

    case 'undoneWork':
      result = applyThresholds(
        ctx.remainingPoints,
        `${ctx.remainingPoints} SP left`,
        config,
        { low: 10, high: 30 },
      );
      break;

    case 'childCount':
      result = applyThresholds(
        ctx.childCount,
        `${ctx.childCount} items`,
        config,
        { low: 5, high: 15 },
      );
      break;

    case 'blockedCount': {
      const blocked = descendants.filter(
        (i) => i.fields?.status?.name?.toLowerCase() === 'blocked',
      ).length;
      result = applyThresholds(blocked, `${blocked} blocked`, config, {
        low: 1,
        high: 3,
      });
      break;
    }

    case 'custom':
      result = evaluateCustomFormula(ctx, config);
      break;

    default:
      result = {
        value: 0,
        label: 'N/A',
        color: 'grey',
        updatedAt: now(),
      };
  }

  result.formulaType = config.type;
  return result;
}

// ─── Formula Context Builder ────────────────────────────────────────────────

function buildContext(issues: JiraIssue[], storyPointsField?: string): FormulaContext {
  const childCount = issues.length;
  const spField = storyPointsField || DEFAULT_STORY_POINTS_FIELD;

  const totalStoryPoints = issues.reduce(
    (sum, i) => sum + getStoryPoints(i, spField),
    0,
  );

  const doneCount = issues.filter(
    (i) => i.fields?.status?.statusCategory?.key === 'done',
  ).length;

  const undoneCount = childCount - doneCount;

  const remainingPoints = issues
    .filter((i) => i.fields?.status?.statusCategory?.key !== 'done')
    .reduce((sum, i) => sum + getStoryPoints(i, spField), 0);

  const percentComplete = childCount
    ? Math.round((doneCount / childCount) * 100)
    : 0;

  return {
    children: issues,
    childCount,
    totalStoryPoints,
    doneCount,
    undoneCount,
    remainingPoints,
    percentComplete,
  };
}

// ─── Custom Formula (Safe Evaluator) ────────────────────────────────────────

/**
 * Evaluates a simple arithmetic expression over the formula context.
 *
 * Supported tokens:
 *   Variables: totalStoryPoints, doneCount, undoneCount, childCount,
 *              remainingPoints, percentComplete
 *   Operators: + - * / ( )
 *   Comparisons: > < >= <= == !=
 *   Functions: ROUND(), ABS(), MIN(), MAX(), IF(cond, then, else)
 *
 * This does NOT use eval(). It's a simple recursive-descent parser.
 * Comparison operators return 1 for true, 0 for false.
 */
function evaluateCustomFormula(
  ctx: FormulaContext,
  config: FieldConfig,
): MetricResult {
  const expr = config.formula ?? '0';

  try {
    const value = parseExpression(expr, ctx);
    const rounded = Math.round(value * 100) / 100;
    return applyThresholds(rounded, `${rounded}`, config, {
      low: 30,
      high: 70,
    });
  } catch (err) {
    console.error('Custom formula error:', err);
    return {
      value: 0,
      label: 'Formula error',
      color: 'red',
      updatedAt: now(),
    };
  }
}

// ─── Simple Recursive Descent Parser ────────────────────────────────────────
// Supports: number literals, context variables, +, -, *, /, parentheses,
//           ROUND(), ABS(), MIN(), MAX(), IF()

type TokenStream = { tokens: string[]; pos: number };

function tokenize(expr: string): string[] {
  // Updated regex to handle multi-character operators like >= <= == !=
  const regex =
    /\s*((?:\d+\.?\d*)|(?:[a-zA-Z_]\w*)|(?:>=|<=|==|!=)|[+\-*/(),<>=!])\s*/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(expr)) !== null) {
    tokens.push(match[1]);
  }
  return tokens;
}

export function parseExpression(expr: string, ctx: FormulaContext): number {
  const stream: TokenStream = { tokens: tokenize(expr), pos: 0 };
  const result = parseComparison(stream, ctx);
  return result;
}

export function createMockContext(overrides: Partial<FormulaContext> = {}): FormulaContext {
  return {
    children: [],
    childCount: 0,
    totalStoryPoints: 0,
    doneCount: 0,
    undoneCount: 0,
    remainingPoints: 0,
    percentComplete: 0,
    ...overrides,
  };
}

function peek(s: TokenStream): string | undefined {
  return s.tokens[s.pos];
}
function consume(s: TokenStream): string {
  return s.tokens[s.pos++];
}

function parseComparison(s: TokenStream, ctx: FormulaContext): number {
  let left = parseAddSub(s, ctx);
  
  while (true) {
    const token = peek(s);
    if (!token || !['>', '<', '>=', '<=', '==', '!='].includes(token)) {
      break;
    }
    
    const op = consume(s);
    const right = parseAddSub(s, ctx);
    
    switch (op) {
      case '>':
        left = left > right ? 1 : 0;
        break;
      case '<':
        left = left < right ? 1 : 0;
        break;
      case '>=':
        left = left >= right ? 1 : 0;
        break;
      case '<=':
        left = left <= right ? 1 : 0;
        break;
      case '==':
        left = Math.abs(left - right) < 1e-10 ? 1 : 0; // Use epsilon for float comparison
        break;
      case '!=':
        left = Math.abs(left - right) >= 1e-10 ? 1 : 0;
        break;
    }
  }
  
  return left;
}

function parseAddSub(s: TokenStream, ctx: FormulaContext): number {
  let left = parseMulDiv(s, ctx);
  while (peek(s) === '+' || peek(s) === '-') {
    const op = consume(s);
    const right = parseMulDiv(s, ctx);
    left = op === '+' ? left + right : left - right;
  }
  return left;
}

function parseMulDiv(s: TokenStream, ctx: FormulaContext): number {
  let left = parseUnary(s, ctx);
  while (peek(s) === '*' || peek(s) === '/') {
    const op = consume(s);
    const right = parseUnary(s, ctx);
    left = op === '*' ? left * right : right !== 0 ? left / right : 0;
  }
  return left;
}

function parseUnary(s: TokenStream, ctx: FormulaContext): number {
  if (peek(s) === '-') {
    consume(s);
    return -parseAtom(s, ctx);
  }
  return parseAtom(s, ctx);
}

function parseAtom(s: TokenStream, ctx: FormulaContext): number {
  const token = peek(s);

  if (!token) return 0;

  // Number literal
  if (/^\d/.test(token)) {
    consume(s);
    return parseFloat(token);
  }

  // Parenthesized expression
  if (token === '(') {
    consume(s); // (
    const val = parseComparison(s, ctx);
    consume(s); // )
    return val;
  }

  // Built-in functions
  const upperToken = token.toUpperCase();
  if (['ROUND', 'ABS', 'MIN', 'MAX', 'IF'].includes(upperToken)) {
    consume(s); // function name
    consume(s); // (
    const args: number[] = [];
    args.push(parseComparison(s, ctx));
    while (peek(s) === ',') {
      consume(s); // ,
      args.push(parseComparison(s, ctx));
    }
    consume(s); // )

    switch (upperToken) {
      case 'ROUND':
        return Math.round(args[0]);
      case 'ABS':
        return Math.abs(args[0]);
      case 'MIN':
        return Math.min(...args);
      case 'MAX':
        return Math.max(...args);
      case 'IF':
        // IF(cond, then, else) — cond > 0 means true
        return args[0] > 0 ? (args[1] ?? 0) : (args[2] ?? 0);
      default:
        return 0;
    }
  }

  // Context variable
  const varMap: Record<string, number> = {
    totalStoryPoints: ctx.totalStoryPoints,
    totalstorypoints: ctx.totalStoryPoints,
    doneCount: ctx.doneCount,
    donecount: ctx.doneCount,
    undoneCount: ctx.undoneCount,
    undonecount: ctx.undoneCount,
    childCount: ctx.childCount,
    childcount: ctx.childCount,
    remainingPoints: ctx.remainingPoints,
    remainingpoints: ctx.remainingPoints,
    percentComplete: ctx.percentComplete,
    percentcomplete: ctx.percentComplete,
  };

  const key = token.toLowerCase?.() ?? token;
  if (key in varMap) {
    consume(s);
    return varMap[key];
  }

  // Unknown token — skip
  consume(s);
  return 0;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStoryPoints(issue: JiraIssue, storyPointsField: string): number {
  const sp = issue.fields?.[storyPointsField];
  return typeof sp === 'number' ? sp : 0;
}

function applyThresholds(
  value: number,
  label: string,
  config: FieldConfig,
  defaults: { low: number; high: number },
): MetricResult {
  const [t1, t2] = config.thresholds ?? [defaults.low, defaults.high];
  const low = Math.min(t1, t2);
  const high = Math.max(t1, t2);
  let color: MetricResult['color'];
  if (value >= high) color = 'red';
  else if (value >= low) color = 'yellow';
  else color = 'green';

  return { value, label, color, updatedAt: now() };
}

function now(): string {
  return new Date().toISOString();
}
