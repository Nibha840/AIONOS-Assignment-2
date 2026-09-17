# Architecture Document — Veridian Corp IT Service Agent

## AIONOS Assignment 2: Internal Service Agent (IT Support)

---

## 1. System Overview

The Veridian Corp IT Service Agent is an AI-powered internal employee support system that automates the handling of IT support requests. It processes employee messages through an intelligent pipeline that classifies intent, finds relevant policies, generates resolutions, and manages the full ticket lifecycle.

### Design Philosophy
- **Data-grounded decisions**: Every agent response is backed by the provided knowledge base — no invented policies
- **Transparent reasoning**: All decisions include source citations and confidence scores
- **Audit-first**: Every action is logged for compliance and traceability
- **Progressive resolution**: Simple requests are auto-resolved; complex ones trigger follow-ups or escalation

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA)                           │
│  ┌──────┐  ┌──────────┐  ┌────────┐  ┌────┐  ┌──────┐  ┌────┐│
│  │ Chat │  │Dashboard │  │Requests│  │ KB │  │Tickets│  │Audit││
│  └──┬───┘  └────┬─────┘  └───┬────┘  └──┬─┘  └───┬──┘  └──┬─┘│
│     │           │             │          │         │         │  │
└─────┼───────────┼─────────────┼──────────┼─────────┼─────────┼──┘
      │           │             │          │         │         │
      ▼           ▼             ▼          ▼         ▼         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     REST API (Express.js)                        │
│  POST /api/chat  │ GET /api/tickets │ GET /api/kb │ GET /api/audit
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AGENT PIPELINE                               │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │  1. INTENT        │  Keyword + pattern matching              │
│  │  CLASSIFIER       │  → intent, confidence, priority          │
│  └────────┬─────────┘                                           │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  2. RESOLUTION    │  KB lookup + precedent search            │
│  │  ENGINE           │  → response, follow-ups, sources         │
│  └────────┬─────────┘                                           │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  3. ESCALATION    │  Risk assessment + policy checks         │
│  │  ENGINE           │  → escalation level, target, SLA         │
│  └────────┬─────────┘                                           │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  4. TICKET        │  Auto-create with metadata               │
│  │  MANAGER          │  → ticket ID, status, priority           │
│  └────────┬─────────┘                                           │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  5. AUDIT         │  Log every action                        │
│  │  LOGGER           │  → full audit trail                      │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (JSON)                           │
│  knowledgeBase.json │ employeeRequests.json │ ticketQueue.json   │
│  auditTrail.json                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Intent Classifier (`agent/intentClassifier.js`)

**Purpose:** Classify employee messages into one of 12 intent categories.

**Approach:** Hybrid keyword + regex pattern matching with scoring.

| Intent | Example Trigger |
|---|---|
| `password_reset` | "locked out", "can't login", "password" |
| `vpn_access` | "VPN", "remote access", "credentials expired" |
| `laptop_issue` | "laptop won't turn on", "screen flickering" |
| `software_install` | "install", "browser extension", "not in catalog" |
| `printer_issue` | "printer", "paper jam", "spooler" |
| `email_quota` | "mailbox full", "can't send email", "quota" |
| `guest_wifi` | "guest Wi-Fi", "visitor wireless" |
| `expense_tool` | "expense tool", "expense management" |
| `security_incident` | "phishing", "malware", "suspicious email" |
| `home_equipment` | "work from home", "monitor", "home office" |
| `admin_access` | "admin access", "server access", "elevated" |
| `unclear` | Fallback when no intent matches |

**Scoring Algorithm:**
- Each keyword match = **1 point**
- Each regex pattern match = **2 points** (more specific)
- Highest-scoring intent wins
- Confidence = score / (max_possible_score × 0.4), capped at 1.0

### 3.2 Resolution Engine (`agent/resolver.js`)

**Purpose:** Generate structured resolutions based on classified intent.

**Key Decisions:**

| Action Type | When Used |
|---|---|
| `auto_resolve` | Clear issue with straightforward KB solution (password reset, guest Wi-Fi, VPN renewal) |
| `follow_up` | Issue identified but missing information (printer asset tag, laptop age, manager name) |
| `escalate` | Security risk, policy conflict, or requires elevated authorization |
| `redirect` | Request falls outside IT scope (e.g., expense tool → Finance) |

**KB Lookup Flow:**
1. Match intent's predefined KB article references
2. If no direct match, search all KB articles by keyword
3. Search ticket queue for precedent cases (same category)
4. Generate resolution with source citations

### 3.3 Escalation Engine (`agent/escalationEngine.js`)

**Purpose:** Risk assessment and escalation routing.

**Escalation Decision Tree:**

```
Is it a security incident?
  ├─ YES → CRITICAL escalation to Security team (1hr SLA)
  │        Did they forward the email?
  │          ├─ YES → Elevated CRITICAL (policy violation KB-09)
  │          └─ NO  → Standard CRITICAL
  └─ NO  → Continue

Is it an admin/elevated access request?
  ├─ YES → HIGH escalation to IT Security + Manager (4hr SLA)
  │        Check TK-1050 precedent (rejected)
  └─ NO  → Continue

Is there a policy conflict?
  ├─ YES → MEDIUM escalation to IT Manager + Finance (24hr SLA)
  │        (e.g., KB-03 says 3yr, Asset Policy says 4yr)
  └─ NO  → Continue

Is it a cross-department request?
  ├─ YES → LOW redirect to correct department (48hr SLA)
  └─ NO  → No escalation needed
```

### 3.4 Ticket Manager (`agent/ticketManager.js`)

**Purpose:** Full ticket lifecycle management.

**Ticket Schema:**
```json
{
  "id": "TK-1052",
  "employee": "Aditi Sharma",
  "email": "aditi.sharma@veridian-corp.example",
  "issue_summary": "Laptop won't turn on",
  "category": "laptop_issue",
  "priority": "high",
  "status": "Open — investigating",
  "is_closed": false,
  "resolution": null,
  "date_created": "2026-09-21",
  "date_closed": null,
  "kb_reference": "KB-03, ASSET-POLICY",
  "notes": "Policy conflict noted",
  "escalation": { "level": "high", "target": "Finance" },
  "request_id": "REQ-01",
  "history": [
    { "timestamp": "...", "action": "created", "details": "..." }
  ]
}
```

### 3.5 Audit Logger (`agent/auditLogger.js`)

**Purpose:** Comprehensive, immutable audit trail.

**What Gets Logged:**
- Timestamp of every action
- Employee identity (name, email)
- Request and ticket IDs
- Intent classification result + confidence
- KB articles referenced
- Resolution summary
- Escalation decisions
- Follow-up questions asked
- Original message and agent response

---

## 4. Data Flow — Processing a Single Request

```
Employee Message
       │
       ▼
┌─────────────────┐
│ Intent Classifier│  "I'm locked out of my account, tried 6 times"
│                  │  → intent: password_reset
│                  │  → confidence: 0.85
│                  │  → KB articles: [KB-01]
└────────┬────────┘
         ▼
┌─────────────────┐
│ Resolution Engine│  KB-01: "If locked out after 5 failed attempts,
│                  │          contact IT to unlock manually"
│                  │  → action: auto_resolve
│                  │  → Unlock account + direct to self-service portal
│                  │  → Source: KB-01
└────────┬────────┘
         ▼
┌─────────────────┐
│ Escalation Check │  → No escalation triggers
│                  │  → password_reset is not a risky action
└────────┬────────┘
         ▼
┌─────────────────┐
│ Ticket Manager   │  → Creates TK-1052
│                  │  → Status: Resolved
│                  │  → KB Ref: KB-01
└────────┬────────┘
         ▼
┌─────────────────┐
│ Audit Logger     │  → Logs full interaction
│                  │  → action_type: auto_resolve
│                  │  → confidence: 0.85
│                  │  → source: KB-01
└─────────────────┘
```

---

## 5. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Chat with the agent (main endpoint) |
| `GET` | `/api/requests` | List all 15 employee requests |
| `GET` | `/api/requests/:id` | Get a specific request |
| `GET` | `/api/tickets` | List all tickets (with filters) |
| `GET` | `/api/tickets/:id` | Get a specific ticket |
| `PATCH` | `/api/tickets/:id` | Update ticket status |
| `GET` | `/api/kb` | List all KB articles |
| `GET` | `/api/kb/:id` | Get a specific KB article |
| `GET` | `/api/audit` | Get audit trail (with filters) |
| `GET` | `/api/audit/stats` | Get audit statistics |
| `GET` | `/api/dashboard/stats` | Get dashboard stats |
| `POST` | `/api/process-all` | Batch-process all 15 requests |
| `POST` | `/api/reset` | Reset system to original state |

---

## 6. Frontend Architecture

**Single Page Application (SPA)** with 6 views:

1. **Agent Chat** — Conversational interface with request selector
2. **Dashboard** — Real-time stats, category breakdown, status overview
3. **Requests** — Table of all 15 employee requests with "Process" action
4. **Tickets** — Card grid of all tickets with filtering
5. **Knowledge Base** — Browse all KB articles with tags and resolution steps
6. **Audit Trail** — Timeline of all agent actions with full details

**Design:** Premium dark theme with glassmorphism, gradient accents, micro-animations.

---

## 7. Inputs, Sources & Assumptions

### Inputs (from Data Pack)
- **10 KB articles** (KB-01 through KB-10) + Asset Management Policy
- **15 employee requests** (REQ-01 through REQ-15)
- **10 existing tickets** (TK-1042 through TK-1051)

### Sources Used for Agent Decisions
Every agent response cites one or more of the KB articles. No external policies or invented information is used.

### Key Assumptions
1. The agent operates as a **first-line triage** system — it resolves what it can and escalates what it can't
2. **KB-03 vs Asset Policy conflict** (3yr vs 4yr laptop replacement): The agent flags this conflict rather than choosing one policy over the other
3. **Phishing email forwarding** (REQ-08): Treated as a policy violation per KB-09, escalated with CRITICAL priority
4. **Admin access** (REQ-10): Referenced TK-1050 as precedent (rejected for lack of justification)
5. **Unclear requests** (REQ-15): Agent asks follow-up questions rather than guessing
6. **Expense tool** (REQ-12): Agent clarifies IT vs Finance scope per KB-08

---

## 8. AI Tools Used

| Tool | How Used |
|---|---|
| Google Antigravity (Claude) | Designed architecture, wrote all code, created test suite, built frontend |
| Intent Classification | Custom keyword + regex pattern matching engine (no external AI API) |

The agent itself does **not** call any external AI/LLM APIs at runtime. All classification and resolution logic is deterministic and rule-based, grounded in the provided knowledge base.

---

## 9. How to Run & Demo

### Local Development
```bash
# Install dependencies
npm install

# Start the server
npm start

# Open in browser
# http://localhost:3000
```

### Demo Flow (15 minutes)
1. **Show Dashboard** (empty state)
2. **Process individual requests** — pick 3-4 interesting ones:
   - REQ-03 (auto-resolve: password lockout)
   - REQ-08 (critical escalation: phishing forwarded)
   - REQ-01 (policy conflict: laptop 3.5yr vs 4yr cycle)
   - REQ-15 (unclear: "its not working")
3. **Process All Requests** — batch demo
4. **Show Dashboard** (populated with stats)
5. **Browse Tickets** — show created tickets
6. **Browse Audit Trail** — show full decision log
7. **Browse Knowledge Base** — show source data
8. **Show Architecture** — explain the pipeline
