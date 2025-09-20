import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { usePerformanceMonitor, useRenderPerformance, useScrollPerformance } from '../../hooks/usePerformanceMonitor';

// Styled Components
const DashboardContainer = styled.div`
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
`;

const MetricCard = styled(motion.div)`
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border-left: 4px solid ${props => props.color || '#007bff'};
`;

const MetricTitle = styled.h3`
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
`;

const MetricValue = styled.div`
  font-size: 28px;
  font-weight: 700;
  color: ${props => props.color || '#007bff'};
  margin-bottom: 8px;
`;

const MetricDescription = styled.div`
  font-size: 12px;
  color: #666;
`;

const ChartContainer = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
`;

const ChartTitle = styled.h3`
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
`;

const TimelineContainer = styled.div`
  height: 200px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
`;

const TimelineItem = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  &:last-child {
    border-bottom: none;
  }
`;

const StatusIndicator = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => {
    switch (props.status) {
      case 'success': return '#28a745';
      case 'warning': return '#ffc107';
      case 'error': return '#dc3545';
      default: return '#6c757d';
    }
  }};
  margin-right: 8px;
`;

const ControlPanel = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
`;

const Button = styled.button`
  background: ${props => props.variant === 'secondary' ? '#6c757d' : '#007bff'};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover {
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
`;

const ProgressFill = styled(motion.div)`
  height: 100%;
  background: linear-gradient(90deg, #007bff, #28a745);
  border-radius: 4px;
`;

// Performance Score Calculator
const calculatePerformanceScore = (summary) => {
  let score = 100;

  // Deduct points for poor performance
  if (summary.lcp > 2500) score -= 20; // LCP over 2.5s
  if (summary.fid > 100) score -= 15;  // FID over 100ms
  if (summary.cls > 0.1) score -= 15;  // CLS over 0.1

  // Navigation timing penalties
  const nav = summary.navigation || {};
  if (nav.ttfb > 600) score -= 10;     // TTFB over 600ms
  if (nav.domContentLoaded > 1500) score -= 10; // DCL over 1.5s

  // Resource loading penalties
  const resources = summary.resources || {};
  if (resources.avgDuration > 500) score -= 10; // Avg resource load over 500ms

  return Math.max(0, Math.min(100, Math.round(score)));
};

// Get score color
const getScoreColor = (score) => {
  if (score >= 90) return '#28a745';
  if (score >= 70) return '#ffc107';
  return '#dc3545';
};

// Memoized Metric Card Component
const MemoizedMetricCard = React.memo(({ title, value, unit, description, color, animationDelay = 0 }) => (
  <MetricCard
    color={color}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: animationDelay }}
  >
    <MetricTitle>{title}</MetricTitle>
    <MetricValue color={color}>
      {typeof value === 'number' ? value.toFixed(1) : value}
      {unit && <span style={{ fontSize: '16px', fontWeight: '400' }}>{unit}</span>}
    </MetricValue>
    <MetricDescription>{description}</MetricDescription>
  </MetricCard>
));

MemoizedMetricCard.displayName = 'MemoizedMetricCard';

// Main Performance Dashboard Component
const PerformanceDashboard = React.memo(() => {
  const performanceMonitor = usePerformanceMonitor('PerformanceDashboard');
  useRenderPerformance('PerformanceDashboard');
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [summary, setSummary] = useState({});
  const [customMetrics, setCustomMetrics] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [refreshCount, setRefreshCount] = useState(0);

  // Refresh metrics
  const refreshMetrics = useCallback(() => {
    performanceMonitor.startTimer('metrics_refresh');
    
    const newSummary = performanceMonitor.getPerformanceSummary();
    const componentMetrics = performanceMonitor.getComponentMetrics();
    const memoryUsage = performanceMonitor.getMemoryUsage();
    
    setSummary({
      ...newSummary,
      memory: memoryUsage
    });
    
    setCustomMetrics(componentMetrics.slice(-20)); // Keep last 20 metrics
    setRefreshCount(prev => prev + 1);
    
    performanceMonitor.endTimer({ refresh: refreshCount + 1 });
  }, [performanceMonitor, refreshCount]);

  // Auto-refresh metrics
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(refreshMetrics, 2000);
    return () => clearInterval(interval);
  }, [isMonitoring, refreshMetrics]);

  // Initial load
  useEffect(() => {
    refreshMetrics();
  }, []);

  // Run performance test
  const runPerformanceTest = useCallback(async () => {
    setTestResults([]);
    performanceMonitor.startTimer('performance_test');

    const tests = [
      { name: 'DOM Manipulation', duration: 100 },
      { name: 'Memory Allocation', duration: 150 },
      { name: 'Scroll Performance', duration: 200 },
      { name: 'Component Render', duration: 80 },
      { name: 'API Response', duration: 300 },
    ];

    for (const test of tests) {
      // Simulate test execution
      await new Promise(resolve => setTimeout(resolve, test.duration + Math.random() * 100));
      
      const result = {
        name: test.name,
        status: Math.random() > 0.2 ? 'success' : Math.random() > 0.5 ? 'warning' : 'error',
        duration: test.duration + Math.random() * 50,
        timestamp: Date.now()
      };
      
      setTestResults(prev => [...prev, result]);
    }

    performanceMonitor.endTimer({ testsRun: tests.length });
  }, [performanceMonitor]);

  // Clear all metrics
  const clearMetrics = useCallback(() => {
    setCustomMetrics([]);
    setTestResults([]);
    setSummary({});
  }, []);

  // Toggle monitoring
  const toggleMonitoring = useCallback(() => {
    setIsMonitoring(prev => !prev);
  }, []);

  // Memoized performance score
  const performanceScore = useMemo(() => {
    return calculatePerformanceScore(summary);
  }, [summary]);

  // Memoized metrics cards
  const metricsCards = useMemo(() => [
    {
      title: 'Performance Score',
      value: performanceScore,
      unit: '/100',
      description: 'Overall performance rating',
      color: getScoreColor(performanceScore)
    },
    {
      title: 'Largest Contentful Paint',
      value: summary.lcp || 0,
      unit: 'ms',
      description: 'Time to largest element paint',
      color: summary.lcp > 2500 ? '#dc3545' : summary.lcp > 1000 ? '#ffc107' : '#28a745'
    },
    {
      title: 'First Input Delay',
      value: summary.fid || 0,
      unit: 'ms',
      description: 'Time to first interaction',
      color: summary.fid > 100 ? '#dc3545' : summary.fid > 50 ? '#ffc107' : '#28a745'
    },
    {
      title: 'Cumulative Layout Shift',
      value: summary.cls || 0,
      unit: '',
      description: 'Visual stability metric',
      color: summary.cls > 0.1 ? '#dc3545' : summary.cls > 0.05 ? '#ffc107' : '#28a745'
    },
    {
      title: 'Time to First Byte',
      value: summary.navigation?.ttfb || 0,
      unit: 'ms',
      description: 'Server response time',
      color: '#17a2b8'
    },
    {
      title: 'Render Count',
      value: performanceMonitor.renderCount || 0,
      unit: '',
      description: 'Component re-renders',
      color: '#6f42c1'
    },
    {
      title: 'Memory Usage',
      value: summary.memory ? (summary.memory.usedJSHeapSize / 1024 / 1024) : 0,
      unit: 'MB',
      description: 'JavaScript heap size',
      color: '#fd7e14'
    },
    {
      title: 'Resources Loaded',
      value: summary.resources?.count || 0,
      unit: '',
      description: 'Total network requests',
      color: '#20c997'
    }
  ], [summary, performanceScore, performanceMonitor.renderCount]);

  return (
    <DashboardContainer>
      <h2>⚡ Performance Dashboard</h2>
      
      <ControlPanel>
        <Button onClick={toggleMonitoring}>
          {isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring'}
        </Button>
        
        <Button onClick={runPerformanceTest}>
          🧪 Run Performance Test
        </Button>
        
        <Button onClick={refreshMetrics}>
          🔄 Refresh Metrics
        </Button>
        
        <Button variant="secondary" onClick={clearMetrics}>
          🗑️ Clear Data
        </Button>
        
        <div style={{ marginLeft: 'auto', fontSize: '14px', color: '#666' }}>
          Refreshed {refreshCount} times
          {isMonitoring && <span style={{ color: '#28a745' }}> • Monitoring Active</span>}
        </div>
      </ControlPanel>

      <MetricsGrid>
        {metricsCards.map((metric, index) => (
          <MemoizedMetricCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            unit={metric.unit}
            description={metric.description}
            color={metric.color}
            animationDelay={index * 0.1}
          />
        ))}
      </MetricsGrid>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <ChartContainer>
          <ChartTitle>📊 Custom Metrics Timeline</ChartTitle>
          <TimelineContainer>
            {customMetrics.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No custom metrics recorded yet
              </div>
            ) : (
              customMetrics.slice(-10).reverse().map((metric, index) => (
                <TimelineItem key={`${metric.timestamp}-${index}`}>
                  <div>
                    <StatusIndicator status="success" />
                    <strong>{metric.name}</strong>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {new Date(metric.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ fontWeight: '600' }}>
                    {metric.value.toFixed(2)}ms
                  </div>
                </TimelineItem>
              ))
            )}
          </TimelineContainer>
        </ChartContainer>

        <ChartContainer>
          <ChartTitle>🧪 Performance Test Results</ChartTitle>
          <TimelineContainer>
            {testResults.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                Click "Run Performance Test" to see results
              </div>
            ) : (
              testResults.map((result, index) => (
                <TimelineItem key={`${result.timestamp}-${index}`}>
                  <div>
                    <StatusIndicator status={result.status} />
                    <strong>{result.name}</strong>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div style={{ fontWeight: '600', color: getScoreColor(result.status === 'success' ? 90 : 60) }}>
                    {result.duration.toFixed(1)}ms
                  </div>
                </TimelineItem>
              ))
            )}
          </TimelineContainer>
        </ChartContainer>
      </div>

      {summary.memory && (
        <ChartContainer>
          <ChartTitle>💾 Memory Usage</ChartTitle>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Used Heap Size</span>
              <span>{(summary.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <ProgressBar>
              <ProgressFill
                initial={{ width: 0 }}
                animate={{ width: `${(summary.memory.usedJSHeapSize / summary.memory.totalJSHeapSize) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </ProgressBar>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Limit: {(summary.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB
            </div>
          </div>
        </ChartContainer>
      )}
    </DashboardContainer>
  );
});

PerformanceDashboard.displayName = 'PerformanceDashboard';

export default PerformanceDashboard;