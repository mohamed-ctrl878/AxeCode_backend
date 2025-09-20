import React, { Suspense, useMemo, useCallback, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Lazy load components for better performance
const LoginForm = React.lazy(() => import('./components/Auth/LoginForm'));
const CodeExecutionPanel = React.lazy(() => import('./components/CodeExecution/CodeExecutionPanel'));
const VirtualizedProjectList = React.lazy(() => import('./components/ProjectList/VirtualizedProjectList'));

// Global Styles
const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #f8f9fa;
    color: #333;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* Smooth scrolling */
  html {
    scroll-behavior: smooth;
  }
`;

// Theme configuration
const theme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    light: '#f8f9fa',
    dark: '#343a40',
  },
  breakpoints: {
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
  },
  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.1)',
    md: '0 4px 6px rgba(0,0,0,0.1)',
    lg: '0 8px 25px rgba(0,0,0,0.15)',
  },
};

// Styled Components
const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const Header = styled(motion.header)`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1rem 2rem;
  box-shadow: ${props => props.theme.shadows.md};
  position: sticky;
  top: 0;
  z-index: 1000;
`;

const HeaderContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 700;
`;

const Nav = styled.nav`
  display: flex;
  gap: 24px;
  align-items: center;
`;

const NavButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
  
  &.active {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
`;

const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
`;

const Main = styled.main`
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: 2rem;
`;

const LoadingSpinner = styled(motion.div)`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  
  &::after {
    content: '';
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorBoundaryContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: ${props => props.theme.shadows.md};
  margin: 2rem;
  padding: 2rem;
  text-align: center;
`;

const ErrorTitle = styled.h2`
  color: #dc3545;
  margin-bottom: 1rem;
`;

const ErrorMessage = styled.p`
  color: #6c757d;
  margin-bottom: 1.5rem;
`;

const RefreshButton = styled.button`
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  
  &:hover {
    background: #0056b3;
  }
`;

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryContainer>
          <ErrorTitle>🚫 Something went wrong</ErrorTitle>
          <ErrorMessage>
            An unexpected error occurred. Please try refreshing the page.
          </ErrorMessage>
          <ErrorMessage style={{ fontSize: '12px', fontFamily: 'monospace' }}>
            {this.state.error?.message}
          </ErrorMessage>
          <RefreshButton onClick={() => window.location.reload()}>
            🔄 Refresh Page
          </RefreshButton>
        </ErrorBoundaryContainer>
      );
    }

    return this.props.children;
  }
}

// Memoized Header Component
const MemoizedHeader = React.memo(({ currentView, onViewChange, user, onLogout }) => {
  const getUserInitials = useCallback((user) => {
    if (!user?.username) return '?';
    return user.username.charAt(0).toUpperCase();
  }, []);

  return (
    <Header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <HeaderContent>
        <Logo>
          <span>🔥</span>
          Code Execution Platform
        </Logo>
        
        {user && (
          <Nav>
            <NavButton
              className={currentView === 'projects' ? 'active' : ''}
              onClick={() => onViewChange('projects')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📂 Projects
            </NavButton>
            
            <NavButton
              className={currentView === 'execute' ? 'active' : ''}
              onClick={() => onViewChange('execute')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              💻 Code Editor
            </NavButton>
            
            <UserInfo>
              <UserAvatar>
                {getUserInitials(user)}
              </UserAvatar>
              <span>Welcome, {user.username}</span>
            </UserInfo>
            
            <NavButton
              onClick={onLogout}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              🚪 Logout
            </NavButton>
          </Nav>
        )}
      </HeaderContent>
    </Header>
  );
});

MemoizedHeader.displayName = 'MemoizedHeader';

// Memoized Dashboard Component
const Dashboard = React.memo(() => {
  const [currentView, setCurrentView] = useState('projects');
  const [projects] = useState([
    { id: 1, name: 'Two Sum Algorithm', status: 'completed', createdAt: new Date(), testCount: 5 },
    { id: 2, name: 'Binary Search', status: 'in-progress', createdAt: new Date(), testCount: 3 },
    { id: 3, name: 'Merge Sort', status: 'failed', createdAt: new Date(), testCount: 8 },
  ]);
  const [selectedProject, setSelectedProject] = useState(null);
  const { user, logout } = useAuth();

  const handleViewChange = useCallback((view) => {
    setCurrentView(view);
  }, []);

  const handleProjectSelect = useCallback((project) => {
    setSelectedProject(project);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  // Memoized view content
  const viewContent = useMemo(() => {
    switch (currentView) {
      case 'projects':
        return (
          <motion.div
            key="projects"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <h2 style={{ marginBottom: '24px' }}>📂 Your Projects</h2>
            <VirtualizedProjectList
              projects={projects}
              selectedProject={selectedProject}
              onProjectSelect={handleProjectSelect}
            />
          </motion.div>
        );
      
      case 'execute':
        return (
          <motion.div
            key="execute"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <CodeExecutionPanel />
          </motion.div>
        );
      
      default:
        return null;
    }
  }, [currentView, projects, selectedProject, handleProjectSelect]);

  return (
    <>
      <MemoizedHeader
        currentView={currentView}
        onViewChange={handleViewChange}
        user={user}
        onLogout={handleLogout}
      />
      
      <Main>
        <AnimatePresence mode="wait">
          {viewContent}
        </AnimatePresence>
      </Main>
    </>
  );
});

Dashboard.displayName = 'Dashboard';

// Memoized App Content
const AppContent = React.memo(() => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <AppContainer>
        <LoadingSpinner
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      </AppContainer>
    );
  }

  return (
    <AppContainer>
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              minHeight: '100vh',
              padding: '2rem'
            }}
          >
            <LoginForm />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Dashboard />
          </motion.div>
        )}
      </AnimatePresence>
    </AppContainer>
  );
});

AppContent.displayName = 'AppContent';

// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <GlobalStyle />
        <AuthProvider>
          <Router>
            <Suspense fallback={<LoadingSpinner />}>
              <AppContent />
            </Suspense>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;