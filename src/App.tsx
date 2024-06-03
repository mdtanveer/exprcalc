import React, { useState, useEffect } from 'react';
import { Parser } from 'expr-eval';
import { Tab, Tabs, Button, Form, Container, Row, Col, ListGroup } from 'react-bootstrap';
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

  const handleExpressionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const handleRemoveFromHistory = (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem('expressionHistory', JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('expressionHistory');
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
    <Container className="mt-4">
      <h1 className="text-center">Math Expression Evaluator</h1>
      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k as string)}>
        <Tab eventKey="Evaluator" title="Evaluator">
          <Form.Group className="mt-4">
            <Form.Label>Expression</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={expression}
              onChange={handleExpressionChange}
              placeholder="Enter expression"
            />
          </Form.Group>
          <div className="variables">
            {Object.keys(variables).map((variable) => (
              <Form.Group key={variable}>
                <Form.Label>{variable}:</Form.Label>
                <Form.Control
                  type="number"
                  name={variable}
                  value={variables[variable]}
                  onChange={handleVariableChange}
                />
              </Form.Group>
            ))}
          </div>
          <Button className="mt-2" onClick={handleCalculate}>Calculate</Button>
          <Button className="mt-2 ml-2" onClick={handleSave}>Save Expression</Button>
          <Button className="mt-2 ml-2" onClick={handleLoad}>Load Expression</Button>
          <div className="result mt-3">
            Result: {result}
          </div>
        </Tab>
        <Tab eventKey="History" title="History">
          <h2 className="mt-4">History</h2>
          <ListGroup>
            {history.map((item, index) => (
              <ListGroup.Item key={index}>
                <div onClick={() => handleLoadFromHistory(item)}>
                  {item.expression} - {JSON.stringify(item.variables)}
                </div>
                <Button variant="danger" size="sm" className="float-right" onClick={() => handleRemoveFromHistory(index)}>Remove</Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
          <Button variant="danger" className="mt-3" onClick={handleClearHistory}>Clear History</Button>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default App;
