# Gapak Backend 🔐

> A production-oriented, privacy-first social network backend built with Go. Gapak reimagines social platforms through trust, layered identity, controlled visibility, and secure media delivery.

[![Go Version](https://img.shields.io/badge/Go-1.24.3-blue.svg)](https://golang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](#license)
[![Build Status](https://img.shields.io/badge/status-active-brightgreen)](#)

---

## 🎯 Product Vision

Gapak is **not** a simple messenger. It's a large-scale **privacy-first social network** built around trust, layered identity, and controlled visibility. 

### Core Differentiators

- **Multi-Layer Identity**: Users control multiple identity layers (public, friends, trusted, inner-circle)
- **Granular Privacy**: Content is revealed, unlocked, expired, gated, and experienced live—not simply posted
- **First-Class Trust Primitives**: Trust levels, circles, and conditional access are fundamental platform mechanics
- **Secure Media**: Every piece of media is encrypted, access-controlled, and delivered safely
- **Timed Interactions**: Content lifecycles, one-time views, and memory capsules are built in
- **Live Social**: Live streaming, battles, and real-time reactions powered by low-latency architecture

The platform feels like a **new category of social network** where privacy, trust, and control are features, not settings.

---

## 🏗️ Architecture Overview

### Octagonal Modular Design

Gapak follows an **octagonal architecture** with explicit boundaries:

```
┌─────────────────────────────────────────────────┐
│           cmd/api | cmd/worker | cmd/migrate    │ ← Entrypoints
├─────────────────────────────────────────────────┤
│                  internal/app                    │ ← Bootstrap & Routing
├──────────────┬────────────────┬────────────────┤
│ controllers  │    services    │  repositories   │ ← Modules (×17)
├──────────────┴────────────────┴────────────────┤
│  domain (enums, entities) | platform (cross-cuts)  │
├─────────────────────────────────────────────────┤
│  contracts (migrations, DTOs, OpenAPI, Docker)  │
└─────────────────────────────────────────────────┘
```

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `cmd/api` | HTTP API server entrypoint |
| `cmd/worker` | Background job processing (media, stories, cleanup) |
| `cmd/migrate` | Database schema migration runner |
| `internal/app` | Application bootstrap, routing, module wiring |
| `internal/domain` | Core business enums and entities |
| `internal/platform` | Cross-cutting concerns (auth, crypto, cache, logging, middleware) |
| `internal/modules/*` | 17 domain modules (auth, users, posts, chat, media, live, etc.) |
| `internal/workers` | Queue consumers and async orchestration |
| `db/migrations` | SQL schema with Go-managed versioning |
| `docs/` | API contracts and architecture |

---

## 📚 Core Modules

### 1. **Auth** 🔑
- Register / Login / Logout
- Refresh token rotation (HttpOnly cookies + JWT)
- 2FA setup & verification (TOTP)
- Forgot / Reset password
- Brute-force protection

### 2. **Users** 👤
- Profile management
- Visibility settings per identity layer
- Privacy-aware profile presentation
- Multi-layer identity display

### 3. **Posts** 📝
- Create / Edit / Delete
- Privacy levels: public → friends → trusted → private → one-time → timed
- Media attachments with secure delivery
- Feed-ready DTOs

### 4. **Chat** 💬
- Private 1:1 dialogs
- Message threading
- E2EE-ready architecture (plaintext not required server-side)
- Message metadata without exposing content

### 5. **Trust Rooms** 🏠
- Create / manage rooms
- Role-based access (owner, admin, member, guest)
- Room-specific privacy rules
- Secure media delivery inside rooms

### 6. **Sessions** 📱
- Device tracking and awareness
- Active session management
- Revoke single session or all-except-current
- Suspicious login alerts

### 7. **Security** 🛡️
- Device login alerts
- Suspicious activity flags
- Audit event logging
- Panic mode (emergency account lockdown)

### 8. **Friends & Connections** 🤝
- Add / remove connections
- Trusted circles
- Secret sub-circles (foundation)
- Connection requests with accept/reject

### 9. **Media & Storage** 🎬
- Secure file and video upload
- Signed URL architecture
- Direct-to-object-storage flow (resumable multipart)
- Encrypted media at rest
- Adaptive media delivery (HLS/CMAF-ready)
- Video processing pipeline: transcode → segment → manifest

### 10. **Stories** 📸
- 24-hour (configurable) lifecycle
- Privacy: public → friends → trusted → private → custom viewers
- Viewers list (privacy-aware)
- Story replies and reactions
- Highlights

### 11. **Live Streaming** 🔴
- Instant and scheduled live
- Host / co-host / guest roles
- Live chat and reactions
- Viewer count
- Privacy-aware rooms
- Automatic replay asset generation
- Low-latency architecture

### 12. **Battles** ⚔️
- Live challenges between users
- Accept / reject / cancel flows
- Battle rooms with timer, rounds, voting, reactions
- Leaderboard and history
- Anti-bot / anti-abuse protections

### 13. **Presence** 🟢
- Online status tracking
- Ghost mode (hidden online status)
- Last-seen metadata
- Privacy-aware visibility

### 14. **Moderation** 🚨
- Report / flag content
- Reporting architecture (privacy-safe)
- No privacy-breaking shortcuts for admins

### 15. **Subscriptions** 💳
- User subscriptions and tiers
- Billing integration foundation
- Feature access control

### 16. **Unique Social Mechanics** ✨
- One-time posts
- Timed posts
- Timed unlock content
- Private drops
- Memory capsules
- Vanishing comments & media
- Safe replay sharing with expiring access

---

## 🔒 Security & Privacy Architecture

### Security Guarantees

- **Password Hashing**: Argon2id only (no plaintext, no MD5)
- **Token Management**: 
  - Access tokens in JSON responses (`Authorization: Bearer`)
  - Refresh tokens in HttpOnly cookies (`gapak_rt`)
  - CSRF tokens in cookies + response body
- **Brute-Force Protection**: Rate limiting per IP/device
- **CSRF/XSS/SQLi Prevention**: Helmet middleware, parameterized queries, input validation
- **Strict Access Control**: Row-level authorization on all private data
- **Admin Restrictions**: No ordinary admin endpoint can read private chats or media
- **E2EE-Ready**: Server doesn't require plaintext messages
- **Session Management**: Device-aware with revocation capabilities
- **Suspicious Activity Detection**: Login anomalies trigger alerts
- **Audit Events**: All sensitive actions are logged

### Privacy & Anonymity Requirements

✅ **Implemented**
- ✓ Maximum user anonymity and metadata minimization
- ✓ No IP address exposure to other users
- ✓ Minimal IP/device retention (only necessary for security)
- ✓ Pseudonymous account support
- ✓ Privacy-relay architecture for anonymous access
- ✓ Encrypted transport everywhere
- ✓ Separated identities: public, login, device, security
- ✓ Privacy-preserving audit & abuse controls
- ✓ Real privacy architecture (not marketing anonymity)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | Go 1.24 |
| **Web Framework** | Fiber v2 |
| **Database** | PostgreSQL 15+ |
| **Cache & Queue** | Redis |
| **Authentication** | JWT + Argon2id + TOTP |
| **Storage** | S3-compatible (MinIO, AWS S3, DigitalOcean Spaces) |
| **Encryption** | AES-256-GCM |
| **Logging** | zerolog |
| **Validation** | go-playground/validator |
| **Migrations** | Go-native SQL runner |
| **Container** | Docker & Docker Compose |
| **Protocols** | REST + Redis streams (realtime foundation) |

---

## 🚀 Quick Start

### Prerequisites

- Go 1.24+
- PostgreSQL 15+
- Redis 6+ (optional—runs in degraded mode without it)
- Docker & Docker Compose (optional—for containerized setup)

### Local Development

#### 1. Clone & Setup

```bash
git clone https://github.com/gapak/backend.git
cd backend
cp .env.example .env
```

#### 2. Configure `.env`

For **Cloud PostgreSQL (Prisma Data Proxy)**:
```env
DATABASE_URL=postgres://af38a65d8907ceaa55f2684a59e98269f14a6329dea2b3752fef1247f234aa6a:sk_zsDXsG7i2-7zMEMmZ-bvb@db.prisma.io:5432/postgres?sslmode=require
```

For **local PostgreSQL**:
```env
# Previous setup with local PostgreSQL 16
DATABASE_URL=postgresql://postgres:5433@127.0.0.1:5432/gapak?sslmode=disable
# Previous example: postgresql://your_user:your_password@127.0.0.1:5432/gapak?sslmode=disable
REDIS_URL=redis://localhost:6379/5
```

For **Docker Compose** (use defaults in `.env.example`).

#### 3. Run Migrations

```bash
go run ./cmd/migrate
# or
make migrate
```

#### 4. Start Services

**Terminal 1 - API Server**:
```bash
go run ./cmd/api
# Open http://localhost:8080/api/openapi.yaml
```

**Terminal 2 - Background Workers** (optional):
```bash
go run ./cmd/worker
```

---

## 🐳 Docker Deployment

### Using Docker Compose

```bash
docker compose up --build
```

This starts:
- PostgreSQL container
- Redis container
- Migration service (auto-runs before API)
- API service (`http://localhost:8080`)
- Worker service

**Note**: Docker Compose overrides `DATABASE_URL` and `REDIS_URL` for container networking.

### Building Individual Binaries

```bash
make build              # Build API
make build-worker       # Build Worker
make build-migrate      # Build Migrator
```

---

## 📦 Project Structure

```
backend/
├── cmd/
│   ├── api/           # HTTP API entrypoint
│   ├── worker/        # Background job consumer
│   └── migrate/       # Database migration runner
├── internal/
│   ├── app/           # App bootstrap, routing, module registration
│   ├── config/        # Configuration loading & validation
│   ├── domain/        # Business entities and enums
│   ├── modules/       # 17 domain modules
│   │   ├── auth/      # Authentication & sessions
│   │   ├── users/     # User profiles & settings
│   │   ├── posts/     # Posts & feed
│   │   ├── chat/      # Private messaging
│   │   ├── media/     # File & video uploads
│   │   ├── live/      # Live streaming
│   │   ├── stories/   # Stories & highlights
│   │   ├── battles/   # Live battles & duels
│   │   ├── presence/  # Online status
│   │   ├── friends/   # Connections & circles
│   │   ├── sessions/  # Device sessions
│   │   ├── security/  # Security alerts & audit
│   │   ├── moderation/# Reporting & flags
│   │   ├── trustrooms/# Trust rooms & access
│   │   ├── subscriptions/ # Billing & tiers
│   │   └── admin/     # Admin operations
│   ├── platform/      # Cross-cutting concerns
│   │   ├── auth/      # JWT, TOTP, passwords
│   │   ├── crypto/    # Encryption/decryption
│   │   ├── database/  # PostgreSQL & migrations
│   │   ├── cache/     # Redis client
│   │   ├── middleware/# Rate limit, CSRF, auth
│   │   ├── storage/   # S3-compatible gateway
│   │   ├── queue/     # Redis queue producer
│   │   ├── privacy/   # Anonymity & metadata
│   │   ├── httpx/     # HTTP utilities
│   │   ├── logger/    # Structured logging
│   │   └── errors/    # Error definitions
│   └── workers/       # Queue consumer orchestration
├── db/
│   └── migrations/    # SQL migration files
├── docs/
│   ├── api-contract.md
│   └── architecture.md
├── docker/
│   └── Dockerfile
├── .env.example        # Environment variables template
├── docker-compose.yml  # Container orchestration
├── Makefile           # Common commands
└── README.md          # This file
```

---

## 🔧 Configuration

### Core Variables

```env
# Application
APP_NAME=Gapak API
APP_ENV=development|production
APP_HOST=0.0.0.0
APP_PORT=8080
APP_BASE_URL=http://localhost:8080

# Database
DATABASE_URL=postgresql://user:pass@host:5432/gapak?sslmode=disable
DATABASE_MAX_OPEN_CONNS=20
DATABASE_MIN_OPEN_CONNS=5
DATABASE_MAX_CONN_LIFETIME=30m

# Cache & Queue
REDIS_URL=redis://localhost:6379/5

# Authentication
JWT_ISSUER=gapak.api
JWT_ACCESS_SECRET=<256-bit hex string>
JWT_REFRESH_SECRET=<256-bit hex string>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=720h
PASSWORD_PEPPER=<random pepper>
TOTP_WINDOW=1

# Encryption
ENCRYPTION_KEY_BASE64=<base64-encoded 32-byte key>

# Storage (S3-compatible)
STORAGE_PROVIDER=s3
STORAGE_ENDPOINT=https://s3.example.com
STORAGE_BUCKET=gapak-private
STORAGE_MAX_UPLOAD_BYTES=26214400
STORAGE_SIGNED_URL_TTL=15m

# Privacy & Anonymity
ANONYMITY_ENABLED=true
ANONYMITY_STORE_IP=false
ANONYMITY_STORE_USER_AGENT=false

# Rate Limiting
RATE_LIMIT_GLOBAL_WINDOW=1m
RATE_LIMIT_GLOBAL_MAX=120
```

See [`.env.example`](.env.example) for all available options.

---

## 📡 API Documentation

### OpenAPI/Swagger

```bash
# Development
curl http://localhost:8080/api/openapi.yaml

# Or open in Swagger UI
open http://localhost:8080/api/docs
```

### Authentication Flow

1. **Register**: `POST /api/v1/auth/register`
2. **Login**: `POST /api/v1/auth/login` → Get `access_token` + `gapak_rt` cookie
3. **Use Access Token**: `Authorization: Bearer <token>` in headers
4. **Refresh**: `POST /api/v1/auth/refresh` (requires `X-CSRF-Token` header and `gapak_csrf` cookie)
5. **Logout**: `POST /api/v1/auth/logout`

### Example: Create a Post

```bash
# Get access token first
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.accessToken')

# Create post
curl -X POST http://localhost:8080/api/v1/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My first post",
    "content": "Hello, Gapak!",
    "privacy": "friends"
  }'
```

---

## 🧪 Testing & Development

### Run Tests

```bash
# All tests
go test ./...

# Specific package
go test ./internal/modules/auth/...

# With coverage
go test -cover ./...

# Verbose
go test -v ./...
```

### Common Commands

| Command | Purpose |
|---------|---------|
| `make run` | Start API server |
| `make run-worker` | Start background worker |
| `make migrate` | Run database migrations |
| `make build` | Build API binary |
| `make test` | Run all tests |
| `make tidy` | Tidy dependencies |
| `docker compose up --build` | Start full stack with containers |

### Code Organization

- **Controllers** handle HTTP request/response
- **Services** contain business logic and orchestration
- **Repositories** handle data persistence
- **DTOs** define request/response contracts
- **Domain** contains stable business entities

Example pattern:
```go
// controller.go
func (c *Controller) GetUser(ctx *fiber.Ctx) error {
    userID := ctx.Params("id")
    user, err := c.service.GetUser(ctx.Context(), userID)
    return ctx.JSON(user)
}

// service.go
func (s *Service) GetUser(ctx context.Context, id string) (*User, error) {
    return s.repo.GetUserByID(ctx, id)
}

// repository.go
func (r *Repository) GetUserByID(ctx context.Context, id string) (*User, error) {
    // SQL query with parameterization
}
```

---

## 🔄 Realtime & Event System

### PostgreSQL-Backed Event Outbox

- Live events stored in PostgreSQL first
- Redis is the fast dispatch layer
- Frontends can fall back to PostgreSQL polling:
  ```bash
  GET /api/v1/live-streams/{streamId}/events?after=<sequence>
  ```

### Queue & Workers

- **Media Processing**: Transcode, segment, generate thumbnails
- **Story Processing**: Expiry & cleanup
- **Live Replay**: Generate replay assets after live ends
- **Cleanup**: Remove expired content, old sessions, audit logs

Jobs are persisted in PostgreSQL; Redis accelerates dispatch.

---

## 📁 Media Processing Pipeline

### Upload Flow

1. `POST /api/v1/media/upload-intent` → Get signed part URLs
2. Client uploads parts directly to S3 (resumable)
3. `POST /api/v1/media/complete-upload` → Finalize
4. Worker processes (transcode, thumbnail, segment)
5. Media becomes available for playback

### Video Delivery

- **HLS/CMAF-ready**: Adaptive bitrate streaming
- **Multiple variants**: 240p, 360p, 480p, 720p, 1080p
- **Fast startup**: Pre-generated manifests + small initial segments
- **Encryption**: Media encrypted at rest
- **Access control**: Short-lived signed playback URLs
- **Moderation**: Automated safety scanning before availability

---

## 🚦 Rate Limiting

Distributed rate limiting via Redis:

- **Global**: 120 requests/minute per IP (privacy-aware key)
- **Auth**: 10 attempts/5 minutes per IP (login/register)
- **Password**: 5 attempts/15 minutes per IP (reset/change)

Falls back to no-op if Redis is unavailable (still runs, but without limits).

---

## 🔐 Deployment Checklist

Before production:

- [ ] Change all secrets in `.env` (JWT, pepper, encryption key, storage signing)
- [ ] Enable HTTPS (set `COOKIE_SECURE=true`)
- [ ] Set `APP_ENV=production`
- [ ] Configure proper `CORS_ORIGINS`
- [ ] Review and adjust rate limits
- [ ] Set up PostgreSQL backups
- [ ] Set up Redis persistence or clustering
- [ ] Configure S3-compatible storage bucket and access keys
- [ ] Enable security alerts (suspicious login detection, audit events)
- [ ] Test database migrations on production schema
- [ ] Set up monitoring and alerting (logs, metrics, uptime)
- [ ] Review privacy settings (disable test anonymity flags)

---

## 📊 Performance & Scalability

### Design Decisions

- **PostgreSQL**: ACID compliance for auth, sessions, audit
- **Redis**: Fast cache, queue, and realtime dispatch
- **Connection Pooling**: 5-20 DB connections per instance
- **Request Logging**: Privacy-aware (no PII in logs)
- **Graceful Shutdown**: 10-second drain before termination
- **Worker Concurrency**: Configurable (default 4 concurrent media jobs)

### Bottlenecks & Mitigation

| Bottleneck | Mitigation |
|-----------|-----------|
| Video transcoding | Async workers + batching |
| Media uploads | Direct-to-S3 + resumable multipart |
| User lookups | Database indexes + Redis caching |
| Live events | PostgreSQL outbox + Redis relay |
| Rate limiting | Redis counters (O(1) checks) |

---

## 📝 Database Migrations

### Running Migrations

```bash
# Development
go run ./cmd/migrate

# Docker
docker compose run migrate

# Production (via deployment pipeline)
./bin/gapak-migrate
```

### Creating New Migrations

1. Add SQL file to `db/migrations/` with pattern `YYYYMMDDHHMMSS_description.sql`
2. Migration runner applies all pending migrations automatically
3. Commit migration file to version control

**Example**:
```sql
-- db/migrations/20260601120000_add_user_bio.sql
ALTER TABLE users ADD COLUMN bio TEXT;
CREATE INDEX idx_users_bio ON users USING GIST (bio gist_trgm_ops);
```

---

## 🤝 Contributing

### Code Style

- Follow `gofmt` style
- Use meaningful variable names
- Write tests for new features
- Keep functions small and focused

### Pull Request Workflow

1. Create feature branch: `git checkout -b feat/your-feature`
2. Commit with clear messages
3. Test: `go test ./...`
4. Open PR with description
5. Address code review comments
6. Merge when approved

### Running Locally Before PR

```bash
# Lint & format
go fmt ./...

# Run tests
go test -race ./...

# Build
make build

# Docker test
docker compose up --build
docker compose run api go test ./...
```

---

## 📄 License

[Specify your license here]

---

## 🔗 Resources

- **API Contract**: [docs/api-contract.md](docs/api-contract.md)
- **Architecture**: [docs/architecture.md](docs/architecture.md)
- **Fiber Docs**: https://docs.gofiber.io/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Redis Docs**: https://redis.io/documentation

---

## ❓ Support

For issues, questions, or feature requests:

- **Issues**: Open on GitHub
- **Discussions**: Check existing threads
- **Security**: Report privately to [security@gapak.io]

---

---

## 👨‍💻 About the Author

**Abdulloh Ashurov**

Experienced Go developer and software architect passionate about building privacy-first, scalable systems. Creator and lead architect of the Gapak platform.

- **Expertise**: Go, distributed systems, backend architecture, database design, microservices
- **Focus**: Privacy, security, and user-centric social network design
- **Contact**: [GitHub](#) · [LinkedIn](#) · [Email](#)

---

<div align="center">

**Built with ❤️ for privacy-first social networking**

[Star us on GitHub](#) · [Join the community](#) · [Report a bug](#)

</div>
