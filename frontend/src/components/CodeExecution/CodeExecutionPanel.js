import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { useAuth } from '../../hooks/useAuth';

// Styled Components
const PanelContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 600px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const Section = styled(motion.div)`
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const SectionHeader = styled.div`
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CodeEditor = styled.textarea`
  flex: 1;
  padding: 16px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 14px;
  line-height: 1.5;
  background-color: #f8f9fa;
  
  &::placeholder {
    color: #6c757d;
  }
`;

const ResultsContainer = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f8f9fa;
`;

const TestResult = styled(motion.div)`
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 4px solid ${props => {
    switch (props.status) {
      case 'PASSED': return '#28a745';
      case 'FAILED': return '#dc3545';
      default: return '#ffc107';
    }
  }};
`;

const StatusBadge = styled.span`
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${props => {
    switch (props.status) {
      case 'PASSED': return '#d4edda';
      case 'FAILED': return '#f8d7da';
      default: return '#fff3cd';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'PASSED': return '#155724';
      case 'FAILED': return '#721c24';
      default: return '#856404';
    }
  }};
`;

const ExecuteButton = styled(motion.button)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorAlert = styled(motion.div)`
  background: #f8d7da;
  color: #721c24;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid #f5c6cb;
`;

const TestCaseInput = styled.div`
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
`;

const TestCaseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const AddTestButton = styled.button`
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    background: #0056b3;
  }
`;

const InputGroup = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #007bff;
  }
`;

// Performance monitoring hook
const usePerformanceMonitor = () => {
  const startTimeRef = useRef();
  
  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);
  
  const endTimer = useCallback((operation) => {
    if (startTimeRef.current) {
      const duration = performance.now() - startTimeRef.current;
      console.log(`🚀 ${operation} took ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  }, []);
  
  return { startTimer, endTimer };
};

// Memoized Test Case Component
const MemoizedTestCase = React.memo(({ 
  testCase, 
  index, 
  onUpdate, 
  onRemove 
}) => {
  const handleInputChange = useCallback((field, value) => {
    onUpdate(index, { ...testCase, [field]: value });
  }, [index, testCase, onUpdate]);

  const handleInputsChange = useCallback((inputIndex, value) => {
    const newInputs = [...testCase.inputs];
    newInputs[inputIndex] = value;
    onUpdate(index, { ...testCase, inputs: newInputs });
  }, [index, testCase, onUpdate]);

  const handleTypeChange = useCallback((typeIndex, value) => {
    const newTypes = [...testCase.inputTypes];
    newTypes[typeIndex] = value;
    onUpdate(index, { ...testCase, inputTypes: newTypes });
  }, [index, testCase, onUpdate]);

  const addInput = useCallback(() => {
    onUpdate(index, {
      ...testCase,
      inputs: [...testCase.inputs, ''],
      inputTypes: [...testCase.inputTypes, 'int']
    });
  }, [index, testCase, onUpdate]);

  return (
    <TestCaseInput>
      <TestCaseHeader>
        <h4>Test Case {index + 1}</h4>
        <button onClick={() => onRemove(index)} style={{ 
          background: '#dc3545', 
          color: 'white', 
          border: 'none', 
          padding: '4px 8px', 
          borderRadius: '4px', 
          cursor: 'pointer' 
        }}>
          Remove
        </button>
      </TestCaseHeader>
      
      <InputGroup>
        <Input
          type="text"
          placeholder="Test ID"
          value={testCase.id || ''}
          onChange={(e) => handleInputChange('id', e.target.value)}
        />
        <Input
          type="text"
          placeholder="Expected Result"
          value={testCase.expected || ''}
          onChange={(e) => handleInputChange('expected', e.target.value)}
        />
      </InputGroup>
      
      {testCase.inputs.map((input, inputIndex) => (
        <InputGroup key={inputIndex}>
          <Input
            type="text"
            placeholder={`Input ${inputIndex + 1}`}
            value={input}
            onChange={(e) => handleInputsChange(inputIndex, e.target.value)}
          />
          <Select
            value={testCase.inputTypes[inputIndex] || 'int'}
            onChange={(e) => handleTypeChange(inputIndex, e.target.value)}
          >
            <option value="int">Integer</option>
            <option value="string">String</option>
            <option value="vector<int>">Vector&lt;int&gt;</option>
            <option value="double">Double</option>
            <option value="bool">Boolean</option>
          </Select>
        </InputGroup>
      ))}
      
      <AddTestButton onClick={addInput}>Add Input</AddTestButton>
    </TestCaseInput>
  );
});

MemoizedTestCase.displayName = 'MemoizedTestCase';

// Main Code Execution Panel
const CodeExecutionPanel = React.memo(() => {
  const { authenticatedRequest } = useAuth();
  const { startTimer, endTimer } = usePerformanceMonitor();
  
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('cpp');
  const [functionName, setFunctionName] = useState('');
  const [functionReturnType, setFunctionReturnType] = useState('int');
  const [testCases, setTestCases] = useState([{
    id: '1',
    inputs: [''],
    inputTypes: ['int'],
    expected: ''
  }]);
  const [results, setResults] = useState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState('');
  
  // Memoized handlers
  const handleCodeChange = useCallback((e) => {
    setCode(e.target.value);
  }, []);
  
  const handleTestCaseUpdate = useCallback((index, updatedTestCase) => {
    setTestCases(prev => {
      const newTestCases = [...prev];
      newTestCases[index] = updatedTestCase;
      return newTestCases;
    });
  }, []);
  
  const handleTestCaseRemove = useCallback((index) => {
    setTestCases(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  const addTestCase = useCallback(() => {
    setTestCases(prev => [...prev, {
      id: String(prev.length + 1),
      inputs: [''],
      inputTypes: ['int'],
      expected: ''
    }]);
  }, []);
  
  const executeCode = useCallback(async () => {
    if (!code.trim() || !functionName.trim()) {
      setError('Please provide both code and function name');
      return;
    }
    
    setIsExecuting(true);
    setError('');
    startTimer();
    
    try {
      const requestData = {
        language,
        code,
        testCases: testCases.map(tc => ({
          id: parseInt(tc.id) || 1,
          inputs: tc.inputs.map(input => {
            // Parse input based on type
            if (tc.inputTypes[tc.inputs.indexOf(input)] === 'vector<int>') {
              return input.split(',').map(x => parseInt(x.trim()));
            }
            if (tc.inputTypes[tc.inputs.indexOf(input)] === 'int') {
              return parseInt(input) || 0;
            }
            return input;
          }),
          inputTypes: tc.inputTypes
        })),
        functionName,
        functionReturnType,
        expected: testCases.map(tc => {
          // Parse expected result
          try {
            return JSON.parse(tc.expected);
          } catch {
            return tc.expected;
          }
        })
      };
      
      console.log('Sending request:', requestData);
      
      const response = await authenticatedRequest('/api/products/execute-code', {
        method: 'POST',
        data: requestData
      });
      
      endTimer('Code execution');
      
      if (response.compileError) {
        setError(response.compileError);
        setResults([]);
      } else {
        setResults(response.results || []);
      }
    } catch (err) {
      endTimer('Code execution (error)');
      setError(err.response?.data?.error || err.message || 'Execution failed');
      setResults([]);
    } finally {
      setIsExecuting(false);
    }
  }, [code, functionName, language, functionReturnType, testCases, authenticatedRequest, startTimer, endTimer]);
  
  // Memoized components
  const TestCasesComponent = useMemo(() => (
    <div>
      {testCases.map((testCase, index) => (
        <MemoizedTestCase
          key={`${index}-${testCase.id}`}
          testCase={testCase}
          index={index}
          onUpdate={handleTestCaseUpdate}
          onRemove={handleTestCaseRemove}
        />
      ))}
      <AddTestButton onClick={addTestCase}>Add Test Case</AddTestButton>
    </div>
  ), [testCases, handleTestCaseUpdate, handleTestCaseRemove, addTestCase]);
  
  const ResultsComponent = useMemo(() => {
    if (results.length === 0 && !error) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px',
          color: '#6c757d' 
        }}>
          Run your code to see results
        </div>
      );
    }
    
    return (
      <div>
        {error && (
          <ErrorAlert
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </ErrorAlert>
        )}
        
        <AnimatePresence>
          {results.map((result, index) => (
            <TestResult
              key={`result-${result.id}-${index}`}
              status={result.status}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.1 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0 }}>Test Case {result.id}</h4>
                <StatusBadge status={result.status}>{result.status}</StatusBadge>
              </div>
              
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                <div><strong>Expected:</strong> {JSON.stringify(result.expected)}</div>
                <div><strong>Actual:</strong> {JSON.stringify(result.actual)}</div>
                <div><strong>Execution Time:</strong> {result.executionTimeMs}ms</div>
              </div>
            </TestResult>
          ))}
        </AnimatePresence>
      </div>
    );
  }, [results, error]);
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>💻 Code Execution Panel</h2>
      
      {/* Configuration */}
      <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Language</label>
          <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="cpp">C++</option>
          </Select>
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Function Name</label>
          <Input
            type="text"
            value={functionName}
            onChange={(e) => setFunctionName(e.target.value)}
            placeholder="e.g., twoSum"
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Return Type</label>
          <Select value={functionReturnType} onChange={(e) => setFunctionReturnType(e.target.value)}>
            <option value="int">Integer</option>
            <option value="string">String</option>
            <option value="vector<int>">Vector&lt;int&gt;</option>
            <option value="double">Double</option>
            <option value="bool">Boolean</option>
          </Select>
        </div>
      </div>
      
      <PanelContainer>
        <Section
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SectionHeader>
            <span>📝 Code Editor</span>
            <ExecuteButton
              onClick={executeCode}
              disabled={isExecuting}
              whileHover={{ scale: isExecuting ? 1 : 1.05 }}
              whileTap={{ scale: isExecuting ? 1 : 0.95 }}
            >
              {isExecuting && <LoadingSpinner />}
              {isExecuting ? 'Executing...' : '▶️ Run Code'}
            </ExecuteButton>
          </SectionHeader>
          
          <CodeEditor
            value={code}
            onChange={handleCodeChange}
            placeholder="// Write your C++ code here
int twoSum(vector<int> nums, int target) {
    // Your implementation here
    return 0;
}"
          />
        </Section>
        
        <Section
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <SectionHeader>
            <span>📊 Test Cases & Results</span>
          </SectionHeader>
          
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '20px' }}>
              <h3>Test Cases</h3>
              {TestCasesComponent}
              
              <h3 style={{ marginTop: '32px' }}>Results</h3>
              {ResultsComponent}
            </div>
          </div>
        </Section>
      </PanelContainer>
    </div>
  );
});

CodeExecutionPanel.displayName = 'CodeExecutionPanel';

export default CodeExecutionPanel;