import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';

// Styled components for better performance and maintainability
const Container = styled.div`
  height: 400px;
  width: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fafafa;
`;

const ProjectItem = styled(motion.div)`
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
  background: ${props => props.isSelected ? '#e3f2fd' : '#ffffff'};
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${props => props.isSelected ? '#bbdefb' : '#f5f5f5'};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const ProjectInfo = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const ProjectTitle = styled.h3`
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
`;

const ProjectMeta = styled.div`
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
`;

const ProjectStatus = styled.span`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background-color: ${props => {
    switch (props.status) {
      case 'completed': return '#e8f5e8';
      case 'in-progress': return '#fff3cd';
      case 'failed': return '#f8d7da';
      default: return '#e9ecef';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'completed': return '#2e7d32';
      case 'in-progress': return '#f57c00';
      case 'failed': return '#c62828';
      default: return '#495057';
    }
  }};
`;

const LoadingIndicator = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60px;
  font-size: 14px;
  color: #666;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 200px;
  color: #666;
  font-size: 16px;
`;

// Memoized Project Item Component
const MemoizedProjectItem = React.memo(({ index, style, data }) => {
  const { projects, selectedProject, onProjectSelect, inViewItems } = data;
  const project = projects[index];

  const [ref, inView] = useInView({
    threshold: 0.1,
    rootMargin: '50px',
  });

  // Track items in view for performance monitoring
  useEffect(() => {
    if (inViewItems && typeof inViewItems === 'function') {
      inViewItems(index, inView);
    }
  }, [inView, index, inViewItems]);

  const handleClick = useCallback(() => {
    onProjectSelect(project);
  }, [project, onProjectSelect]);

  const isSelected = selectedProject?.id === project.id;

  return (
    <div style={style} ref={ref}>
      <ProjectItem
        isSelected={isSelected}
        onClick={handleClick}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: inView ? 1 : 0.7, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.02 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <ProjectInfo>
          <ProjectTitle>{project.name}</ProjectTitle>
          <ProjectMeta>
            <span>ID: {project.id}</span>
            <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
            <span>Tests: {project.testCount || 0}</span>
          </ProjectMeta>
        </ProjectInfo>
        <ProjectStatus status={project.status}>
          {project.status || 'pending'}
        </ProjectStatus>
      </ProjectItem>
    </div>
  );
});

MemoizedProjectItem.displayName = 'MemoizedProjectItem';

// Main VirtualizedProjectList Component
const VirtualizedProjectList = React.memo(({ 
  projects = [], 
  selectedProject, 
  onProjectSelect,
  isLoading = false,
  onLoadMore,
  hasNextPage = false
}) => {
  const [inViewItems, setInViewItems] = useState(new Set());
  const listRef = useRef();
  
  // Memoized data for the virtual list
  const listData = useMemo(() => ({
    projects,
    selectedProject,
    onProjectSelect,
    inViewItems: (index, inView) => {
      setInViewItems(prev => {
        const newSet = new Set(prev);
        if (inView) {
          newSet.add(index);
        } else {
          newSet.delete(index);
        }
        return newSet;
      });
    }
  }), [projects, selectedProject, onProjectSelect]);

  // Optimized scroll to item function
  const scrollToProject = useCallback((projectId) => {
    if (!listRef.current) return;

    const index = projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
      listRef.current.scrollToItem(index, 'center');
    }
  }, [projects]);

  // Load more items when scrolled near bottom
  const handleScroll = useCallback(({ scrollOffset, scrollDirection }) => {
    if (!hasNextPage || isLoading || scrollDirection !== 'forward') return;

    const scrollableHeight = projects.length * 80; // Assuming 80px per item
    const visibleHeight = 400; // Container height
    const scrollPercentage = (scrollOffset + visibleHeight) / scrollableHeight;

    if (scrollPercentage > 0.8) { // Load more when 80% scrolled
      onLoadMore?.();
    }
  }, [hasNextPage, isLoading, projects.length, onLoadMore]);

  // Memoized empty state
  const EmptyStateComponent = useMemo(() => (
    <EmptyState>
      <div>📭</div>
      <div style={{ marginTop: '12px' }}>No projects found</div>
      <div style={{ fontSize: '14px', marginTop: '4px', color: '#999' }}>
        Create your first project to get started
      </div>
    </EmptyState>
  ), []);

  // Show loading state
  if (isLoading && projects.length === 0) {
    return (
      <Container>
        <LoadingIndicator>
          <div>Loading projects...</div>
        </LoadingIndicator>
      </Container>
    );
  }

  // Show empty state
  if (!isLoading && projects.length === 0) {
    return (
      <Container>
        {EmptyStateComponent}
      </Container>
    );
  }

  return (
    <Container>
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={listRef}
            height={height}
            width={width}
            itemCount={projects.length}
            itemSize={80}
            itemData={listData}
            onScroll={handleScroll}
            overscanCount={5} // Render 5 extra items for smooth scrolling
          >
            {MemoizedProjectItem}
          </List>
        )}
      </AutoSizer>
      
      {isLoading && projects.length > 0 && (
        <LoadingIndicator>
          Loading more...
        </LoadingIndicator>
      )}
    </Container>
  );
});

VirtualizedProjectList.displayName = 'VirtualizedProjectList';

export default VirtualizedProjectList;