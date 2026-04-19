# 🔌 AxeCode API Integration Reference (v2 - True Match)

This document provides a highly accurate integration guide matching the exact custom routes deployed on the AxeCode Strapi Backend.

---

## 🏗️ 1. Core Config & Authentication Headers

**Base URL:** `http://localhost:1338/api`
**Authorization:** `Bearer <JWT_TOKEN>` required for all `/api/` endpoints unless stated otherwise.

---

## 🔐 2. Custom Authentication & Flow (API: `auth`)
*These routes completely replace the standard Strapi Users-Permissions for login & reg.*

*   **POST** `/auth/flow/register/initiate` (Public) - Takes `{ username, email, password }`. Generates OTP.
*   **POST** `/auth/flow/register/verify` (Public) - Takes `{ email, otp }`. Creates user identity and returns `{ jwt, user }`.
*   **POST** `/auth/flow/password/forgot` (Public) - Takes `{ email }`. Sends reset OTP.
*   **POST** `/auth/flow/password/reset` (Public) - Takes `{ email, otp, newPassword }`.
*   **POST** `/auth/login` (Public) - Takes `{ identifier, password }`.
*   **POST** `/auth/logout` (Auth) - Invalidates current session JWT.
*   **GET** `/auth/me` (Auth) - Retrieves current hydrated user profile.
*   **POST** `/auth/refresh` (Auth) - Refreshes expired JWT token.
*   **POST** `/auth/check-permission` / `/auth/check-role` (Auth) - Validates route/action authorities.

---

## 🧠 3. Unified Recommendation Engine (API: `recommendation`)
*Used to render the dynamic feed and specialized category lists.*

*   **GET** `/recommendations/feed` - The central homepage feed (Top Courses, Trending Articles, Recommended Problems).
*   **GET** `/recommendations/articles` - Paginated articles sorted by trend score.
*   **GET** `/recommendations/blogs` - Latest/Trending Blogs.
*   **GET** `/recommendations/posts` - Community posts stream.
*   **GET** `/recommendations/courses` - Recommended premium & free courses.
*   **GET** `/recommendations/problems` - Algorithmic problems sorted by difficulty & popularity.
*   **GET** `/recommendations/events` / `/recommendations/live-streams` - Discoverable virtual and physical events.
*   **GET** `/recommendations/suggest` - Search autocomplete & intelligent suggestions.

---

## 🚀 4. Remote Code Execution Engine (API: `submission` & `code-template`)
*Connects Frontend Monaco Editor with Backend Judge0 Engine securely.*

*   **POST** `/submissions` - Submits a code execution payload `{ problemId, languageId, sourceCode, stdin }`.
*   **POST** `/submissions/test` - Executes a dry run without saving to history.
*   **GET** `/submissions/:id` - Fetches the output/status of a specific execution.
*   **GET** `/code-templates/generate/:problemId`
*   **GET** `/code-templates/starter/:problemId/:language` - Loads initial starter code for the Monaco editor (e.g., `def solve():` for Python).

---

## 💬 5. Interactions & Real-Time Engagement
*Likes, Reviews, and Push Notifications.*

*   **POST** `/likes/toggle` (Auth) - Takes `{ contentType, id }` (e.g. `article`, `12`). Safely toggles like status using DB Locks to prevent double-counting.
*   **GET** `/likes/debug` (Admin) - Inspects lock queues.
*   **GET** `/rates/summary/:contentType/:docId` - Fetches average rating + total star distribution (e.g., 4.5 Stars from 200 users).
*   **GET** `/notifications/mine` (Auth) - Fetches the user's notification bell stream.
*   **GET** `/notifications/unread-count` (Auth) - Returns `{"count": 5}`.
*   **PUT** `/notifications/:id/read` (Auth) - Marks single notification as read.
*   **PUT** `/notifications/read-all` (Auth) - Clears all unread.
*   **POST** `/push-subscriptions/subscribe` - Registers the user's browser Service Worker for Push Alerts.

---

## 🎟️ 6. Events & Access Control
*For physical event QR codes and premium content restrictions.*

*   **POST** `/scan-ticket/:documentId` - Validates a physical QR ticket for Event entry.
*   **POST** `/user-progress/update` - Updates course watching progress.

---

*Note: All standard Strapi CRUD operations (e.g., `GET /api/articles`) remain structurally identical to Strapi V4/V5 default REST specifications but utilize populated schemas per your Frontend queries.*
