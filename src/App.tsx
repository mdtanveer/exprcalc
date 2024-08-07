import React, { useState, useEffect } from "react";
import { Parser } from "expr-eval";
import {
  Tab,
  Tabs,
  Button,
  Form,
  Container,
  ListGroup,
  ButtonGroup,
} from "react-bootstrap";
import { getTableClient, msalInstance } from "./azureTableConfig";
import "./App.css";

interface HistoryItem {
  expression: string;
  variables: string;
  pinned: boolean;
  name: string;
  rowKey?: string;
  partitionKey?: string;
}

const App: React.FC = () => {
  const [expression, setExpression] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [inputVariables, setInputVariables] = useState<{
    [key: string]: string;
  }>({});
  const [variableAliases, setVariableAliases] = useState<{
    [key: string]: string;
  }>({});
  const [outputVariables, setOutputVariables] = useState<{
    [key: string]: string | number;
  }>({});
  const [result, setResult] = useState<string | number>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedExpressions, setSavedExpressions] = useState<HistoryItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("Evaluator");
  const _parser = new Parser();

  const sum = function (arr: Array<number>) {
    try {
      return arr.reduce((a: number, b: number) => a + b, 0);
    } catch (error) {
      return 0;
    }
  };

  _parser.functions.sum = sum;

  _parser.functions.avg = function (arr: Array<number>) {
    try {
      return sum(arr) / arr.length;
    } catch (error) {
      return 0;
    }
  };

  useEffect(() => {
    // Load history from local storage
    const storedHistory = localStorage.getItem("expressionHistory");
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);

  useEffect(() => {
    handleCalculateHelper();
  }, [inputVariables]);

  const fetchSavedExpressions = async () => {
    const tableClient = await getTableClient();
    const entities = tableClient.listEntities<HistoryItem>();
    const savedItems: HistoryItem[] = [];
    for await (const entity of entities) {
      savedItems.push({
        expression: entity.expression,
        variables: entity.variables,
        pinned: entity.pinned,
        name: entity.name,
        rowKey: entity.rowKey,
        partitionKey: entity.partitionKey,
      });
    }
    setSavedExpressions(savedItems);
  };

  const handleExpressionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const expr = e.target.value;
    setExpression(expr);

    // Extract variables from the expression
    try {
      const aliases = expr.split("\n").filter((line) => {
        return line.startsWith("//");
      });
      const noncomment_expr = expr
        .split("\n")
        .filter((line) => {
          return !line.startsWith("//");
        })
        .join("\n");
      const assignments = noncomment_expr.split(";");
      const outputVars = new Set<string>();
      const inputVars = new Set<string>();

      const aliasDict: { [key: string]: string } = {};
      aliases.forEach((alias) => {
        try {
          const [lhs, rhs] = alias.split(":");
          aliasDict[lhs.substring(2).trim()] = rhs.trim();
        } catch (error) {}
      });

      assignments.forEach((assignment) => {
        const [lhs, rhs] = assignment.split("=");
        if (rhs) {
          const parsedRhs = _parser.parse(rhs.trim());
          const varsInRhs = parsedRhs.variables();
          varsInRhs.forEach((v) => inputVars.add(v));
          outputVars.add(lhs.trim());
        } else {
          const parsed = _parser.parse(lhs.trim());
          const varsInExpr = parsed.variables();
          varsInExpr.forEach((v) => inputVars.add(v));
        }
      });

      outputVars.forEach((v) => inputVars.delete(v));

      const newInputVariables = Array.from(inputVars).reduce((acc, curr) => {
        acc[curr] = inputVariables[curr];
        return acc;
      }, {} as { [key: string]: string });

      setInputVariables(newInputVariables);
      setOutputVariables({});
      setVariableAliases(aliasDict);
    } catch (error) {
      setOutputVariables({});
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleVariableChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputVariables({
      ...inputVariables,
      [name]: value,
    });
  };

  const handleCalculateHelper = () => {
    try {
      const variableValues = Object.keys(inputVariables).reduce((acc, key) => {
        acc[key] =
          typeof inputVariables[key] == "number"
            ? parseFloat(inputVariables[key])
            : _parser.evaluate(inputVariables[key]);
        return acc;
      }, {} as { [key: string]: number });

      let exprResult = "";
      const aliases = expression.split("\n").filter((line) => {
        return line.startsWith("//");
      });
      const noncomment_expr = expression
        .split("\n")
        .filter((line) => {
          return !line.startsWith("//");
        })
        .join("\n");

      const assignments = noncomment_expr.split(";");
      const newOutputVariables: { [key: string]: number } = {};

      const aliasDict: { [key: string]: string } = {};
      aliases.forEach((alias) => {
        try {
          const [lhs, rhs] = alias.split(":");
          aliasDict[lhs.substring(2).trim()] = rhs.trim();
        } catch (error) {}
      });

      assignments.forEach((assignment) => {
        if (assignment.includes("=")) {
          const [lhs, rhs] = assignment.split("=");
          const varName = lhs.trim();
          if (!varName.endsWith(")")) {
            const parsedRhs = _parser.parse(rhs.trim());
            const value = parsedRhs.evaluate(variableValues);
            variableValues[varName] = value;
            newOutputVariables[varName] = value;
            exprResult = value;
          }
        } else {
          const parsed = _parser.parse(assignment.trim());
          exprResult = parsed.evaluate(variableValues);
        }
      });
      setResult(exprResult);
      setOutputVariables(newOutputVariables);
      setVariableAliases(aliasDict);
    } catch (error) {
      setResult("Error: " + error);
      setOutputVariables({});
      setVariableAliases({});
    }
  };

  const handleCalculate = () => {
    handleCalculateHelper();

    const newHistoryItem: HistoryItem = {
      expression,
      variables: JSON.stringify({ ...inputVariables }),
      pinned: false,
      name,
      partitionKey: "Expressions",
      rowKey: new Date().getTime().toString(),
    };

    const newHistory = [newHistoryItem, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem("expressionHistory", JSON.stringify(newHistory));
  };

  const handleLoadFromHistory = (item: HistoryItem) => {
    setExpression(item.expression);
    setInputVariables(JSON.parse(item.variables));
    setName(item.name);
    setOutputVariables({});
    setActiveTab("Evaluator");
  };

  const handleRemoveFromHistory = (index: number) => {
    const newHistory = history.filter((_, i) => i !== index);
    setHistory(newHistory);
    localStorage.setItem("expressionHistory", JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("expressionHistory");
  };

  const nameHashCode = (str: String) => {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  };

  const handleSave = async () => {
    const data = {
      expression: expression,
      variables: JSON.stringify(inputVariables, function (_k, v) {
        return v === undefined ? null : v;
      }),
      name: name,
      partitionKey: msalInstance.getAllAccounts()[0].localAccountId,
      rowKey: nameHashCode(name),
    };
    const tableClient = await getTableClient();
    await tableClient.upsertEntity(data, "Replace");
  };

  const handlePinToggle = (index: number) => {
    const newHistory = [...history];
    newHistory[index].pinned = !newHistory[index].pinned;
    setHistory(newHistory);
    localStorage.setItem("expressionHistory", JSON.stringify(newHistory));
  };

  const sortedHistory = [...history].sort(
    (a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
  );

  const renderVariableName = (variable: string) => {
    if (variableAliases[variable]) {
      return variableAliases[variable] + " (" + variable + ")";
    } else {
      return variable;
    }
  };

  return (
    <Container>
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k || "Evaluator")}
      >
        <Tab eventKey="Evaluator" title="Evaluator">
          <Form>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={handleNameChange}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Expression</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={expression}
                onChange={handleExpressionChange}
                className="mb-4"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Variables</Form.Label>
              {Object.keys(inputVariables).map((variable) => (
                <div className="container">
                  <Form.Group key={variable} className="row mb-2">
                    <Form.Label className="col">
                      {renderVariableName(variable)}:
                    </Form.Label>
                    <Form.Control
                      type="search"
                      name={variable}
                      value={inputVariables[variable]}
                      onChange={handleVariableChange}
                      className="col"
                    />
                  </Form.Group>
                </div>
              ))}
            </Form.Group>
            <ButtonGroup className="mb-3">
              <Button variant="primary" onClick={handleCalculate}>
                Calculate
              </Button>
              <Button variant="secondary" onClick={handleSave}>
                Save
              </Button>
            </ButtonGroup>
          </Form>
          <div className="container">
            <Form.Group className="row mb-2">
              <Form.Label className="col">Result:</Form.Label>
              <Form.Control
                value={
                  typeof result == "number" && !Number.isInteger(result)
                    ? result?.toFixed(2)
                    : result
                }
                className="col"
                readOnly
              />
            </Form.Group>
          </div>
          {Object.keys(outputVariables)
            .filter((variable) => {
              return variable.charAt(0) !== "$";
            })
            .map((variable) => (
              <div className="container">
                <Form.Group key={variable} className="row mb-2">
                  <Form.Label className="col">
                    {renderVariableName(variable)}:
                  </Form.Label>
                  <Form.Control
                    type="search"
                    name={variable}
                    value={
                      typeof outputVariables[variable] == "number" &&
                      !Number.isInteger(outputVariables[variable])
                        ? outputVariables[variable].toFixed(2)
                        : outputVariables[variable]
                    }
                    onChange={handleVariableChange}
                    className="col"
                    readOnly
                  />
                </Form.Group>
              </div>
            ))}
        </Tab>
        <Tab eventKey="History" title="History">
          <Button variant="danger" onClick={handleClearHistory}>
            Clear History
          </Button>
          <ListGroup>
            {sortedHistory.map((item, index) => (
              <ListGroup.Item key={index}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.expression?.slice(0, 50)}</p>
                  <Button
                    variant="info"
                    onClick={() => handleLoadFromHistory(item)}
                  >
                    Load
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handleRemoveFromHistory(index)}
                  >
                    Remove
                  </Button>
                  <Button
                    variant={item.pinned ? "warning" : "secondary"}
                    onClick={() => handlePinToggle(index)}
                  >
                    {item.pinned ? "Unpin" : "Pin"}
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Tab>
        <Tab eventKey="SavedExpressions" title="Saved Expressions">
          <Button variant="secondary" onClick={fetchSavedExpressions}>
            Refresh
          </Button>
          <ListGroup>
            {savedExpressions.map((item, index) => (
              <ListGroup.Item key={index}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.expression.slice(0, 50)}</p>
                  <Button
                    variant="info"
                    onClick={() => handleLoadFromHistory(item)}
                  >
                    Load
                  </Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default App;
