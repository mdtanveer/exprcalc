import React, { useState, useEffect } from 'react';
import { Parser } from 'expr-eval';
import { Tab, Tabs, Button, Form, Container, ListGroup, Table, ButtonGroup } from 'react-bootstrap';
import './App.css';

interface HistoryItem {
  expression: string;
  variables: { [key: string]: string };
  pinned: boolean;
}

const App: React.FC = () => {
  const [expression, setExpression] = useState<string>('');
  const [inputVariables, setInputVariables] = useState<{ [key: string]: string }>({});
  const [outputVariables, setOutputVariables] = useState<{ [key: string]: number }>({});
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
      const assignments = expr.split(';');
      const outputVars = new Set<string>();
      const inputVars = new Set<string>();

      assignments.forEach((assignment) => {
        const [lhs, rhs] = assignment.split('=');
        if (rhs) {
          const parsedRhs = Parser.parse(rhs.trim());
          const varsInRhs = parsedRhs.variables();
          varsInRhs.forEach((v) => inputVars.add(v));
          outputVars.add(lhs.trim());
        } else {
          const parsed = Parser.parse(lhs.trim());
          const varsInExpr = parsed.variables();
          varsInExpr.forEach((v) => inputVars.add(v));
        }
      });

      outputVars.forEach((v) => inputVars.delete(v));

      const newInputVariables = Array.from(inputVars).reduce((acc, curr) => {
        acc[curr] = '';
        return acc;
      }, {} as { [key: string]: string });

      setInputVariables(newInputVariables);
      setOutputVariables({});
    } catch (error) {
      setInputVariables({});
      setOutputVariables({});
    }
  };

  const handleVariableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputVariables({
      ...inputVariables,
      [name]: value,
    });
  };

  const handleCalculate = () => {
    try {
      const variableValues = Object.keys(inputVariables).reduce((acc, key) => {
        acc[key] = parseFloat(inputVariables[key]);
        return acc;
      }, {} as { [key: string]: number });

      let exprResult = '';
      const assignments = expression.split(';');
      const newOutputVariables: { [key: string]: number } = {};

      assignments.forEach((assignment) => {
        if (assignment.includes('=')) {
          const [lhs, rhs] = assignment.split('=');
          const varName = lhs.trim();
          const parsedRhs = Parser.parse(rhs.trim());
          const value = parsedRhs.evaluate(variableValues);
          variableValues[varName] = value;
          newOutputVariables[varName] = value;
          exprResult = value;
        } else {
          const parsed = Parser.parse(assignment.trim());
          exprResult = parsed.evaluate(variableValues);
        }
      });

      setResult(exprResult);

      const newHistoryItem: HistoryItem = {
        expression,
        variables: { ...inputVariables },
        pinned: false,
      };

      const newHistory = [newHistoryItem, ...history].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('expressionHistory', JSON.stringify(newHistory));

      setOutputVariables(newOutputVariables);
    } catch (error) {
      setResult('Error');
      setOutputVariables({});
    }
  };

  const handleLoadFromHistory = (item: HistoryItem) => {
    setExpression(item.expression);
    setInputVariables(item.variables);
    setOutputVariables({});
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
      variables: inputVariables,
    };
    localStorage.setItem('savedExpression', JSON.stringify(data));
  };

  const handleLoad = () => {
    const savedData = localStorage.getItem('savedExpression');
    if (savedData) {
      const { expression, variables } = JSON.parse(savedData);
      setExpression(expression);
      setInputVariables(variables);
    }
  };

  const handlePinToggle = (index: number) => {
    const newHistory = [...history];
    newHistory[index].pinned = !newHistory[index].pinned;
    setHistory(newHistory);
    localStorage.setItem('expressionHistory', JSON.stringify(newHistory));
  };

  const sortedHistory = [...history].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <Container className="">
      <h3 className="text-center mb-4">Formula Calculator</h3>
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
            {Object.keys(inputVariables).map((variable) => (
              <Form.Group key={variable}>
                <Form.Label>{variable}:</Form.Label>
                <Form.Control
                  type="number"
                  name={variable}
                  value={inputVariables[variable]}
                  onChange={handleVariableChange}
                />
              </Form.Group>
            ))}
          </div>
          <Button className="mt-2" onClick={handleCalculate}>Calculate</Button>
          <Button className="mt-2 ml-2" onClick={handleSave} hidden>Save Expression</Button>
          <Button className="mt-2 ml-2" onClick={handleLoad} hidden>Load Expression</Button>
          <div className="result mt-3">
            Result: {result}
          </div>
          {Object.keys(outputVariables).length > 0 && (
            <Table striped bordered hover className="mt-3">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(outputVariables).map(([variable, value]) => (
                  <tr key={variable}>
                    <td>{variable}</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Tab>
        <Tab eventKey="History" title="History">
          <h2 className="mt-4">History</h2>
          <ListGroup>
            {sortedHistory.map((item, index) => (
              <ListGroup.Item key={index}>
                <div onClick={() => handleLoadFromHistory(item)}>
                  {item.expression} - {JSON.stringify(item.variables)}
                </div>
                <ButtonGroup className="float-right">
                  <Button variant="secondary" size="sm" onClick={() => handlePinToggle(index)}>
                    {item.pinned ? 'Unpin' : 'Pin'}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleRemoveFromHistory(index)}>
                    Remove
                  </Button>
                </ButtonGroup>
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
