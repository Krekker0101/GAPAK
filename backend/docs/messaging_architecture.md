# GAPAK Messaging System Architecture

## Overview

High-performance distributed messaging system designed for 100+ million users with sub-100ms latency, end-to-end encryption, and horizontal scalability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT LAYER                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Mobile     │  │   Web App    │  │   Desktop    │  │   IoT Device │              │
│  │   (iOS/Android)│ │  (React/Next)│ │  (Electron)  │  │   (Embedded) │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                  │                     │
│         └──────────────────┴──────────────────┴──────────────────┘                     │
│                            │                                                              │
│                    WebSocket / HTTPS                                                     │
└────────────────────────────┼──────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼──────────────────────────────────────────────────────────────┐
│                        EDGE LAYER                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐        │
│  │                    API GATEWAY (Kong/Envoy)                                 │        │
│  │  - Rate Limiting  - Load Balancing  - SSL Termination  - Request Routing    │        │
│  └─────────────────────────────────────────────────────────────────────────────┘        │
│                             │                                                              │
│         ┌───────────────────┼───────────────────┐                                       │
│         │                   │                   │                                       │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Region A  │    │   Region B  │    │   Region C  │                                 │
│  │  (Primary)  │    │  (Secondary)│    │  (Tertiary) │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
└─────────┼──────────────────┼──────────────────┼──────────────────────────────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────────────────────────────────┐
│         │       APPLICATION LAYER (Stateless Microservices)                            │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Gateway   │    │   Gateway   │    │   Gateway   │                                 │
│  │   Service   │    │   Service   │    │   Service   │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                  │                                         │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │  WebSocket  │    │  WebSocket  │    │  WebSocket  │                                 │
│  │   Service   │    │   Service   │    │   Service   │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                  │                                         │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Message   │    │   Message   │    │   Message   │                                 │
│  │   Service   │    │   Service   │    │   Service   │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                  │                                         │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Presence  │    │   Presence  │    │   Presence  │                                 │
│  │   Service   │    │   Service   │    │   Service   │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                  │                                         │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Push      │    │   Push      │    │   Push      │                                 │
│  │   Service   │    │   Service   │    │   Service   │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                  │                                         │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Security  │    │   Security  │    │   Security  │                                 │
│  │   Service   │    │   Service   │    │   Service   │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
└─────────┼──────────────────┼──────────────────┼──────────────────────────────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────────────────────────────────┐
│         │       MESSAGE QUEUE LAYER (Event Streaming)                                    │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Kafka     │    │   Kafka     │    │   Kafka     │                                 │
│  │   Cluster   │    │   Cluster   │    │   Cluster   │                                 │
│  │             │    │             │    │             │                                 │
│  │ Topics:     │    │ Topics:     │    │ Topics:     │                                 │
│  │ - messages  │    │ - messages  │    │ - messages  │                                 │
│  │ - presence  │    │ - presence  │    │ - presence  │                                 │
│  │ - receipts  │    │ - receipts  │    │ - receipts  │                                 │
│  │ - push      │    │ - push      │    │ - push      │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
└─────────┼──────────────────┼──────────────────┼──────────────────────────────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼──────────────────────────────────────────┐
│         │       DATA LAYER                                                          │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │  PostgreSQL │    │  PostgreSQL │    │  PostgreSQL │                                 │
│  │  (Primary)  │    │  (Replica)  │    │  (Replica)  │                                 │
│  │             │    │             │    │             │                                 │
│  │ Tables:     │    │ Tables:     │    │ Tables:     │                                 │
│  │ - users     │    │ - users     │    │ - users     │                                 │
│  │ - chats     │    │ - chats     │    │ - chats     │                                 │
│  │ - messages  │    │ - messages  │    │ - messages  │                                 │
│  │ - devices   │    │ - devices   │    │ - devices   │                                 │
│  │ - keys      │    │ - keys      │    │ - keys      │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                  │                                         │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │    Redis    │    │    Redis    │    │    Redis    │                                 │
│  │   Cluster   │    │   Cluster   │    │   Cluster   │                                 │
│  │             │    │             │    │             │                                 │
│  │ Use:        │    │ Use:        │    │ Use:        │                                 │
│  │ - Sessions  │    │ - Sessions  │    │ - Sessions  │                                 │
│  │ - Presence  │    │ - Presence  │    │ - Presence  │                                 │
│  │ - Rate Limit│    │ - Rate Limit│    │ - Rate Limit│                                 │
│  │ - Cache     │    │ - Cache     │    │ - Cache     │                                 │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                                 │
│         │                  │                  │                                         │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐                                 │
│  │   Object    │    │   Object    │    │   Object    │                                 │
│  │   Storage   │    │   Storage   │    │   Storage   │                                 │
│  │  (S3/GCS)   │    │  (S3/GCS)   │    │  (S3/GCS)   │                                 │
│  │             │    │             │    │             │                                 │
│  │ - Media     │    │ - Media     │    │ - Media     │                                 │
│  │ - Attachments│   │ - Attachments│   │ - Attachments│                                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Stateless Services
- All application services are stateless
- Session data stored in Redis
- Enables horizontal scaling without sticky sessions
- Auto-scaling based on load

### 2. Event-Driven Architecture
- Kafka as central event bus
- Asynchronous message processing
- Decoupled services
- Event sourcing for audit trail

### 3. Multi-Region Deployment
- Active-active multi-region setup
- GeoDNS for routing
- Cross-region data replication
- Regional failover capability

### 4. Security by Design
- End-to-end encryption (Signal Protocol)
- Perfect Forward Secrecy
- Zero-knowledge architecture
- Hardware Security Modules (HSM) for key protection

### 5. Reliability Patterns
- Idempotent operations
- Automatic retries with exponential backoff
- Dead letter queues
- Circuit breakers

## Technology Stack

### Core Technologies
- **Language**: Go 1.24+
- **API Protocol**: gRPC (internal), REST/HTTP (external)
- **Real-time**: WebSocket with fallback to Server-Sent Events
- **Message Queue**: Apache Kafka (or NATS JetStream for simpler deployments)
- **Cache**: Redis Cluster
- **Database**: PostgreSQL 16+ with logical replication
- **Object Storage**: S3-compatible (AWS S3, GCS, MinIO)
- **API Gateway**: Kong or Envoy
- **Service Mesh**: Istio (optional for complex deployments)
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack or Loki
- **Tracing**: Jaeger or OpenTelemetry

### Security Libraries
- **Encryption**: Signal Protocol (libsignal), X3DH
- **Key Management**: HashiCorp Vault or AWS KMS
- **Authentication**: JWT with RS256
- **Rate Limiting**: Redis-based token bucket
- **DDoS Protection**: Cloudflare or similar

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Concurrent Connections | 10M+ | Active WebSocket connections |
| Message Throughput | 1M+ msg/sec | Messages processed |
| End-to-End Latency | <100ms | P95 delivery time |
| API Response Time | <50ms | P95 API latency |
| Availability | 99.99% | Uptime SLA |
| Data Durability | 99.999999% | Multi-region replication |

## Scalability Strategy

### Horizontal Scaling
- Stateless services can scale to N instances
- Auto-scaling based on CPU, memory, and custom metrics
- Load balancer distributes traffic evenly

### Vertical Scaling
- Database sharding by user_id hash
- Redis clustering with consistent hashing
- Kafka partitioning by chat_id

### Geographic Scaling
- Regional data centers for low latency
- Cross-region replication for disaster recovery
- Geo-routing for optimal user experience
