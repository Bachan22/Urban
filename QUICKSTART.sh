#!/bin/bash

# UrbanIQ - Development Environment Setup Script
# This script sets up and starts both backend and frontend services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}       UrbanIQ - Full Functionality Setup & Launch${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

# Check Python
echo -e "\n${YELLOW}Checking Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3 not found. Please install Python 3.8+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python $(python3 --version)${NC}"

# Check Node
echo -e "\n${YELLOW}Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js 16+${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node --version)${NC}"

# Check npm
echo -e "\n${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found. Please install npm${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Install backend dependencies
echo -e "\n${YELLOW}Setting up backend...${NC}"
cd backend
if [ -d "venv" ]; then
    echo -e "${GREEN}✓ Virtual environment exists${NC}"
else
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
fi

source venv/bin/activate || . venv/Scripts/activate  # Windows compatibility

echo -e "${YELLOW}Installing Python dependencies...${NC}"
python3 -m pip install -r requirements.txt > /dev/null 2>&1 || pip install -r requirements.txt > /dev/null 2>&1
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
cd ..

# Install frontend dependencies
echo -e "\n${YELLOW}Setting up frontend...${NC}"
cd frontend
echo -e "${YELLOW}Installing npm packages...${NC}"
npm install > /dev/null 2>&1
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
cd ..

# Create .env if it doesn't exist
echo -e "\n${YELLOW}Checking environment configuration...${NC}"
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}Creating backend/.env file...${NC}"
    cat > backend/.env << EOF
DATABASE_URL=postgresql://rajeshjha@localhost:5432/urbaniq_db
SECRET_KEY=dev-secret-key-change-in-production-$(python3 -c 'import secrets; print(secrets.token_urlsafe(16))')
REDIS_URL=redis://localhost:6379
EOF
    echo -e "${GREEN}✓ .env file created${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Check database
echo -e "\n${YELLOW}Checking PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    if psql -U rajeshjha -d urbaniq_db -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database exists and is accessible${NC}"
    else
        echo -e "${YELLOW}⚠ Database not accessible. Make sure PostgreSQL is running and database exists${NC}"
        echo -e "${YELLOW}  Create database with: createdb urbaniq_db${NC}"
    fi
else
    echo -e "${YELLOW}⚠ PostgreSQL client not found. Make sure PostgreSQL server is running${NC}"
fi

# Summary
echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Setup Complete! Ready to start services.${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

echo -e "\n${YELLOW}To start development servers:${NC}"
echo -e ""
echo -e "${GREEN}Terminal 1 - Backend:${NC}"
echo -e "  cd backend"
echo -e "  source venv/bin/activate  # On Windows: venv\\Scripts\\activate"
echo -e "  python3 -m uvicorn backend.app.main:app --reload --port 8000"
echo -e ""
echo -e "${GREEN}Terminal 2 - Frontend:${NC}"
echo -e "  cd frontend"
echo -e "  npm run dev"
echo -e ""
echo -e "${GREEN}Access the application:${NC}"
echo -e "  Frontend:  http://localhost:5173"
echo -e "  Backend:   http://localhost:8000"
echo -e "  API Docs:  http://localhost:8000/docs"
echo -e ""
echo -e "${YELLOW}Test Credentials:${NC}"
echo -e "  Email:    test@example.com"
echo -e "  Username: testuser"
echo -e "  Password: password123"
echo -e ""
echo -e "${YELLOW}Default Admin (requires database setup):${NC}"
echo -e "  Email: admin@example.com"
echo -e "  Password: admin123"
echo -e ""
echo -e "${GREEN}Documentation:${NC}"
echo -e "  Setup Guide:      IMPLEMENTATION_GUIDE.md"
echo -e "  Deployment:       DEPLOYMENT_GUIDE.md"
echo -e ""
