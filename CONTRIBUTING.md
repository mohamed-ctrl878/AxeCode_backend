# 📋 AxeCode Backend - Technical Guide & Analysis

Welcome to the AxeCode backend! This system is a high-performance **Strapi v5** application tailored for educational and competitive programming use cases. It follows a highly modular architecture based on **SOLID** principles and custom security strategies.

---

## 🏗️ 1. Architecture Overview (The Layers)

AxeCode Backend extends the standard Strapi architecture with specialized service layers and middlewares.

### Key Layers:
1.  **Strapi Core (MVC)**: Standard Routes, Controllers, and Services are used for CMS functionality (e.g., Article, Blog, Course management).
2.  **Document Service Middlewares**: Intercepts low-level database operations (Strapi v5 specific) to enforce global rules like file ownership.
3.  **Access Strategy Registry**: A modular system in `src/api/upload-security` that defines precisely who can access what file/document based on complex logic (enrollment, ownership, public status).
4.  **Real-time Coordinator (Socket.io)**: Service-based handlers initialized in `src/index.js` that manage state for Chat, Submissions, and Notifications.

---

## 🔄 2. Data & Process Flow (The Logic)

### Typical API Request Flow
1.  **HTTP Request**: Hits the Strapi Route.
2.  **Auth Middleware**: Validates JWT and attaches the User object.
3.  **Controller**: Orchestrates the business logic.
4.  **Service/Document Layer**: Interacts with the database.
5.  **Output**: Returns standardized JSON responses.

### Real-time Messaging Flow
1.  **Connection**: Authenticated handshake via `messenger-auth`.
2.  **Join Branch**: User joins a room after permission check by `messenger-moderation`.
3.  **Messaging Logic**: `handleSend` validates message blocks, checks mutes, and persists via `messaging-logic`.
4.  **Broadcast**: The message is emitted via `Socket.io` to the room.

### Code Execution Flow (Judge0 Integration)
1.  **Submission**: User submits code via API.
2.  **Queue**: `queue-manager` handles the request.
3.  **Engine**: `judge0` service packages the code, encodes it in Base64, and sends it to the Dockerized Judge0 API.
4.  **Polling**: The service polls for results until completion.
5.  **Update**: Result is saved and broadcasted back via `submission-socket`.

---

## 🛡️ 3. Security & Access Control

AxeCode uses a sophisticated security layer for uploaded content (like lesson videos or solutions).

### Upload Security Logic:
- **Lesson Access**: Allowed if the user is the teacher, the course owner, or has a valid enrollment record (checked via `content-access-facade`).
- **File Ownership**: Enforced at the database level using `file-ownership-middleware`, preventing unauthorized users from modifying files they didn't upload.

---

## 🛠️ 4. Technical Stack Highlights
- **Engine**: Node.js 18+
- **Framework**: [Strapi v5.16](https://strapi.io/)
- **Database**: PostgreSQL (Production) / SQLite (Development)
- **Real-time**: [Socket.io](https://socket.io/)
- **Compute**: Judge0 (Dockerized) via Dockerode
- **Validation**: [Zod](https://zod.dev/) for data schemas
- **Testing**: [Vitest](https://vitest.dev/)

---

## 🏁 5. Getting Started for Developers

1.  **Clone & Install**: `npm install`
2.  **Environment**: Copy `.env.example` to `.env` and configure keys.
3.  **Local Dev**: `npm run dev`
4.  **Testing**: `npm run test`

---

> [!NOTE]
> For detailed deployment and Docker setup, see [README.md](./README.md).
