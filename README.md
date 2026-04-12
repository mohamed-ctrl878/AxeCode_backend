# AxeCode Backend - Multi-Service CMS

AxeCode Backend is a powerful headless CMS built on **Strapi v5**, serving as the central hub for content management, real-time communications, and secure code execution engine integrations.

---

## 📑 AxeCode Documentation
### **[🏠 Home](./README.md)** | [🏗️ Architecture](./CONTRIBUTING.md) | [⚖️ Conduct](./CODE_OF_CONDUCT.md) | [🛡️ Security](./SECURITY.md)
---

## 🏗️ Core Features
- **Educational Platform**: Courses, Lessons, Weeks, and Progress Tracking.
- **Real-time Engine**: Messenger, Live-streaming, and instant Notifications via Socket.io.
- **Judge0 Integration**: Secure code execution service for competitive programming.
- **Recommendation System**: Advanced relational filtering for Courses, Articles, and Blogs.
- **Granular Security**: Document-level ownership and enrollment-based file access strategies.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18 - v22
- **Docker**: Required for Judge0 execution engine.
- **Database**: PostgreSQL (Recommended) or SQLite.

### Setup
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Variables**:
    ```bash
    cp .env.example .env
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```

### Docker Integration (Judge0)
To run the code execution engine locally:
```bash
docker-compose up -d
```

---

## 🧪 Testing
We use **Vitest** for our unit and integration tests.
```bash
npm run test
```

---

## 🧱 Folders & Structure
- **`/config`**: Strapi settings, middlewares, and persistent configurations.
- **`/src/api`**: Core content types and business logic (AxeCode Domains).
- **`/src/extensions`**: Overrides for third-party plugins (e.g., users-permissions).
- **`/src/index.js`**: Main bootstrap logic for security and socket initialization.

---

## 🤝 Contributing
Interested in contributing? Please check our **[Contributor's Guide (Architecture/Flow)](./CONTRIBUTING.md)** for deep technical details.
