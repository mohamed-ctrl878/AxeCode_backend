# 🚀 The AxeCode Request Story: A Complete Journey

This document explains the technical lifecycle of a data request and the automated deployment flow within the AxeCode ecosystem.

---

## 🧭 1. The Dynamic Request Journey (Real-time Flow)

```mermaid
flowchart TD
    %% Define Styles
    classDef frontend fill:#3498db,stroke:#2980b9,stroke-width:2px,color:#fff;
    classDef security fill:#e67e22,stroke:#d35400,stroke-width:2px,color:#fff;
    classDef backend fill:#2ecc71,stroke:#27ae60,stroke-width:2px,color:#fff;
    classDef database fill:#9b59b6,stroke:#8e44ad,stroke-width:2px,color:#fff;
    classDef storage fill:#95a5a6,stroke:#7f8c8d,stroke-width:2px,color:#fff;
    classDef user fill:#34495e,stroke:#2c3e50,stroke-width:2px,color:#fff;

    %% Nodes
    User(("👤 User Browser")):::user
    Vercel["💻 AxeCode Frontend<br/>(Vercel / React)"]:::frontend
    NPM["🛡️ Nginx Proxy Manager<br/>(SSL Termination)"]:::security
    Strapi["🚀 Strapi CMS v5<br/>(Core API)"]:::backend
    Postgres[("🐘 PostgreSQL<br/>(Database)")]:::database
    Uploads["📁 Secure Storage<br/>(Media Volumes)"]:::storage

    %% Connections
    User -- "1. Opens URL" --> Vercel
    Vercel -- "2. API Call (HTTPS)" --> NPM
    NPM -- "3. Clean Traffic (Port 1338)" --> Strapi
    Strapi -- "4. SQL Query" --> Postgres
    Strapi -- "5. File Access" --> Uploads
    
    %% Response Path
    Strapi -. "6. JSON Data" .-> NPM
    NPM -. "7. Encrypted Response" .-> Vercel
    Vercel -. "8. Visual Update" .-> User

    %% Subgraph for VM
    subgraph VM ["☁️ Ubuntu Production VM (Docker)"]
        direction TB
        NPM
        Strapi
        Postgres
        Uploads
    end
```

---

## 🏗️ 2. Detailed Technical Breakdown

### Phase A: The User's Action
1.  **Interaction**: A student clicks "Enroll in Course" on the React/Vite frontend (hosted on Vercel).
2.  **API Call**: The frontend sends an HTTPS request to `https://axecode.duckdns.org/api/enrollments`.

### Phase B: Entering the Secure VM
3.  **Security Gate (Nginx Proxy Manager)**:
    -   The request arrives at Port **443** (HTTPS).
    -   Nginx decrypts the SSL certificate (Let's Encrypt).
    -   It checks the `Proxy Host` rules we configured to find the internal `axe-strapi` container.

### Phase C: Strapi & Data Processing
4.  **Identity Check**: Strapi's security middleware validates the **JWT Token** (using the `jwtSecret` we established).
5.  **Data Storage**: Strapi sends a SQL query to the `axe-postgres` container on the private `axe-network`.
6.  **Response Generation**: Strapi sends back a JSON response (e.g., `200 OK`).

---

## 🛠️ 3. The Deployment Story (Automatic CI/CD)
When you update the code, the "AxeCode Automation Engine" ensures zero-downtime:

```mermaid
gitGraph
    commit id: "Local Dev"
    commit id: "Fix CSS"
    branch feature/deploy
    checkout feature/deploy
    commit id: "Optimize Docker"
    checkout main
    merge feature/deploy tag: "Push to Main"
    commit id: "GitHub Action Triggered"
    commit id: "Auto-Patching Secrets"
    commit id: "Docker Build & Swap"
    commit id: "LIVE ON VM"
```

1.  **The Trigger**: Run `git push origin main`.
2.  **The Runner**: GitHub connects to your **Self-Hosted Runner** inside the VM.
3.  **Auto-Patching**: The script verifies and adds any missing `JWT_SECRET` automatically.
4.  **Zero-Downtime**: Docker Compose swaps the containers in seconds.

---

> [!TIP]
> **Pro Debugging**: If the website isn't loading, check the **Nginx Proxy Manager Logs** first (Port 81). 90% of connectivity issues are resolved there.

---
