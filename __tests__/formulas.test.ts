/**
 * Unit tests for formulas.ts
 * 
 * Tests the DSL parser, computation engine, and edge cases.
 */
import { computeAggregate, parseExpression, createMockContext } from '../src/formulas';
import type { FieldConfig, JiraIssue, FormulaContext } from '../src/types';

describe('Formula Parser', () => {
  let ctx: FormulaContext;

  beforeEach(() => {
    ctx = createMockContext({
      childCount: 10,
      totalStoryPoints: 50,
      doneCount: 7,
      undoneCount: 3,
      remainingPoints: 15,
      percentComplete: 70,
    });
  });

  describe('Basic arithmetic', () => {
    test('should parse numbers', () => {
      expect(parseExpression('42', ctx)).toBe(42);
      expect(parseExpression('3.14', ctx)).toBe(3.14);
      expect(parseExpression('0', ctx)).toBe(0);
    });

    test('should parse variables', () => {
      expect(parseExpression('childCount', ctx)).toBe(10);
      expect(parseExpression('totalStoryPoints', ctx)).toBe(50);
      expect(parseExpression('percentComplete', ctx)).toBe(70);
    });

    test('should handle case insensitive variables', () => {
      expect(parseExpression('childcount', ctx)).toBe(10);
      expect(parseExpression('CHILDCOUNT', ctx)).toBe(10);
      expect(parseExpression('totalstorypoints', ctx)).toBe(50);
    });

    test('should perform basic math operations', () => {
      expect(parseExpression('5 + 3', ctx)).toBe(8);
      expect(parseExpression('10 - 4', ctx)).toBe(6);
      expect(parseExpression('6 * 7', ctx)).toBe(42);
      expect(parseExpression('15 / 3', ctx)).toBe(5);
    });

    test('should respect operator precedence', () => {
      expect(parseExpression('2 + 3 * 4', ctx)).toBe(14);
      expect(parseExpression('(2 + 3) * 4', ctx)).toBe(20);
      expect(parseExpression('2 * 3 + 4', ctx)).toBe(10);
    });

    test('should handle unary minus', () => {
      expect(parseExpression('-5', ctx)).toBe(-5);
      expect(parseExpression('-(10 + 5)', ctx)).toBe(-15);
    });
  });

  describe('Comparison operators', () => {
    test('should handle greater than', () => {
      expect(parseExpression('10 > 5', ctx)).toBe(1);
      expect(parseExpression('5 > 10', ctx)).toBe(0);
      expect(parseExpression('percentComplete > 50', ctx)).toBe(1);
      expect(parseExpression('percentComplete > 80', ctx)).toBe(0);
    });

    test('should handle less than', () => {
      expect(parseExpression('5 < 10', ctx)).toBe(1);
      expect(parseExpression('10 < 5', ctx)).toBe(0);
      expect(parseExpression('doneCount < undoneCount', ctx)).toBe(0);
    });

    test('should handle greater than or equal', () => {
      expect(parseExpression('10 >= 10', ctx)).toBe(1);
      expect(parseExpression('10 >= 5', ctx)).toBe(1);
      expect(parseExpression('5 >= 10', ctx)).toBe(0);
    });

    test('should handle less than or equal', () => {
      expect(parseExpression('5 <= 10', ctx)).toBe(1);
      expect(parseExpression('10 <= 10', ctx)).toBe(1);
      expect(parseExpression('10 <= 5', ctx)).toBe(0);
    });

    test('should handle equality', () => {
      expect(parseExpression('10 == 10', ctx)).toBe(1);
      expect(parseExpression('10 == 5', ctx)).toBe(0);
      expect(parseExpression('3.0 == 3', ctx)).toBe(1);
    });

    test('should handle inequality', () => {
      expect(parseExpression('10 != 5', ctx)).toBe(1);
      expect(parseExpression('10 != 10', ctx)).toBe(0);
    });

    test('should handle floating point comparisons', () => {
      expect(parseExpression('0.1 + 0.2 == 0.3', ctx)).toBe(1); // Should use epsilon comparison
    });
  });

  describe('Built-in functions', () => {
    test('should handle ROUND function', () => {
      expect(parseExpression('ROUND(3.7)', ctx)).toBe(4);
      expect(parseExpression('ROUND(3.3)', ctx)).toBe(3);
      expect(parseExpression('ROUND(-2.8)', ctx)).toBe(-3);
    });

    test('should handle ABS function', () => {
      expect(parseExpression('ABS(-5)', ctx)).toBe(5);
      expect(parseExpression('ABS(5)', ctx)).toBe(5);
      expect(parseExpression('ABS(0)', ctx)).toBe(0);
    });

    test('should handle MIN function', () => {
      expect(parseExpression('MIN(5, 3)', ctx)).toBe(3);
      expect(parseExpression('MIN(10, 20, 5)', ctx)).toBe(5);
      expect(parseExpression('MIN(doneCount, undoneCount)', ctx)).toBe(3);
    });

    test('should handle MAX function', () => {
      expect(parseExpression('MAX(5, 3)', ctx)).toBe(5);
      expect(parseExpression('MAX(10, 20, 5)', ctx)).toBe(20);
      expect(parseExpression('MAX(doneCount, undoneCount)', ctx)).toBe(7);
    });

    test('should handle IF function with comparisons', () => {
      expect(parseExpression('IF(percentComplete > 80, 1, 0)', ctx)).toBe(0);
      expect(parseExpression('IF(percentComplete >= 70, 1, 0)', ctx)).toBe(1);
      expect(parseExpression('IF(doneCount > undoneCount, 100, 0)', ctx)).toBe(100);
    });

    test('should handle nested IF functions', () => {
      expect(parseExpression('IF(percentComplete >= 90, 3, IF(percentComplete >= 70, 2, 1))', ctx)).toBe(2);
    });

    test('should handle complex expressions in IF conditions', () => {
      expect(parseExpression('IF((doneCount * 100) / childCount >= 70, 1, 0)', ctx)).toBe(1);
    });
  });

  describe('Complex expressions', () => {
    test('should handle complex mathematical formulas', () => {
      const result = parseExpression('(totalStoryPoints / childCount) * 2 + 1', ctx);
      expect(result).toBe(11); // (50/10) * 2 + 1 = 5 * 2 + 1 = 11
    });

    test('should handle expressions with multiple comparisons', () => {
      expect(parseExpression('(percentComplete >= 50) * 10', ctx)).toBe(10);
      expect(parseExpression('(percentComplete < 50) * 10', ctx)).toBe(0);
    });

    test('should handle conditional scoring', () => {
      const formula = 'IF(percentComplete >= 90, 10, IF(percentComplete >= 70, 7, IF(percentComplete >= 50, 5, 0)))';
      expect(parseExpression(formula, ctx)).toBe(7);
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle empty expressions', () => {
      expect(parseExpression('', ctx)).toBe(0);
      expect(parseExpression(' ', ctx)).toBe(0);
    });

    test('should handle unknown variables', () => {
      expect(parseExpression('unknownVar', ctx)).toBe(0);
    });

    test('should handle division by zero', () => {
      expect(parseExpression('10 / 0', ctx)).toBe(0);
    });

    test('should handle malformed parentheses gracefully', () => {
      // These should not crash, even if they parse incorrectly
      expect(() => parseExpression('(5 + 3', ctx)).not.toThrow();
      expect(() => parseExpression('5 + 3)', ctx)).not.toThrow();
    });

    test('should handle unknown functions', () => {
      expect(() => parseExpression('UNKNOWN(5)', ctx)).not.toThrow();
    });
  });

  describe('Real-world formula examples', () => {
    test('should calculate completion percentage', () => {
      const formula = '(doneCount * 100) / childCount';
      expect(parseExpression(formula, ctx)).toBe(70);
    });

    test('should calculate remaining work percentage', () => {
      const formula = '(remainingPoints * 100) / totalStoryPoints';
      expect(parseExpression(formula, ctx)).toBe(30);
    });

    test('should calculate risk score based on multiple factors', () => {
      const formula = 'IF(percentComplete < 50, 3, IF(remainingPoints > 20, 2, 1))';
      expect(parseExpression(formula, ctx)).toBe(1); // percentComplete = 70, remainingPoints = 15
    });

    test('should handle velocity calculation', () => {
      const formula = 'totalStoryPoints / MAX(childCount, 1)';
      expect(parseExpression(formula, ctx)).toBe(5);
    });
  });
});

describe('Aggregate computation', () => {
  const mockIssues: JiraIssue[] = [
    {
      id: '1',
      key: 'PROJ-1',
      fields: {
        summary: 'Task 1',
        status: {
          name: 'Done',
          statusCategory: { key: 'done', name: 'Done' }
        },
        issuetype: { name: 'Story' },
        story_points: 5
      }
    },
    {
      id: '2',
      key: 'PROJ-2',
      fields: {
        summary: 'Task 2',
        status: {
          name: 'In Progress',
          statusCategory: { key: 'indeterminate', name: 'In Progress' }
        },
        issuetype: { name: 'Story' },
        story_points: 3
      }
    },
    {
      id: '3',
      key: 'PROJ-3',
      fields: {
        summary: 'Task 3',
        status: {
          name: 'Done',
          statusCategory: { key: 'done', name: 'Done' }
        },
        issuetype: { name: 'Story' },
        story_points: 8
      }
    }
  ];

  test('should compute story point sum correctly', () => {
    const config: FieldConfig = { type: 'storyPointSum' };
    const result = computeAggregate(mockIssues, config);
    expect(result.value).toBe(16);
    expect(result.label).toBe('16 SP');
  });

  test('should compute percentage complete correctly', () => {
    const config: FieldConfig = { type: 'percentComplete' };
    const result = computeAggregate(mockIssues, config);
    expect(result.value).toBe(67); // 2 out of 3 done = 66.67, rounded to 67
    expect(result.label).toBe('67%');
  });

  test('should compute remaining work correctly', () => {
    const config: FieldConfig = { type: 'undoneWork' };
    const result = computeAggregate(mockIssues, config);
    expect(result.value).toBe(3); // Only PROJ-2 with 3 points is not done
    expect(result.label).toBe('3 SP left');
  });

  test('should handle custom formulas', () => {
    const config: FieldConfig = {
      type: 'custom',
      formula: 'IF(percentComplete >= 60, totalStoryPoints, 0)'
    };
    const result = computeAggregate(mockIssues, config);
    expect(result.value).toBe(16); // percentComplete is 67%, so return totalStoryPoints
  });

  test('should apply thresholds correctly', () => {
    const config: FieldConfig = {
      type: 'storyPointSum',
      thresholds: [10, 20]
    };
    const result = computeAggregate(mockIssues, config);
    expect(result.color).toBe('yellow'); // 16 is between 10 and 20
  });

  test('should handle empty issues list', () => {
    const config: FieldConfig = { type: 'storyPointSum' };
    const result = computeAggregate([], config);
    expect(result.value).toBe(0);
  });

  test('should handle configurable story points field', () => {
    const customIssues = mockIssues.map(issue => ({
      ...issue,
      fields: {
        ...issue.fields,
        customfield_10016: issue.fields.story_points, // Custom field
      }
    }));

    const config: FieldConfig = {
      type: 'storyPointSum',
      storyPointsField: 'customfield_10016'
    };
    const result = computeAggregate(customIssues, config);
    expect(result.value).toBe(16); // Should work with custom field
  });
});