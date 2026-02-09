import React, { useEffect, useState } from 'react';
import { view } from '@forge/bridge';

const App = () => {
  const [fieldValue, setFieldValue] = useState(null);

  useEffect(() => {
    const getFieldValue = async () => {
      try {
        const context = await view.getContext();
        const fv = context.extension?.fieldValue ?? context.fieldValue;
        setFieldValue(fv);
      } catch (error) {
        console.error('Failed to get context:', error);
      }
    };

    getFieldValue();
  }, []);

  const colorMap = {
    green: {
      bg: '#E3FCEF',
      text: '#006644'
    },
    yellow: {
      bg: '#FFFAE6',
      text: '#FF8B00'
    },
    red: {
      bg: '#FFEBE6',
      text: '#BF2600'
    },
    blue: {
      bg: '#DEEBFF',
      text: '#0747A6'
    },
    grey: {
      bg: '#F4F5F7',
      text: '#6B778C'
    }
  };

  const renderBadge = () => {
    if (!fieldValue) {
      return (
        <span
          style={{
            display: 'inline-block',
            height: '20px',
            padding: '1px 6px',
            backgroundColor: colorMap.grey.bg,
            color: colorMap.grey.text,
            fontSize: '11px',
            fontWeight: '500',
            lineHeight: '18px',
            borderRadius: '3px',
            whiteSpace: 'nowrap'
          }}
        >
          —
        </span>
      );
    }

    let parsedValue = fieldValue;
    if (typeof fieldValue === 'string') {
      try {
        parsedValue = JSON.parse(fieldValue);
      } catch (e) {
        console.error('Failed to parse fieldValue as JSON:', e);
        parsedValue = { value: fieldValue, label: fieldValue, color: 'grey' };
      }
    }

    const { value, label, color = 'grey' } = parsedValue;
    const colorStyle = colorMap[color] || colorMap.grey;

    return (
      <span
        style={{
          display: 'inline-block',
          height: '20px',
          padding: '1px 6px',
          backgroundColor: colorStyle.bg,
          color: colorStyle.text,
          fontSize: '11px',
          fontWeight: '500',
          lineHeight: '18px',
          borderRadius: '3px',
          whiteSpace: 'nowrap'
        }}
      >
        {label || value || '—'}
      </span>
    );
  };

  return (
    <div style={{ padding: '0', margin: '0' }}>
      {renderBadge()}
    </div>
  );
};

export default App;
