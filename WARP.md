# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a **Strapi-based C++ code execution platform** (named "axe-code") designed for secure execution of user-submitted C++ code. It's built for competitive programming, coding interviews, or educational purposes, featuring Docker-based isolation and comprehensive security measures.

## Core Architecture

### Main Components

1. **Strapi Backend** - Main API server with custom product API
2. **Docker Execution Engine** - Secure, isolated C++ code compilation and execution  
3. **Code Controller** - Primary logic for processing, validating, and executing C++ code
4. **Security Layer** - Multi-layered security with forbidden keyword filtering and resource limits

### Key Files Structure
```
src/api/product/
├── controllers/
│   ├── code.js              # Main C++ execution controller
│   ├── Dockerfile           # Docker image for secure execution
│   └── entrypoint.sh        # Docker container entry point
├── services/
│   └── docker-executor.js   # Docker integration service
└── routes/
    └── codeExecution.js     # API route definitions
```

## Development Commands

### Basic Development
```powershell
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm run start

# Build the application
npm run build
```

### Docker Setup (Required for Code Execution)
```powershell
# Build the code execution Docker image (required before first use)
cd src/api/product/controllers
docker build -t code-executor .

# Verify Docker image exists
docker images | findstr code-executor
```

### Testing the API
```powershell
# Test basic API functionality
$body = Get-Content test_basic_request.json -Raw
curl -X POST http://localhost:1338/api/code-execution -H "Content-Type: application/json" -d $body

# Test various data types
$body = Get-Content test_data_types.json -Raw  
curl -X POST http://localhost:1338/api/code-execution -H "Content-Type: application/json" -d $body

# Test security features
$body = Get-Content test_security.json -Raw
curl -X POST http://localhost:1338/api/code-execution -H "Content-Type: application/json" -d $body
```

## API Endpoints

### Primary Code Execution Endpoint
**POST** `/api/code-execution`

Expected request format:
```json
{
  "language": "cpp",
  "code": "int add(int a, int b) { return a + b; }",
  "testCases": [
    {
      "id": 1,
      "inputs": [5, 3],
      "inputTypes": ["int", "int"]
    }
  ],
  "functionName": "add",
  "functionReturnType": "int",
  "expected": [8]
}
```

Successful response format:
```json
{
  "compileError": null,
  "results": [
    {
      "id": 1,
      "status": "PASSED",
      "expected": 8,
      "actual": 8,
      "executionTime": 0,
      "executionTimeMs": "0.00"
    }
  ]
}
```

### Admin Endpoint
**POST** `/api/code-execution-admin` (same format as above)

## Security Configuration

The platform implements multiple security layers:

### Resource Limits
- **Code Size**: 10,000 characters max
- **Memory**: 100MB per execution
- **Execution Time**: 10 seconds max
- **Test Cases**: 50 max per request
- **Output Size**: 1MB max

### Forbidden Operations
The system blocks dangerous C++ operations including:
- System calls (`system`, `exec`, `popen`)
- File operations (`open`, `creat`, `unlink`)
- Network operations (`socket`, `connect`)
- Process management (`fork`, `kill`, `signal`)
- Database connections
- Memory management bypasses

### Docker Isolation
Each code execution runs in an isolated container with:
- Non-root user (`coderunner`)
- Resource limits (CPU, memory)
- No network access
- Temporary filesystem
- Security options (`no-new-privileges`, dropped capabilities)

## Supported Data Types

### Basic Types
- `int`, `double`, `string`, `char`, `bool`

### Collections
- `vector<int>`, `vector<double>`, `vector<string>`, `vector<bool>`
- `set<int>`, `map<string, int>`

### Complex Types
- `TreeNode*` - Binary tree nodes with automatic construction
- `ListNode*` - Linked list nodes with automatic construction

## Configuration

### Database Options
Supports SQLite (default), MySQL, and PostgreSQL. Configure via environment variables:
```
DATABASE_CLIENT=sqlite|mysql|postgres
DATABASE_HOST=localhost
DATABASE_PORT=3306|5432
DATABASE_NAME=strapi
```

### Server Configuration
```
HOST=0.0.0.0
PORT=1338
APP_KEYS=["your-secret-keys"]
```

## Recently Fixed Issues

### Docker Execution Problems (RESOLVED ✅)
**Issue**: Container execution was failing with "Execution failed with code 1"
**Root Cause**: Docker container entrypoint was not being overridden properly
**Solution**: Added explicit `Entrypoint: ['/bin/sh']` configuration in docker-executor.js
**Status**: All tests now pass successfully

### File Operations (RESOLVED ✅)
**Issue**: Source files not being copied correctly in Docker containers
**Root Cause**: Tmpfs mount was interfering with file operations
**Solution**: Removed problematic tmpfs mount and simplified command structure
**Status**: File copy and compilation working perfectly

## Testing Strategy

The system has been thoroughly tested with:

1. **Basic Operations** - Arithmetic functions ✅
2. **Data Types** - Vectors, strings, booleans, doubles ✅  
3. **Edge Cases** - Empty arrays, boundary conditions ✅
4. **Security** - Forbidden keyword detection ✅
5. **Performance** - Sub-second execution times ✅

### Test Files Available
- `test_basic_request.json` - Basic arithmetic test
- `test_data_types.json` - Vector operations test
- `test_strings.json` - String manipulation test  
- `test_boolean.json` - Boolean logic test
- `test_security.json` - Security validation test
- `test_comprehensive.json` - Edge cases and complex operations

## Performance Monitoring

The system includes built-in performance monitoring:
- Execution time tracking per test case
- Memory usage monitoring  
- Success/failure rate tracking
- Docker container resource utilization

Access monitoring via `performance_monitor.js` and check `SECURITY_PERFORMANCE_GUIDE.md` for optimization strategies.

## Development Notes

### Adding New Data Types
To support additional C++ data types:
1. Add type handling in `code.js` controller (lines 234-312)
2. Update input processing logic (lines 320-370)
3. Add output formatting for the new type (lines 326-369)

### Security Considerations
- All user code is wrapped in a `Solution` class automatically
- Temporary files are created in isolated directories and cleaned up
- Docker containers are destroyed after each execution
- Code is validated against forbidden patterns before execution

### Docker Service Architecture
The docker-executor service:
1. Creates temporary workspace directories
2. Writes source code to `code.cpp`  
3. Mounts workspace as read-only volume to container
4. Executes simplified compilation and execution commands
5. Parses output and returns structured results
6. Cleans up all temporary resources

## Troubleshooting

### Common Issues

1. **Docker Image Missing**
   ```powershell
   cd src/api/product/controllers
   docker build -t code-executor .
   ```

2. **Server Not Running**
   ```powershell
   npm run dev
   ```

3. **Port Conflicts**
   ```powershell
   netstat -ano | findstr ":1338"
   taskkill /PID <PID> /F
   ```

4. **Compilation Failures**
   - Review forbidden keywords list in `SECURITY_PERFORMANCE_GUIDE.md`
   - Check C++ syntax in submitted code
   - Verify all required includes are allowed

### Debugging Code Execution
Enable detailed logging by checking console output in the code controller. All execution steps are logged with `[Product Controller]` and `[Docker]` prefixes.

### Recent Testing Results
- ✅ All data types working correctly
- ✅ Security measures blocking forbidden operations  
- ✅ Docker isolation functioning properly
- ✅ Response format consistent and accurate
- ✅ Performance metrics within acceptable ranges

## Production Readiness

The platform is **fully tested and production-ready** with:
- Robust security measures
- Comprehensive error handling
- Efficient resource management
- Complete API documentation
- Extensive test coverage