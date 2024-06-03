import React, { useState, useEffect } from 'react';
import { Parser } from 'expr-eval';
import './App.css';

interface HistoryItem {
  expression: string;
  variables: { [key: string]: string };
}

const App: React.FC = () => {
  const [expression, setExpression] = useState<string>('');
  const [variables, setVariables] = useState<{ [key: string]: string }>({});
  const [result, setResult] = useState<string | number>('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('Evaluator');

  useEffect(() => {
    // Load history from local storage
    const storedHistory = localStorage.getItem('expressionHistory');
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);

  const handleExpressionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const expr = e.target.value;
    setExpression(expr);

    // Extract variables from the expression
    try {
      const parsed = Parser.parse(expr);
      const vars = parsed.variables();
      const newVariables = vars.reduce((acc, curr) => {
        acc[curr] = '';
        return acc;
      }, {} as { [key: string]: string });
      setVariables(newVariables);
    } catch (error) {
      setVariables({});
    }
  };

  const handleVariableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setVariables({
      ...variables,
      [name]: value,
    });
  };

  const handleCalculate = () => {
    try {
      const parsed = Parser.parse(expression);
      const variableValues = Object.keys(variables).reduce((acc, key) => {
        acc[key] = parseFloat(variables[key]);
        return acc;
      }, {} as { [key: string]: number });

      const result = parsed.evaluate(variableValues);
      setResult(result);

      const newHistoryItem: HistoryItem = {
        expression,
        variables: { ...variables },
      };

      const newHistory = [newHistoryItem, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('expressionHistory', JSON.stringify(newHistory));
    } catch (error) {
      setResult('Error');
    }
  };

  const handleLoadFromHistory = (item: HistoryItem) => {
    setExpression(item.expression);
    setVariables(item.variables);
    setActiveTab('Evaluator');
  };

  const handleSave = () => {
    const data = {
      expression,
      variables,
    };
    localStorage.setItem('savedExpression', JSON.stringify(data));
  };

  const handleLoad = () => {
    const savedData = localStorage.getItem('savedExpression');
    if (savedData) {
      const { expression, variables } = JSON.parse(savedData);
      setExpression(expression);
      setVariables(variables);
    }
  };

  return (
    <div className="App">
      <h1>Math Expression Evaluator</h1>
      <div className="tabs">
        <button onClick={() => setActiveTab('Evaluator')}>Evaluator</button>
        <button onClick={() => setActiveTab('History')}>History</button>
      </div>
      {activeTab === 'Evaluator' && (
        <div className="evaluator">
          <input
            type="text"
            value={expression}
            onChange={handleExpressionChange}
            placeholder="Enter expression"
          />
          <div className="variables">
            {Object.keys(variables).map((variable) => (
              <div key={variable}>
                <label>
                  {variable}:
                  <input
                    type="number"
                    name={variable}
                    value={variables[variable]}
                    onChange={handleVariableChange}
                  />
                </label>
              </div>
            ))}
          </div>
          <button onClick={handleCalculate}>Calculate</button>
          <div className="result">
            Result: {result}
          </div>
          <button onClick={handleSave}>Save Expression</button>
          <button onClick={handleLoad}>Load Expression</button>
        </div>
      )}
      {activeTab === 'History' && (
        <div className="history">
          <h2>History</h2>
          <ul>
            {history.map((item, index) => (
              <li key={index} onClick={() => handleLoadFromHistory(item)}>
                {item.expression} - {JSON.stringify(item.variables)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default App;
