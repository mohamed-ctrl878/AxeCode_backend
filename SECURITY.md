# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 5.16.x  | :white_check_mark: |
| < 5.0   | :x:                |

## Internal Security Mechanisms

AxeCode Backend implements several custom security layers beyond basic Strapi permissions:

### 1. Access Strategy Registry
We use a strategy pattern to determine access to uploaded files. Strategies for different content types (like `api::lesson.lesson`) are registered at bootstrap. 
- **Lesson Strategy**: Validates ownership chain (Lesson -> Week -> Course -> Enrollment/Owner).

### 2. File Ownership Middleware
Intercepts database calls to ensure that files attached to a user are only manageable by that user or a super-admin.

### 3. JWT-Cookie Middleware
Authenticates users via HTTP-only cookies to mitigate XSS-based token theft.

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

Instead, please send an email to mohamedeleskanderwow@gmail.com.

Please include:
- A description of the vulnerability.
- Steps to reproduce the issue.
- Potential impact.

We will acknowledge your report within 48 hours.
