#!/bin/bash

# Chattr Development Environment Setup Script

set -e

echo "🚀 Setting up Chattr development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if .env file exists and create from example
setup_env_file() {
    local dir=$1
    local env_file="$dir/.env"
    local example_file="$dir/.env.example"
    
    if [ ! -f "$env_file" ]; then
        if [ -f "$example_file" ]; then
            echo -e "${YELLOW}Creating $env_file from $example_file${NC}"
            cp "$example_file" "$env_file"
            echo -e "${GREEN}✅ Created $env_file${NC}"
            echo -e "${BLUE}Please edit $env_file with your actual configuration values${NC}"
        else
            echo -e "${RED}❌ $example_file not found${NC}"
            return 1
        fi
    else
        echo -e "${GREEN}✅ $env_file already exists${NC}"
    fi
}

# Setup environment files
echo -e "\n${BLUE}📝 Setting up environment files...${NC}"
setup_env_file "/Users/azaleas/Developer/WebstormProjects/chattr/nuxt-app"
setup_env_file "/Users/azaleas/Developer/WebstormProjects/chattr/server"

# Check Node.js version
echo -e "\n${BLUE}🔍 Checking Node.js version...${NC}"
node_version=$(node --version)
echo "Node.js version: $node_version"

# Install dependencies for Nuxt app
echo -e "\n${BLUE}📦 Installing Nuxt app dependencies...${NC}"
cd /Users/azaleas/Developer/WebstormProjects/chattr/nuxt-app
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Nuxt app dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Nuxt app dependencies already installed${NC}"
fi

# Install dependencies for Socket server
echo -e "\n${BLUE}📦 Installing Socket server dependencies...${NC}"
cd /Users/azaleas/Developer/WebstormProjects/chattr/server
if [ ! -d "node_modules" ]; then
    npm install
    echo -e "${GREEN}✅ Socket server dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Socket server dependencies already installed${NC}"
fi

# Check environment configuration
echo -e "\n${BLUE}⚙️  Environment Configuration Summary:${NC}"
echo -e "${YELLOW}Nuxt App:${NC}"
echo "  - Default port: 3001 (configurable via NUXT_PORT)"
echo "  - Config file: nuxt-app/.env"

echo -e "${YELLOW}Socket Server:${NC}"
echo "  - Default port: 3002 (configurable via PORT)"
echo "  - Config file: server/.env"

echo -e "\n${GREEN}🎉 Environment setup complete!${NC}"
echo -e "\n${BLUE}Next steps:${NC}"
echo "1. Edit the .env files with your configuration"
echo "2. Set up your Supabase project and add credentials"
echo "3. Run 'npm run dev:all' to start both servers"
echo -e "\n${BLUE}Available commands:${NC}"
echo "  npm run dev:all    - Start both Nuxt and Socket servers"
echo "  npm run dev:nuxt   - Start only Nuxt server"
echo "  npm run dev:socket - Start only Socket server"
