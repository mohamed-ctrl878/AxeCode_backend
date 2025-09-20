import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';

/**
 * ReCAPTCHA Component
 * Reusable component for Google reCAPTCHA integration
 */
const ReCaptchaComponent = forwardRef(({ 
  onVerify, 
  onExpire, 
  onError, 
  size = 'normal',
  theme = 'light',
  tabindex = 0,
  disabled = false,
  className = '',
  style = {}
}, ref) => {
  const recaptchaRef = useRef(null);

  // Site key from environment variable
  const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "6Ld_GM8rAAAAAK_dyi6p7ndKZKG1kaWqJwupvEJn";

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    // Execute reCAPTCHA challenge
    execute: () => {
      if (recaptchaRef.current) {
        return recaptchaRef.current.executeAsync();
      }
      return Promise.reject(new Error('reCAPTCHA not initialized'));
    },
    
    // Reset reCAPTCHA
    reset: () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
      }
    },
    
    // Get response value
    getValue: () => {
      if (recaptchaRef.current) {
        return recaptchaRef.current.getValue();
      }
      return null;
    }
  }));

  const handleVerify = (token) => {
    if (onVerify) {
      onVerify(token);
    }
  };

  const handleExpire = () => {
    if (onExpire) {
      onExpire();
    }
  };

  const handleError = (error) => {
    if (onError) {
      onError(error);
    }
  };

  return (
    <div className={`recaptcha-container ${className}`} style={style}>
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        onChange={handleVerify}
        onExpired={handleExpire}
        onErrored={handleError}
        size={size}
        theme={theme}
        tabindex={tabindex}
        disabled={disabled}
      />
    </div>
  );
});

ReCaptchaComponent.displayName = 'ReCaptcha';

export default ReCaptchaComponent;