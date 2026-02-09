import React, { useEffect, useState } from 'react';
import { view, invoke } from '@forge/bridge';
import './App.css';

const App = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [issueKey, setIssueKey] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const context = await view.getContext();
        const fieldValue = context.fieldValue;
        
        // Store issue key for refresh functionality
        const currentIssueKey = context.extension?.issue?.key;
        setIssueKey(currentIssueKey);

        if (fieldValue) {
          const parsed = JSON.parse(fieldValue);
          setMetrics(parsed);
        }
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const handleRefresh = async () => {
    if (!issueKey || refreshing) return;
    
    setRefreshing(true);
    setError(null);
    
    try {
      // Force recompute
      await invoke('forceRecompute', { issueKey });
      
      // Fetch updated metrics
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay for computation
      const freshMetrics = await invoke('getMetrics');
      
      if (freshMetrics) {
        setMetrics(freshMetrics);
      }
    } catch (err) {
      setError(`Refresh failed: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const getColorStyles = (color) => {
    const colorMap = {
      green: {
        bg: '#E3FCEF',
        text: '#006644',
        border: '#57D9A3',
      },
      yellow: {
        bg: '#FFFAE6',
        text: '#FF8B00',
        border: '#FFC400',
      },
      red: {
        bg: '#FFEBE6',
        text: '#BF2600',
        border: '#FF5630',
      },
      blue: {
        bg: '#DEEBFF',
        text: '#0747A6',
        border: '#4C9AFF',
      },
      grey: {
        bg: '#F4F5F7',
        text: '#6B778C',
        border: '#C1C7D0',
      },
    };

    return colorMap[color] || colorMap.grey;
  };

  if (loading) {
    return <div className="metrics-container">Loading...</div>;
  }

  if (error) {
    return <div className="metrics-container error">Error: {error}</div>;
  }

  if (!metrics) {
    const greyStyles = getColorStyles('grey');
    return (
      <div className="metrics-container">
        <div
          className="metrics-badge"
          style={{
            backgroundColor: greyStyles.bg,
            color: greyStyles.text,
            borderColor: greyStyles.border,
          }}
        >
          No data
        </div>
      </div>
    );
  }

  const { value, label, color, updatedAt, formulaType } = metrics;
  const colorStyles = getColorStyles(color || 'grey');
  const isPercentComplete = formulaType === 'percentComplete';
  const percentage = isPercentComplete ? Math.min(Math.max(value, 0), 100) : 0;

  return (
    <div className="metrics-container">
      <div className="metrics-header">
        <div
          className="metrics-badge"
          style={{
            backgroundColor: colorStyles.bg,
            color: colorStyles.text,
            borderColor: colorStyles.border,
          }}
          title={updatedAt ? `Updated: ${updatedAt}` : ''}
        >
          <span className="metrics-value">{label}</span>
        </div>
        
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing || !issueKey}
          title="Refresh metrics"
        >
          {refreshing ? '⟳' : '↻'}
        </button>
      </div>

      {isPercentComplete && (
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{
              width: `${percentage}%`,
              backgroundColor: colorStyles.border,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default App;
