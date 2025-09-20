import React, { useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { useAuth } from '../../hooks/useAuth';
import ReCaptcha from '../ReCaptcha';

// Styled Components
const FormContainer = styled(motion.div)`
  background: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  width: 100%;
  margin: 0 auto;
`;

const Title = styled.h2`
  color: #333;
  margin-bottom: 24px;
  text-align: center;
  font-weight: 600;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #333;
  font-size: 14px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  border: 2px solid ${props => props.hasError ? '#dc3545' : '#ddd'};
  border-radius: 8px;
  box-sizing: border-box;
  font-size: 14px;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${props => props.hasError ? '#dc3545' : '#007bff'};
    box-shadow: 0 0 0 3px ${props => props.hasError ? 'rgba(220, 53, 69, 0.1)' : 'rgba(0, 123, 255, 0.1)'};
  }

  &::placeholder {
    color: #999;
  }
`;

const ErrorMessage = styled(motion.div)`
  color: #dc3545;
  font-size: 12px;
  margin-top: 6px;
  margin-bottom: 0;
`;

const SubmitButton = styled(motion.button)`
  width: 100%;
  padding: 14px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
  
  &:disabled {
    background-color: #6c757d;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background-color: #0056b3;
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid #ffffff;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s ease-in-out infinite;
  margin-right: 8px;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const TestCredentials = styled.div`
  margin-top: 20px;
  padding: 16px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007bff;
`;

const TestCredentialsTitle = styled.h4`
  margin: 0 0 8px 0;
  color: #333;
  font-size: 14px;
`;

const TestCredentialItem = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
`;

const ReCaptchaContainer = styled.div`
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  
  .recaptcha-container {
    transform-origin: center;
    transform: scale(0.9);
  }
  
  @media (max-width: 480px) {
    .recaptcha-container {
      transform: scale(0.75);
    }
  }
`;

// Validation utility functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateForm = (formData, recaptchaToken) => {
  const errors = {};
  
  if (!formData.identifier.trim()) {
    errors.identifier = 'Email or username is required';
  } else if (formData.identifier.includes('@') && !validateEmail(formData.identifier)) {
    errors.identifier = 'Please enter a valid email address';
  }
  
  if (!formData.password.trim()) {
    errors.password = 'Password is required';
  } else if (formData.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  
  if (!recaptchaToken) {
    errors.recaptcha = 'Please complete the reCAPTCHA verification';
  }
  
  return {
    errors,
    isValid: Object.keys(errors).length === 0
  };
};

// Memoized Input Component
const MemoizedInput = React.memo(({ 
  id, 
  type, 
  label, 
  value, 
  onChange, 
  placeholder, 
  error,
  required = false 
}) => {
  const handleChange = useCallback((e) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <FormGroup>
      <Label htmlFor={id}>
        {label}
        {required && <span style={{ color: '#dc3545' }}>*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        hasError={!!error}
        required={required}
      />
      {error && (
        <ErrorMessage
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          {error}
        </ErrorMessage>
      )}
    </FormGroup>
  );
});

MemoizedInput.displayName = 'MemoizedInput';

// Main LoginForm Component
const LoginForm = React.memo(({ onSuccess, showTestCredentials = true }) => {
  const { login, isLoading, authError } = useAuth();
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const recaptchaRef = useRef(null);

  // Memoized form handlers
  const handleIdentifierChange = useCallback((value) => {
    setFormData(prev => ({ ...prev, identifier: value }));
    if (isSubmitted) {
      setValidationErrors(prev => ({ ...prev, identifier: '' }));
    }
  }, [isSubmitted]);

  const handlePasswordChange = useCallback((value) => {
    setFormData(prev => ({ ...prev, password: value }));
    if (isSubmitted) {
      setValidationErrors(prev => ({ ...prev, password: '' }));
    }
  }, [isSubmitted]);

  // reCAPTCHA handlers
  const handleRecaptchaChange = useCallback((token) => {
    setRecaptchaToken(token || '');
    if (isSubmitted && validationErrors.recaptcha) {
      setValidationErrors(prev => ({ ...prev, recaptcha: '' }));
    }
  }, [isSubmitted, validationErrors.recaptcha]);

  const handleRecaptchaExpire = useCallback(() => {
    setRecaptchaToken('');
    if (isSubmitted) {
      setValidationErrors(prev => ({ ...prev, recaptcha: 'reCAPTCHA has expired, please verify again' }));
    }
  }, [isSubmitted]);

  const handleRecaptchaError = useCallback(() => {
    setRecaptchaToken('');
    setValidationErrors(prev => ({ ...prev, recaptcha: 'reCAPTCHA verification failed, please try again' }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitted(true);

    const validation = validateForm(formData, recaptchaToken);
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    try {
      setValidationErrors({});
      const result = await login(formData.identifier, formData.password, recaptchaToken);
      
      if (result && onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      console.error('Login error:', error.message);
      // Reset reCAPTCHA on error
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken('');
      }
      // Auth error is handled by the useAuth hook
    }
  }, [formData, recaptchaToken, login, onSuccess]);

  const fillTestCredentials = useCallback(() => {
    setFormData({
      identifier: 'test@example.com',
      password: 'password123'
    });
    setValidationErrors({});
    // Reset reCAPTCHA when filling test credentials
    if (recaptchaRef.current) {
      recaptchaRef.current.reset();
      setRecaptchaToken('');
    }
  }, []);

  // Memoized test credentials component
  const TestCredentialsComponent = useMemo(() => {
    if (!showTestCredentials) return null;
    
    return (
      <TestCredentials>
        <TestCredentialsTitle>🧪 Test Credentials</TestCredentialsTitle>
        <TestCredentialItem><strong>Email:</strong> test@example.com</TestCredentialItem>
        <TestCredentialItem><strong>Password:</strong> password123</TestCredentialItem>
        <motion.button
          type="button"
          onClick={fillTestCredentials}
          style={{
            marginTop: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Fill Test Credentials
        </motion.button>
      </TestCredentials>
    );
  }, [showTestCredentials, fillTestCredentials]);

  const isFormValid = useMemo(() => {
    const validation = validateForm(formData, recaptchaToken);
    return validation.isValid;
  }, [formData, recaptchaToken]);

  return (
    <FormContainer
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Title>🔐 Sign In</Title>
      
      <form onSubmit={handleSubmit} noValidate>
        <MemoizedInput
          id="identifier"
          type="text"
          label="Email or Username"
          value={formData.identifier}
          onChange={handleIdentifierChange}
          placeholder="Enter your email or username"
          error={validationErrors.identifier}
          required
        />

        <MemoizedInput
          id="password"
          type="password"
          label="Password"
          value={formData.password}
          onChange={handlePasswordChange}
          placeholder="Enter your password"
          error={validationErrors.password}
          required
        />

        <ReCaptchaContainer>
          <ReCaptcha
            ref={recaptchaRef}
            onVerify={handleRecaptchaChange}
            onExpire={handleRecaptchaExpire}
            onError={handleRecaptchaError}
          />
          {validationErrors.recaptcha && (
            <ErrorMessage
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ marginTop: '8px', textAlign: 'center' }}
            >
              {validationErrors.recaptcha}
            </ErrorMessage>
          )}
        </ReCaptchaContainer>

        {authError && (
          <ErrorMessage
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ marginBottom: '16px', textAlign: 'center' }}
          >
            {authError}
          </ErrorMessage>
        )}

        <SubmitButton
          type="submit"
          disabled={isLoading || !isFormValid}
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </SubmitButton>
      </form>

      {TestCredentialsComponent}
    </FormContainer>
  );
});

LoginForm.displayName = 'LoginForm';

export default LoginForm;