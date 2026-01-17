# ShiftX Documentation Index

## 📚 Quick Links

### Getting Started
- [README](../README.md) - Main project overview
- [DEV_ONBOARDING](DEV_ONBOARDING.md) - Developer onboarding checklist
- [PROJECT_STATUS](PROJECT_STATUS.md) - **Current status & recent updates**
- [SETUP](SETUP.md) - Development environment setup
- [DEVELOPMENT](DEVELOPMENT.md) - Development workflow and best practices

### 🏗️ Architecture & Design (`/architecture/`)
- [ARCHITECTURE](architecture/ARCHITECTURE.md) - System architecture and design patterns
- [FILE_STRUCTURE](architecture/FILE_STRUCTURE.md) - Complete file structure and organization
- [FILES](architecture/FILES.md) - Project file structure explained

### 🔧 Backend & Functions (`/backend/`)
- [backend-contract](backend/backend-contract.md) - Backend API contracts and data models
- [FUNCTIONS](backend/FUNCTIONS.md) - Cloud Functions implementation details
- [FIRESTORE_RULES_REFERENCE](backend/FIRESTORE_RULES_REFERENCE.md) - Security rules documentation
- [FIRESTORE_RULES_UPDATE](backend/FIRESTORE_RULES_UPDATE.md) - Recent security updates
- [firestore.rules](backend/firestore.rules) - Actual security rules file

### 🚀 Deployment & Production (`/deployment/`)
- [DEPLOYMENT](deployment/DEPLOYMENT.md) - Deployment procedures
- [PRODUCTION_DEPLOYMENT_PLAN](deployment/PRODUCTION_DEPLOYMENT_PLAN.md) - Web + backend + iOS rollout plan
- [PRODUCTION_DEPLOYMENT](deployment/PRODUCTION_DEPLOYMENT.md) - Current production deployment status ✨
- [PRODUCTION_READINESS](deployment/PRODUCTION_READINESS.md) - Production checklist
- [PRODUCTION_AUDIT](deployment/PRODUCTION_AUDIT.md) - Production deployment audit
- [PRODUCTION_CHECKLIST](deployment/PRODUCTION_CHECKLIST.md) - Pre-deployment checklist
- [STRIPE_SETUP](deployment/STRIPE_SETUP.md) - Payment integration setup

### ✅ Testing & Quality Assurance (`/testing/`)
- [AUTOMATED_TESTING](testing/AUTOMATED_TESTING.md) - Smoke test and automated testing ✨
- [QA_CHECKLIST](testing/QA_CHECKLIST.md) - Quality assurance testing procedures
- [VERIFICATION_REPORT](testing/VERIFICATION_REPORT.md) - Feature verification results
- [DRIVER_MVP_V1_VERIFICATION](testing/DRIVER_MVP_V1_VERIFICATION.md) - MVP verification

### ✨ Feature Documentation (`/features/`)
- [RECENT_FEATURES](features/RECENT_FEATURES.md) - Latest feature implementations (PR2, PR4) ✨
- [AUTOCOMPLETE_IMPLEMENTATION](features/AUTOCOMPLETE_IMPLEMENTATION.md) - Address autocomplete
- [REQUEST_AGAIN_IMPLEMENTATION](features/REQUEST_AGAIN_IMPLEMENTATION.md) - Ride rebooking
- [RECEIPT_REQUEST_AGAIN](features/RECEIPT_REQUEST_AGAIN.md) - Receipt and rebooking features
- [WALLET_RECEIPT_IMPLEMENTATION](features/WALLET_RECEIPT_IMPLEMENTATION.md) - Driver wallet & receipts
- [WALLET_RECEIPT_TESTING](features/WALLET_RECEIPT_TESTING.md) - Wallet testing procedures
- [STATE_SYNC_FIXES](features/STATE_SYNC_FIXES.md) - State synchronization fixes

### 📋 Project Management (`/project-management/`)
- [PROJECT_SUMMARY](project-management/PROJECT_SUMMARY.md) - High-level project summary
- [PHASE1_CHECKLIST](project-management/PHASE1_CHECKLIST.md) - Phase 1 milestone checklist
- [SYSTEM_IMPROVEMENTS](project-management/SYSTEM_IMPROVEMENTS.md) - System improvement tracking

### 📱 Customer App (`/customer-app/`)
- [BUILD_COMPLETE](customer-app/BUILD_COMPLETE.md) - Customer app build summary
- [IMPLEMENTATION_GUIDE](customer-app/IMPLEMENTATION_GUIDE.md) - Implementation details
- [INTEGRATION_TESTS](customer-app/INTEGRATION_TESTS.md) - Integration testing
- [MANUAL_TEST_CHECKLIST](customer-app/MANUAL_TEST_CHECKLIST.md) - Manual testing procedures
- [QUICKSTART](customer-app/QUICKSTART.md) - Quick start guide

### 🚗 Driver App (`/driver-app/`)
- [DRIVER-APP-WORKFLOW](driver-app/DRIVER-APP-WORKFLOW.md) - Driver app user flow
- [ROUTING](driver-app/ROUTING.md) - Routing implementation

---

## 🗂️ Document Categories

### 📖 Reference Documentation
Technical references and API contracts:
- Backend contract
- Firestore rules
- Functions API
- File structure

### 🛠️ Development Guides
Step-by-step implementation guides:
- Setup instructions
- Feature implementation
- Testing procedures
- Deployment guides

### ✅ Verification & Testing
Quality assurance and verification:
- Test checklists
- Verification reports
- QA procedures
- Integration tests

### 🚀 Production
Production deployment and maintenance:
- Deployment procedures
- Production readiness
- Audit reports
- Stripe setup

---

## �️ Folder Structure

```
docs/
├── INDEX.md                    📚 This file - documentation index
├── SETUP.md                    🔧 Development setup
├── DEVELOPMENT.md              💻 Development workflow
├── PROJECT_STATUS.md           📊 Current project status
│
├── architecture/               🏗️ System design & structure
│   ├── ARCHITECTURE.md
│   ├── FILE_STRUCTURE.md
│   └── FILES.md
│
├── backend/                    🔧 Backend & Cloud Functions
│   ├── backend-contract.md
│   ├── FUNCTIONS.md
│   ├── FIRESTORE_RULES_REFERENCE.md
│   ├── FIRESTORE_RULES_UPDATE.md
│   └── firestore.rules
│
├── deployment/                 🚀 Deployment & production
│   ├── DEPLOYMENT.md
│   ├── PRODUCTION_READINESS.md
│   ├── PRODUCTION_AUDIT.md
│   ├── PRODUCTION_CHECKLIST.md
│   └── STRIPE_SETUP.md
│
├── testing/                    ✅ QA & verification
│   ├── QA_CHECKLIST.md
│   ├── VERIFICATION_REPORT.md
│   └── DRIVER_MVP_V1_VERIFICATION.md
│
├── features/                   ✨ Feature implementations
│   ├── AUTOCOMPLETE_IMPLEMENTATION.md
│   ├── REQUEST_AGAIN_IMPLEMENTATION.md
│   ├── RECEIPT_REQUEST_AGAIN.md
│   ├── WALLET_RECEIPT_IMPLEMENTATION.md
│   ├── WALLET_RECEIPT_TESTING.md
│   └── STATE_SYNC_FIXES.md
│
├── project-management/         📋 Planning & tracking
│   ├── PROJECT_SUMMARY.md
│   ├── PHASE1_CHECKLIST.md
│   └── SYSTEM_IMPROVEMENTS.md
│
├── customer-app/               📱 Customer app docs
│   ├── BUILD_COMPLETE.md
│   ├── IMPLEMENTATION_GUIDE.md
│   ├── INTEGRATION_TESTS.md
│   ├── MANUAL_TEST_CHECKLIST.md
│   └── QUICKSTART.md
│
└── driver-app/                 🚗 Driver app docs
    ├── DRIVER-APP-WORKFLOW.md
    └── ROUTING.md
```

---

## 🔍 Finding Documentation

**By Role:**
- **Backend Developer** → `/backend/`, `/architecture/`
- **Frontend Developer** → `/customer-app/`, `/driver-app/`, `/features/`
- **DevOps/Deployment** → `/deployment/`
- **QA/Testing** → `/testing/`
- **Product/PM** → `/project-management/`, `PROJECT_STATUS.md`

**By Topic:**
- Setup & Config → `SETUP.md`, `DEVELOPMENT.md`
- Backend → `/backend/`
- Frontend → `/customer-app/`, `/driver-app/`
- Deployment → `/deployment/`
- Testing → `/testing/`

**By Phase:**
- Planning → `/project-management/`, `/architecture/`
- Development → `/features/`, app folders
- Testing → `/testing/`
- Deployment → `/deployment/`

---

## �📝 Documentation Standards

### File Naming
- Use UPPERCASE for project-wide documentation
- Use lowercase for technical references
- Use descriptive names (e.g., `WALLET_RECEIPT_IMPLEMENTATION.md`)

### Structure
1. **Title** - Clear, descriptive H1
2. **Overview** - Brief summary
3. **Content** - Detailed information with headers
4. **Examples** - Code snippets where applicable
5. **Links** - Cross-references to related docs

### Updates
- Document all major features
- Update INDEX.md when adding new docs
- Keep deployment and production docs current
- Archive outdated docs with date prefix

---

## 🔍 Finding Documentation

**By Topic:**
- Setup & Config → SETUP.md, DEVELOPMENT.md
- Backend → backend-contract.md, FUNCTIONS.md
- Frontend → Customer/Driver app folders
- Deployment → DEPLOYMENT.md, PRODUCTION_READINESS.md
- Testing → QA_CHECKLIST.md, VERIFICATION_REPORT.md

**By Phase:**
- Planning → ARCHITECTURE.md, PROJECT_SUMMARY.md
- Development → Implementation guides
- Testing → Test checklists and reports
- Deployment → Deployment guides
- Production → Production readiness and audit

---

## 📧 Contributing

When adding new documentation:
1. Create the file in the appropriate `/docs/` subdirectory
2. Use markdown format
3. Add entry to this INDEX.md
4. Cross-reference related documents
5. Include code examples where helpful

---

**Last Updated:** January 13, 2026
