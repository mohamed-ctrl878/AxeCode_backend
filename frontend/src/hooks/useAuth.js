import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Memoized API configuration
const createApiInstance = () => {
  return axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:1337',
    withCredentials: true,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const AuthProvider = React.memo(({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Memoized API instance
  const api = useMemo(() => createApiInstance(), []);

  // Optimized login function with useCallback
  const login = useCallback(async (identifier, password, recaptchaToken = null) => {
    try {
      setIsLoading(true);
      setAuthError(null);
      
      const loginData = {
        identifier,
        password,
      };
      
      // Include reCAPTCHA token if provided
      if (recaptchaToken) {
        loginData.recaptchaToken = recaptchaToken;
      }
      
      const response = await api.post('/api/auth/login', loginData);

      if (response.data?.user) {
        setUser(response.data.user);
        return response.data;
      }
      
      throw new Error('Invalid login response');
    } catch (error) {
      let errorMessage = 'Login failed';
      
      // Handle specific reCAPTCHA errors
      if (error.response?.data?.error === 'recaptcha_failed') {
        errorMessage = 'reCAPTCHA verification failed. Please try again.';
      } else if (error.response?.data?.error === 'recaptcha_missing') {
        errorMessage = 'Please complete the reCAPTCHA verification.';
      } else {
        errorMessage = error.response?.data?.message || error.response?.data?.details || error.message || 'Login failed';
      }
      
      setAuthError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  // Optimized logout function
  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.warn('Logout API call failed:', error.message);
    } finally {
      setUser(null);
      setAuthError(null);
    }
  }, [api]);

  // Optimized auth status check
  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/auth/me');
      
      if (response.data) {
        setUser(response.data);
        return response.data;
      }
      
      return null;
    } catch (error) {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  // Optimized authenticated request function
  const authenticatedRequest = useCallback(async (url, options = {}) => {
    try {
      const response = await api({
        url,
        method: options.method || 'GET',
        data: options.data,
        ...options,
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
        setAuthError('Session expired. Please login again.');
      }
      throw error;
    }
  }, [api]);

  // Check authentication on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    isLoading,
    authError,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuthStatus,
    authenticatedRequest,
    setAuthError,
  }), [
    user,
    isLoading,
    authError,
    login,
    logout,
    checkAuthStatus,
    authenticatedRequest,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
});

AuthProvider.displayName = 'AuthProvider';

// Custom hook with error handling
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

// Memoized HOC for protected routes
export const withAuth = (WrappedComponent) => {
  const WithAuthComponent = React.memo((props) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return <div>Loading...</div>;
    }

    if (!isAuthenticated) {
      return <div>Please login to access this page</div>;
    }

    return <WrappedComponent {...props} />;
  });

  WithAuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithAuthComponent;
};