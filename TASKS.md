# Virtual Stock Trading Platform - Project Tasks

## Phase 0: Project Initialization
- [x] Create GitHub repository
- [ ] Initialize project structure
- [ ] Create .gitignore
- [ ] Create .env.example
- [ ] Create DECISIONS.md
- [ ] Create README.md
- [ ] Create docs/ structure

## Phase 1: Backend Setup & User System
- [ ] Set up FastAPI project structure
- [ ] Database models (User, Account)
- [ ] User registration
- [ ] User login & JWT authentication
- [ ] Account initialization with initial cash
- [ ] User profile endpoints
- [ ] Database migrations (Alembic)

## Phase 2: Market Data Provider
- [ ] Create MarketDataProvider abstraction
- [ ] Implement MockMarketDataProvider
- [ ] Implement AKShare provider (or alternative real data)
- [ ] Stock search endpoint
- [ ] Quote endpoint
- [ ] Market status endpoint
- [ ] Error handling for unavailable data

## Phase 3: Trading Engine
- [ ] Trading rules configuration
- [ ] Fee calculator
- [ ] Order model & repository
- [ ] Trade model & repository
- [ ] TradingEngine core logic
- [ ] T+1 restriction logic
- [ ] Atomic transaction handling
- [ ] Idempotency key support
- [ ] Concurrent order handling

## Phase 4: Portfolio & Position Management
- [ ] Position model & repository
- [ ] Buy order flow (end-to-end)
- [ ] Sell order flow (end-to-end)
- [ ] Position calculation (avg cost, profit/loss)
- [ ] Account balance updates
- [ ] Daily asset snapshot

## Phase 5: API Endpoints
- [ ] Auth API (register, login)
- [ ] Market API (search, quote, history)
- [ ] Trading API (buy, sell, orders)
- [ ] Portfolio API (positions, trades)
- [ ] Account API (balance, assets)
- [ ] Leaderboard API

## Phase 6: Frontend Setup
- [ ] Initialize React + TypeScript + Vite
- [ ] Set up TailwindCSS
- [ ] Configure Axios & TanStack Query
- [ ] Set up React Router
- [ ] Create layout components
- [ ] API client setup

## Phase 7: Frontend Pages
- [ ] Login/Register page
- [ ] Dashboard page
- [ ] Market page
- [ ] Stock detail page
- [ ] Order form (buy/sell)
- [ ] Portfolio page
- [ ] Order history page
- [ ] Leaderboard page

## Phase 8: Advanced Features
- [ ] Asset curve visualization
- [ ] Daily profit/loss display
- [ ] Return rate calculation
- [ ] Trading record details
- [ ] Error handling & UI feedback
- [ ] Loading states & empty states

## Phase 9: Testing
- [ ] Backend unit tests (trading engine)
- [ ] Backend integration tests
- [ ] Frontend component tests
- [ ] API tests
- [ ] Test coverage target: >= 90% for core modules

## Phase 10: Docker & Deployment
- [ ] Backend Dockerfile
- [ ] Frontend Dockerfile
- [ ] docker-compose.yml
- [ ] PostgreSQL setup for production
- [ ] Environment configuration

## Phase 11: CI/CD
- [ ] GitHub Actions workflow
- [ ] Linting & formatting checks
- [ ] Test automation
- [ ] Build verification

## Phase 12: Documentation
- [ ] Complete README.md
- [ ] Architecture documentation
- [ ] Database schema documentation
- [ ] Trading rules documentation
- [ ] API documentation
- [ ] Deployment guide
- [ ] Azure deployment recommendations

## Progress Summary
- **Completed Phases**: 0 (partial)
- **Current Phase**: Phase 0 - Initialization
- **Last Updated**: 2026-08-31
