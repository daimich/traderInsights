#!/bin/bash

# StockInsight Netlify Deployment Script
# This script sets up and deploys your app to Netlify

echo "🚀 StockInsight Netlify Deployment Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo "Please install Node.js from: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js detected:${NC} $(node --version)"

# Create project structure
echo -e "\n${YELLOW}Creating project structure...${NC}"

# Create directories
mkdir -p public
mkdir -p netlify/functions
mkdir -p assets

# Move HTML file to public directory
if [ -f "index.html" ]; then
    echo "Moving index.html to public directory..."
    mv index.html public/
elif [ ! -f "public/index.html" ]; then
    echo -e "${RED}❌ index.html not found!${NC}"
    echo "Please ensure index.html exists in the current directory"
    exit 1
fi

# Copy README if it exists
if [ -f "README.md" ]; then
    cp README.md public/
fi

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
npm install

# Install Netlify CLI globally
echo -e "\n${YELLOW}Installing Netlify CLI...${NC}"
npm install -g netlify-cli

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}Creating .env file...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  Please add your API keys to .env file${NC}"
    echo "Edit .env and add your Alpha Vantage API key"
fi

# Initialize Netlify
echo -e "\n${YELLOW}Initializing Netlify...${NC}"
echo "You'll need to:"
echo "1. Login to your Netlify account"
echo "2. Choose 'Create & configure a new site'"
echo "3. Choose your team"
echo "4. Give your site a name (e.g., stockinsight)"
echo ""
read -p "Press Enter to continue..."

netlify init

# Link environment variables
echo -e "\n${YELLOW}Setting up environment variables...${NC}"
echo "Enter your Alpha Vantage API key:"
read -s ALPHA_KEY
netlify env:set ALPHA_VANTAGE_KEY "$ALPHA_KEY"

# Test locally
echo -e "\n${YELLOW}Testing local development server...${NC}"
echo "Your site will open at http://localhost:8888"
echo "Press Ctrl+C to stop the server and continue deployment"
netlify dev

# Deploy
echo -e "\n${YELLOW}Ready to deploy?${NC}"
read -p "Deploy to production? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${YELLOW}Deploying to Netlify...${NC}"
    netlify deploy --prod
    
    echo -e "\n${GREEN}✅ Deployment complete!${NC}"
    echo "Your site is now live!"
    echo ""
    echo "Next steps:"
    echo "1. Visit your site URL"
    echo "2. Test the stock analysis features"
    echo "3. Monitor function logs: netlify functions:log"
    echo "4. View analytics in Netlify dashboard"
else
    echo -e "\n${YELLOW}Skipping production deployment${NC}"
    echo "You can deploy later with: netlify deploy --prod"
fi

echo -e "\n${GREEN}Setup complete!${NC}"