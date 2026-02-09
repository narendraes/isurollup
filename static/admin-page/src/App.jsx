import React, { useState, useEffect } from 'react';
import { invoke } from '@forge/bridge';

const styles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #f4f5f7;
  }

  .admin-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .page-header {
    margin-bottom: 32px;
  }

  .page-header h1 {
    font-size: 28px;
    font-weight: 600;
    color: #161b22;
    margin-bottom: 8px;
  }

  .page-header p {
    font-size: 14px;
    color: #626f86;
  }

  .config-form {
    background: white;
    border-radius: 4px;
    padding: 24px;
    box-shadow: 0 1px 1px rgba(9, 30, 66, 0.13), 0 0 1px rgba(9, 30, 66, 0.15);
  }

  .form-group {
    margin-bottom: 24px;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: #161b22;
    margin-bottom: 8px;
  }

  .form-label-hint {
    font-size: 12px;
    font-weight: 400;
    color: #626f86;
    margin-top: 4px;
  }

  select,
  textarea,
  input[type='number'],
  input[type='text'] {
    width: 100%;
    padding: 10px 12px;
    font-size: 14px;
    font-family: inherit;
    border: 2px solid #dfe1e6;
    border-radius: 4px;
    transition: border-color 0.2s ease-in-out;
    background-color: #fff;
    color: #161b22;
  }

  select:focus,
  textarea:focus,
  input[type='number']:focus,
  input[type='text']:focus {
    outline: none;
    border-color: #0052cc;
    box-shadow: 0 0 0 2px rgba(0, 82, 204, 0.1);
  }

  textarea {
    font-family: 'Courier New', monospace;
    min-height: 120px;
    resize: vertical;
  }

  .hidden {
    display: none;
  }

  .formula-help {
    margin-top: 12px;
    padding: 12px;
    background-color: #f4f5f7;
    border-left: 4px solid #0052cc;
    border-radius: 4px;
    font-size: 13px;
    color: #161b22;
  }

  .formula-help h4 {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #0052cc;
  }

  .formula-help p {
    margin-bottom: 8px;
    line-height: 1.5;
  }

  .formula-help p:last-child {
    margin-bottom: 0;
  }

  .formula-help code {
    background-color: #f1f2f4;
    color: #172b4d;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }

  .formula-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }

  @media (max-width: 600px) {
    .formula-section {
      grid-template-columns: 1fr;
    }
  }

  .button-group {
    display: flex;
    gap: 12px;
    margin-top: 32px;
  }

  button {
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 600;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
  }

  .btn-primary {
    background-color: #0052cc;
    color: white;
  }

  .btn-primary:hover {
    background-color: #0040a1;
  }

  .btn-primary:active {
    background-color: #002f7a;
  }

  .btn-secondary {
    background-color: #f4f5f7;
    color: #161b22;
    border: 1px solid #dfe1e6;
  }

  .btn-secondary:hover {
    background-color: #ebecf0;
  }

  .alert {
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 14px;
    margin-bottom: 24px;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .alert-success {
    background-color: #dffcf0;
    color: #216e4e;
    border-left: 4px solid #4bce97;
  }

  .alert-error {
    background-color: #ffeceb;
    color: #ae2a19;
    border-left: 4px solid #f87462;
  }

  .loading {
    opacity: 0.6;
    pointer-events: none;
  }

  .threshold-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 600px) {
    .threshold-inputs {
      grid-template-columns: 1fr;
    }
  }
`;

const FORMULA_TYPES = {
  storyPointSum: 'Total Story Points',
  storyPointAverage: 'Story Point Average',
  percentComplete: '% Complete by Story',
  undoneWork: 'Remaining Work (SP)',
  childCount: 'Child Issue Count',
  blockedCount: 'Blocked Issues Count',
  custom: 'Custom Formula',
};

const VARIABLES = [
  'totalStoryPoints',
  'doneCount',
  'undoneCount',
  'childCount',
  'remainingPoints',
  'percentComplete',
];

const FUNCTIONS = ['ROUND()', 'ABS()', 'MIN()', 'MAX()', 'IF(cond, then, else)'];

const OPERATORS = ['+', '-', '*', '/', '(', ')', '>', '<', '>=', '<=', '==', '!='];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [formulaType, setFormulaType] = useState('storyPointSum');
  const [customFormula, setCustomFormula] = useState('');
  const [yellowThreshold, setYellowThreshold] = useState(50);
  const [redThreshold, setRedThreshold] = useState(75);
  const [maxDepth, setMaxDepth] = useState(3);
  const [storyPointsField, setStoryPointsField] = useState('story_points');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await invoke('getFieldConfig');
        if (config) {
          setFormulaType(config.type || 'storyPointSum');
          setCustomFormula(config.formula || '');
          if (config.thresholds) {
            setYellowThreshold(config.thresholds[0] || 75);
            setRedThreshold(config.thresholds[1] || 50);
          }
          setMaxDepth(config.maxDepth || 3);
          setStoryPointsField(config.storyPointsField || 'story_points');
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        setAlert({
          type: 'error',
          message: 'Failed to load configuration.',
        });
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    try {
      await invoke('saveFieldConfig', {
        type: formulaType,
        formula: formulaType === 'custom' ? customFormula : undefined,
        thresholds: [yellowThreshold, redThreshold],
        maxDepth,
        storyPointsField,
      });
      setAlert({
        type: 'success',
        message: 'Configuration saved successfully!',
      });
      setTimeout(() => setAlert(null), 5000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setAlert({
        type: 'error',
        message: `Failed to save configuration: ${error.message || 'Unknown error'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormulaType('storyPointSum');
    setCustomFormula('');
    setYellowThreshold(75);
    setRedThreshold(50);
    setMaxDepth(3);
    setStoryPointsField('story_points');
    setAlert(null);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="admin-container">
        <div className="page-header">
          <h1>Field Configuration</h1>
          <p>Configure computed child metrics formula, thresholds, and hierarchy depth.</p>
        </div>

        {alert && (
          <div className={`alert alert-${alert.type}`}>
            {alert.message}
          </div>
        )}

        <form className={`config-form ${saving || loading ? 'loading' : ''}`} onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label" htmlFor="formula-type">
              Formula Type
            </label>
            <select
              id="formula-type"
              value={formulaType}
              onChange={(e) => setFormulaType(e.target.value)}
              disabled={loading || saving}
            >
              {Object.entries(FORMULA_TYPES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {formulaType === 'custom' && (
            <div className="form-group">
              <label className="form-label" htmlFor="custom-formula">
                Custom Formula
              </label>
              <textarea
                id="custom-formula"
                value={customFormula}
                onChange={(e) => setCustomFormula(e.target.value)}
                placeholder="e.g. ROUND(totalStoryPoints / childCount)"
                disabled={loading || saving}
              />
              <div className="formula-help">
                <h4>Available Variables</h4>
                <p>{VARIABLES.join(', ')}</p>
                <h4>Available Functions</h4>
                <p>{FUNCTIONS.join(', ')}</p>
                <h4>Available Operators</h4>
                <p>{OPERATORS.join(', ')}</p>
                <p>Example: <code>IF(percentComplete >= 80, 1, 0)</code></p>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Colour Thresholds</label>
            <p className="form-label-hint">
              Values above yellow threshold show yellow, above red threshold show red.
            </p>
            <div className="threshold-inputs">
              <div>
                <label className="form-label" htmlFor="yellow-threshold">
                  Yellow Threshold
                </label>
                <input
                  id="yellow-threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={yellowThreshold}
                  onChange={(e) => setYellowThreshold(Number(e.target.value))}
                  disabled={loading || saving}
                />
              </div>
              <div>
                <label className="form-label" htmlFor="red-threshold">
                  Red Threshold
                </label>
                <input
                  id="red-threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={redThreshold}
                  onChange={(e) => setRedThreshold(Number(e.target.value))}
                  disabled={loading || saving}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="max-depth">
              Max Hierarchy Depth
            </label>
            <p className="form-label-hint">
              Maximum levels of child issues to traverse (1-5, default 3).
            </p>
            <input
              id="max-depth"
              type="number"
              min="1"
              max="5"
              value={maxDepth}
              onChange={(e) => setMaxDepth(Number(e.target.value))}
              disabled={loading || saving}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="story-points-field">
              Story Points Field
            </label>
            <p className="form-label-hint">
              Field name or ID for story points (e.g. 'story_points' or 'customfield_10016').
            </p>
            <input
              id="story-points-field"
              type="text"
              value={storyPointsField}
              onChange={(e) => setStoryPointsField(e.target.value)}
              placeholder="story_points"
              disabled={loading || saving}
            />
          </div>

          <div className="button-group">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || saving || (formulaType === 'custom' && !customFormula.trim())}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              disabled={loading || saving}
            >
              Reset to Defaults
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
