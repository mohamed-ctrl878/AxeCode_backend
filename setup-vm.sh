#!/bin/bash
# ============================================================
# AxeCode VM Setup Script
# Run this ONCE on your Ubuntu VM to set up everything
# Usage: chmod +x setup-vm.sh && ./setup-vm.sh
# ============================================================

set -e

echo "=========================================="
echo " AxeCode VM Setup"
echo "=========================================="

# ---- 1. Update system ----
echo ""
echo "[1/5] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ---- 2. Install Docker ----
echo ""
echo "[2/5] Installing Docker..."
if command -v docker &> /dev/null; then
    echo "  Docker already installed: $(docker --version)"
else
    # Install Docker using the official convenience script
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh

    # Allow current user to run docker without sudo
    sudo usermod -aG docker $USER

    echo "  Docker installed: $(docker --version)"
fi

# ---- 3. Install Docker Compose plugin ----
echo ""
echo "[3/5] Verifying Docker Compose..."
if docker compose version &> /dev/null; then
    echo "  Docker Compose available: $(docker compose version)"
else
    echo "  Installing Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
    echo "  Docker Compose installed: $(docker compose version)"
fi

# ---- 4. Install GitHub Actions Runner ----
echo ""
echo "[4/5] Setting up GitHub Actions Self-Hosted Runner..."

RUNNER_DIR="$HOME/actions-runner"

if [ -d "$RUNNER_DIR" ]; then
    echo "  Runner directory already exists at $RUNNER_DIR"
    echo "  If you need to reconfigure, delete it first: rm -rf $RUNNER_DIR"
else
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"

    # Download the latest runner
    RUNNER_VERSION="2.323.0"
    curl -o actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz -L \
        "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

    tar xzf actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
    rm actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz

    echo ""
    echo "  =========================================="
    echo "  IMPORTANT: Configure the runner manually!"
    echo "  =========================================="
    echo ""
    echo "  1. Go to your GitHub repo:"
    echo "     https://github.com/mohamed-ctrl878/AxeCode_backend/settings/actions/runners/new"
    echo ""
    echo "  2. Copy the TOKEN from that page"
    echo ""
    echo "  3. Run this command (replace YOUR_TOKEN):"
    echo "     cd $RUNNER_DIR && ./config.sh --url https://github.com/mohamed-ctrl878/AxeCode_backend --token YOUR_TOKEN"
    echo ""
    echo "  4. Then install as a system service:"
    echo "     sudo ./svc.sh install && sudo ./svc.sh start"
    echo ""
fi

# ---- 5. Create .env.production template ----
echo ""
echo "[5/5] Setting up environment file..."

WORK_DIR="$HOME/axecode-backend"
mkdir -p "$WORK_DIR"

if [ ! -f "$WORK_DIR/.env.production" ]; then
    cat > "$WORK_DIR/.env.production" << 'ENVEOF'
# ===========================================
# AxeCode Backend - Production Environment
# ===========================================
# FILL IN ALL VALUES MARKED WITH CHANGE_ME

# Server
HOST=0.0.0.0
PORT=1338
PUBLIC_URL=http://localhost:1338
TRUST_PROXY=true

# Secrets (generate with: openssl rand -base64 16)
APP_KEYS=CHANGE_ME_KEY1,CHANGE_ME_KEY2,CHANGE_ME_KEY3,CHANGE_ME_KEY4
API_TOKEN_SALT=CHANGE_ME
ADMIN_JWT_SECRET=CHANGE_ME
TRANSFER_TOKEN_SALT=CHANGE_ME
JWT_SECRET=CHANGE_ME

# Database (matches docker-compose service name)
DATABASE_CLIENT=postgres
DATABASE_HOST=db
DATABASE_PORT=5432
DATABASE_NAME=axecode
DATABASE_USERNAME=axecode
DATABASE_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DATABASE_SSL=false

# CORS
CORS_ORIGIN=https://axe-code.vercel.app
FRONTEND_URL=https://axe-code.vercel.app
COOKIE_DOMAIN=

# Email
GMAIL_USER=
GMAIL_APP_PASSWORD=

# GitHub OAuth
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# reCAPTCHA
RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RECAPTCHA_REQUIRED=true
RECAPTCHA_MIN_SCORE=0.5

# JDoodle
JDOODLE_CLIENT_ID=
JDOODLE_CLIENT_SECRET=

# Judge0
JUDGE0_API_URL=http://localhost:2358

# VAPID Keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@axecode.com
ENVEOF

    echo "  Created $WORK_DIR/.env.production"
    echo "  ⚠️  IMPORTANT: Edit this file and fill in your real secrets!"
else
    echo "  .env.production already exists"
fi

echo ""
echo "=========================================="
echo " Setup Complete!"
echo "=========================================="
echo ""
echo " Next steps:"
echo "   1. LOG OUT and log back in (so docker group takes effect)"
echo "   2. Configure the GitHub Runner (see step 4 above)"
echo "   3. Edit $WORK_DIR/.env.production with your real secrets"
echo "   4. Push code to the 'main' branch to trigger deployment"
echo ""
