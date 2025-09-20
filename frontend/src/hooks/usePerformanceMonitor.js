import { useCallback, useRef, useEffect, useMemo } from 'react';

// Performance metrics collector
class PerformanceCollector {
  constructor() {
    this.metrics = [];
    this.observers = [];
    this.isSupported = 'performance' in window && 'PerformanceObserver' in window;
  }

  // Start collecting metrics
  startCollecting() {
    if (!this.isSupported) return;

    // Observe navigation timing
    if ('getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation');
      if (navigationEntries.length > 0) {
        this.collectNavigationMetrics(navigationEntries[0]);
      }
    }

    // Observe resource loading
    const resourceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          this.collectResourceMetric(entry);
        }
      });
    });

    resourceObserver.observe({ entryTypes: ['resource'] });
    this.observers.push(resourceObserver);

    // Observe layout shifts (CLS)
    if ('LayoutShift' in window) {
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (!entry.hadRecentInput) {
            this.collectLayoutShiftMetric(entry);
          }
        });
      });

      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    }

    // Observe largest contentful paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.collectLCPMetric(lastEntry);
    });

    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    this.observers.push(lcpObserver);

    // Observe first input delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        this.collectFIDMetric(entry);
      });
    });

    fidObserver.observe({ entryTypes: ['first-input'] });
    this.observers.push(fidObserver);
  }

  collectNavigationMetrics(entry) {
    this.metrics.push({
      type: 'navigation',
      timestamp: Date.now(),
      metrics: {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
        loadComplete: entry.loadEventEnd - entry.loadEventStart,
        ttfb: entry.responseStart - entry.requestStart,
        domInteractive: entry.domInteractive - entry.navigationStart,
      }
    });
  }

  collectResourceMetric(entry) {
    this.metrics.push({
      type: 'resource',
      timestamp: Date.now(),
      name: entry.name,
      duration: entry.duration,
      size: entry.transferSize || 0,
      initiatorType: entry.initiatorType
    });
  }

  collectLayoutShiftMetric(entry) {
    this.metrics.push({
      type: 'layout-shift',
      timestamp: Date.now(),
      value: entry.value,
      sources: entry.sources?.map(source => ({
        node: source.node?.tagName,
        previousRect: source.previousRect,
        currentRect: source.currentRect
      }))
    });
  }

  collectLCPMetric(entry) {
    this.metrics.push({
      type: 'largest-contentful-paint',
      timestamp: Date.now(),
      value: entry.startTime,
      element: entry.element?.tagName,
      size: entry.size
    });
  }

  collectFIDMetric(entry) {
    this.metrics.push({
      type: 'first-input-delay',
      timestamp: Date.now(),
      value: entry.processingStart - entry.startTime,
      name: entry.name
    });
  }

  // Custom metric collection
  collectCustomMetric(name, value, metadata = {}) {
    this.metrics.push({
      type: 'custom',
      name,
      value,
      timestamp: Date.now(),
      metadata
    });
  }

  // Get all metrics
  getMetrics() {
    return [...this.metrics];
  }

  // Get metrics by type
  getMetricsByType(type) {
    return this.metrics.filter(metric => metric.type === type);
  }

  // Get performance summary
  getSummary() {
    const navigation = this.getMetricsByType('navigation')[0];
    const resources = this.getMetricsByType('resource');
    const layoutShifts = this.getMetricsByType('layout-shift');
    const lcp = this.getMetricsByType('largest-contentful-paint')[0];
    const fid = this.getMetricsByType('first-input-delay')[0];

    return {
      navigation: navigation?.metrics || {},
      resources: {
        count: resources.length,
        totalSize: resources.reduce((sum, r) => sum + r.size, 0),
        avgDuration: resources.length > 0 ? 
          resources.reduce((sum, r) => sum + r.duration, 0) / resources.length : 0
      },
      cls: layoutShifts.reduce((sum, ls) => sum + ls.value, 0),
      lcp: lcp?.value || 0,
      fid: fid?.value || 0,
      customMetrics: this.getMetricsByType('custom')
    };
  }

  // Clear all metrics
  clear() {
    this.metrics = [];
  }

  // Stop collecting
  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
const performanceCollector = new PerformanceCollector();

// Custom hook for performance monitoring
export const usePerformanceMonitor = (componentName) => {
  const startTimeRef = useRef();
  const renderCountRef = useRef(0);
  const componentMountedRef = useRef(false);

  // Initialize performance collection
  useEffect(() => {
    if (!componentMountedRef.current) {
      performanceCollector.startCollecting();
      componentMountedRef.current = true;
    }

    return () => {
      if (componentMountedRef.current) {
        performanceCollector.disconnect();
      }
    };
  }, []);

  // Track render count
  useEffect(() => {
    renderCountRef.current += 1;
    
    performanceCollector.collectCustomMetric(
      `${componentName || 'Component'}_render`,
      renderCountRef.current,
      { timestamp: Date.now() }
    );
  });

  // Start timer
  const startTimer = useCallback((operation = 'operation') => {
    startTimeRef.current = {
      operation,
      startTime: performance.now()
    };
  }, []);

  // End timer and collect metric
  const endTimer = useCallback((additionalData = {}) => {
    if (!startTimeRef.current) return 0;

    const duration = performance.now() - startTimeRef.current.startTime;
    
    performanceCollector.collectCustomMetric(
      startTimeRef.current.operation,
      duration,
      {
        component: componentName,
        ...additionalData
      }
    );

    const result = {
      operation: startTimeRef.current.operation,
      duration,
      component: componentName
    };

    startTimeRef.current = null;
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚡ ${result.operation} completed in ${duration.toFixed(2)}ms`, result);
    }

    return duration;
  }, [componentName]);

  // Measure function execution
  const measureFunction = useCallback(async (fn, name = 'function') => {
    startTimer(name);
    
    try {
      const result = await fn();
      endTimer({ status: 'success' });
      return result;
    } catch (error) {
      endTimer({ status: 'error', error: error.message });
      throw error;
    }
  }, [startTimer, endTimer]);

  // Get component metrics
  const getComponentMetrics = useCallback(() => {
    return performanceCollector.getMetricsByType('custom')
      .filter(metric => metric.metadata?.component === componentName);
  }, [componentName]);

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    return performanceCollector.getSummary();
  }, []);

  // Memory usage (if available)
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return null;
  }, []);

  // Memoized return object
  return useMemo(() => ({
    startTimer,
    endTimer,
    measureFunction,
    getComponentMetrics,
    getPerformanceSummary,
    getMemoryUsage,
    renderCount: renderCountRef.current,
    isSupported: performanceCollector.isSupported
  }), [
    startTimer,
    endTimer,
    measureFunction,
    getComponentMetrics,
    getPerformanceSummary,
    getMemoryUsage
  ]);
};

// Hook for tracking component render performance
export const useRenderPerformance = (componentName, dependencies = []) => {
  const renderStartTime = useRef();
  const { collectCustomMetric } = usePerformanceMonitor(componentName);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      
      performanceCollector.collectCustomMetric(
        `${componentName}_render_time`,
        renderTime,
        {
          dependencyCount: dependencies.length,
          timestamp: Date.now()
        }
      );

      if (process.env.NODE_ENV === 'development') {
        console.log(`🎨 ${componentName} rendered in ${renderTime.toFixed(2)}ms`);
      }
    }
  }, dependencies);
};

// Hook for tracking scroll performance
export const useScrollPerformance = (elementRef) => {
  const lastScrollTime = useRef(0);
  const frameId = useRef();

  useEffect(() => {
    const element = elementRef?.current || window;
    
    const handleScroll = () => {
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }

      frameId.current = requestAnimationFrame(() => {
        const now = performance.now();
        const timeSinceLastScroll = now - lastScrollTime.current;
        
        performanceCollector.collectCustomMetric(
          'scroll_performance',
          timeSinceLastScroll,
          {
            timestamp: now,
            scrollY: window.scrollY
          }
        );

        lastScrollTime.current = now;
      });
    };

    element.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      element.removeEventListener('scroll', handleScroll);
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
    };
  }, [elementRef]);
};

export default usePerformanceMonitor;