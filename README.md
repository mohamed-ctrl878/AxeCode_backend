# 🔥 Code Execution API - Strapi Application

A powerful Strapi-based headless CMS application with integrated Docker code execution capabilities. This application allows developers to execute and test code snippets in a secure, containerized environment.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Docker Integration](#docker-integration)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

## 🎯 Overview

This application is built on **Strapi v5.16.0** and includes:
- **Headless CMS**: Full-featured content management
- **Code Execution Engine**: Secure Docker-based code execution
- **RESTful API**: Complete API for frontend integration
- **Admin Panel**: User-friendly administration interface
- **SQLite Database**: Lightweight database for development
- **PostgreSQL Support**: Production-ready database option

## ✨ Features

- 🔐 **Secure Code Execution**: Containerized environment for running C++ code
- 📊 **Performance Monitoring**: Built-in performance tracking
- 🛡️ **Security Configuration**: Advanced security settings
- 📧 **Email Integration**: Nodemailer support for notifications
- 🔧 **Extensible API**: Easy to extend and customize
- 📱 **Admin Dashboard**: React-based admin interface
- 🔄 **Auto-reload**: Development mode with hot reloading

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js**: Version 18.0.0 to 22.x.x (Recommended: v20.19.0 or later)
- **npm**: Version 6.0.0 or higher
- **Git**: For version control

### Optional (for full functionality)
- **Docker**: For code execution features
- **PostgreSQL**: For production deployment

### System Requirements
- **OS**: Windows, macOS, or Linux
- **RAM**: Minimum 4GB, Recommended 8GB
- **Storage**: At least 1GB free space

## 🚀 Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd axe-code

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Install additional required dependencies
npm install dockerode tar-stream better-sqlite3

# Start development server
npm run dev

# Visit http://localhost:1337/admin to create your admin user
```

## 📖 Detailed Setup

### Step 1: Node.js Version Check

Verify your Node.js version:

```bash
node --version
# Should output v18.x.x to v22.x.x
```

If you need to install or update Node.js, visit [nodejs.org](https://nodejs.org/)

### Step 2: Clone and Navigate

```bash
git clone <repository-url>
cd axe-code
```

### Step 3: Install Dependencies

```bash
# Install core dependencies
npm install

# Install additional required packages
npm install dockerode tar-stream better-sqlite3

# Fix any security vulnerabilities (optional but recommended)
npm audit fix
```

**Why these additional packages?**
- `dockerode`: Docker API client for code execution
- `tar-stream`: For creating tar archives for Docker containers
- `better-sqlite3`: Fast SQLite3 database driver

### Step 4: Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Edit the `.env` file with your preferred settings:

```env
HOST=0.0.0.0
PORT=1337
APP_KEYS="your-app-key1,your-app-key2"
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt
JWT_SECRET=your-jwt-secret
```

> **⚠️ Important**: For production, generate secure random strings for all secret values!

### Step 5: Start the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm run start
```

### Step 6: Create Admin User

1. Open your browser and go to `http://localhost:1337/admin`
2. Fill in the admin user creation form:
   - First Name
   - Last Name
   - Email
   - Password (minimum 8 characters)
3. Click "Let's start"

## ⚙️ Configuration

### Database Configuration

By default, the application uses SQLite for development. To switch to PostgreSQL:

1. Install PostgreSQL driver:
```bash
npm install pg
```

2. Update your `.env` file:
```env
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=your_database_name
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password
```

### Email Configuration

Configure email settings in `config/plugins.js` or via environment variables:

```env
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USERNAME=your_username
SMTP_PASSWORD=your_password
```

## 📊 Usage

### Admin Panel

- **URL**: `http://localhost:1337/admin`
- **Features**: Content management, user management, API tokens, settings

### API Access

- **Base URL**: `http://localhost:1337/api`
- **Documentation**: Available at `http://localhost:1337/documentation` (if enabled)

## 🔗 API Endpoints

### Core Endpoints

```bash
# Health Check
GET /api/health

# Authentication
POST /api/auth/local
POST /api/auth/local/register

# Users
GET /api/users/me
PUT /api/users/me

# Products (Custom API)
GET /api/products
POST /api/products
GET /api/products/:id
PUT /api/products/:id
DELETE /api/products/:id
```

### Code Execution API

```bash
# Execute Code
POST /api/products/execute
Content-Type: application/json

{
  "code": "#include <iostream>\nint main() { std::cout << \"Hello World\"; return 0; }",
  "testCases": []
}
```

## 🐳 Docker Integration

The application includes Docker integration for secure code execution:

### Prerequisites

1. Install Docker Desktop
2. Build the code execution image:

```bash
# Create Dockerfile for code execution
docker build -t code-executor .
```

### Docker Image Requirements

Create a `Dockerfile` for the code executor:

```dockerfile
FROM gcc:latest
RUN useradd -m coderunner
USER coderunner
WORKDIR /home/coderunner/workspace
```

### Security Features

- Memory limit: 100MB
- CPU limit: 2 cores
- Execution timeout: 10 seconds
- Read-only root filesystem
- No new privileges
- Process limit: 50

## 🛠️ Development

### Available Scripts

```bash
# Development with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Deploy to Strapi Cloud
npm run deploy

# Run Strapi CLI
npm run strapi
```

### Project Structure

```
axe-code/
├── config/                 # Configuration files
├── src/
│   ├── api/                # API routes and controllers
│   ├── admin/              # Admin panel customizations
│   └── middlewares/        # Custom middlewares
├── public/                 # Static files
├── tests/                  # Test files
├── .env                    # Environment variables
└── package.json           # Dependencies and scripts
```

### Custom Development

1. **Create new API**: Use Strapi CLI
```bash
npm run strapi generate api <name>
```

2. **Add middleware**: Create in `src/middlewares/`

3. **Customize admin**: Modify files in `src/admin/`

## 🚨 Troubleshooting

### Common Issues

#### 1. Node.js Version Error
```
Error: Node.js version not supported
```
**Solution**: Install Node.js 18.x to 22.x

#### 2. Missing Dependencies
```
Error: Cannot find module 'dockerode'
```
**Solution**: 
```bash
npm install dockerode tar-stream better-sqlite3
```

#### 3. Database Connection Error
```
Error: Cannot find module 'better-sqlite3'
```
**Solution**:
```bash
npm install better-sqlite3
```

#### 4. Port Already in Use
```
Error: Port 1337 is already in use
```
**Solutions**:
- Change port in `.env`: `PORT=3000`
- Kill existing process: `npx kill-port 1337`

#### 5. Docker Image Not Found
```
Error: Docker image "code-executor" not found
```
**Solution**: Build the Docker image or disable Docker features

### Debug Mode

Run with debug information:
```bash
npm run strapi develop --debug
```

### Logs Location

Application logs are available in:
- Development: Console output
- Production: `logs/` directory

## 🌐 Deployment

### Production Build

```bash
# Build the admin panel
npm run build

# Start production server
NODE_ENV=production npm run start
```

### Environment Variables for Production

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=1337
APP_KEYS="production-key1,production-key2"
API_TOKEN_SALT=production-api-salt
ADMIN_JWT_SECRET=production-admin-secret
TRANSFER_TOKEN_SALT=production-transfer-salt
JWT_SECRET=production-jwt-secret

# Database (PostgreSQL recommended)
DATABASE_CLIENT=postgres
DATABASE_HOST=your-db-host
DATABASE_PORT=5432
DATABASE_NAME=your-db-name
DATABASE_USERNAME=your-username
DATABASE_PASSWORD=your-password
```

### Deployment Options

1. **Strapi Cloud**: `npm run deploy`
2. **Heroku**: Configure buildpacks and database
3. **Digital Ocean**: Use App Platform or Droplets
4. **AWS**: EC2, ECS, or Lambda
5. **Vercel**: Serverless deployment

## 📚 Additional Resources

### Official Documentation
- [Strapi Documentation](https://docs.strapi.io) - Complete Strapi guide
- [Strapi CLI](https://docs.strapi.io/dev-docs/cli) - Command line interface
- [API Reference](https://docs.strapi.io/dev-docs/api) - API documentation

### Community
- [Discord](https://discord.strapi.io) - Community chat
- [Forum](https://forum.strapi.io/) - Discussion forum
- [GitHub](https://github.com/strapi/strapi) - Source code
- [Blog](https://strapi.io/blog) - Latest updates and tutorials

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Support

If you encounter any issues or need help:

1. Check the [Troubleshooting](#troubleshooting) section
2. Search existing [GitHub Issues](https://github.com/strapi/strapi/issues)
3. Create a new issue with detailed information
4. Join the [Strapi Discord](https://discord.strapi.io) community

---

⭐ **Star this repository if you found it helpful!**

<sub>Made with ❤️ using Strapi v5.16.0</sub>
