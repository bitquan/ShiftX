# Architecture Documentation

This folder contains system architecture, design patterns, and file structure documentation.

## 📚 Files in This Folder

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete system architecture and design patterns
- **[FILE_STRUCTURE.md](FILE_STRUCTURE.md)** - Detailed file structure with descriptions
- **[FILES.md](FILES.md)** - Project file organization explained

## 🏗️ System Overview

ShiftX is built as a monorepo with:

### Frontend (React Apps)
- **Customer App** - Ride requests, tracking, history
- **Driver App** - Ride management, earnings, navigation

### Backend (Firebase)
- **Cloud Functions** - Business logic and API
- **Firestore** - NoSQL database
- **Auth** - Anonymous authentication
- **Hosting** - Static app hosting

### Key Architectural Decisions

1. **Monorepo Structure** - All code in one repository for easier development
2. **Firebase Backend** - Serverless architecture for scalability
3. **Real-time Updates** - Firestore snapshots for live data
4. **Event Logging** - Comprehensive audit trail for rides
5. **GPS Throttling** - 5s/20m to balance accuracy and cost

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete details.
