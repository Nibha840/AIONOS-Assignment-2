# 🏢 Veridian Corp — Internal IT Service Agent

**AIONOS Assignment 2 — Internal Service Agent (IT Support)**

An AI-powered internal employee support agent for IT helpdesk operations at Veridian Corp. Built for the week of **Monday, 21 September 2026 – Friday, 25 September 2026**.

---

## 🚀 Quick Start (One Command)

```bash
npm install && npm start
```

Then open **http://localhost:3000** in your browser.

---

## 📋 What This Agent Does

| Feature | Description |
|---|---|
| 🧠 **Understands Issues** | Classifies employee messages into intent categories using keyword + pattern matching |
| 📚 **Finds Policies** | Matches issues to KB articles and shows the source used |
| ❓ **Asks Follow-ups** | Asks sensible follow-up questions when the request is ambiguous |
| ✅ **Resolves Requests** | Auto-resolves simple requests (password resets, guest Wi-Fi, VPN renewal) |
| 🚨 **Escalates Risks** | Escalates security incidents, admin access requests, and policy conflicts |
| 📋 **Creates Tickets** | Generates structured tickets with ID, priority, status, KB reference |
| 📑 **Shows Sources** | Every response cites the KB article or policy used |
| 🔍 **Audit Trail** | Logs every action: classification, resolution, escalation, ticket creation |

---

## 🏗️ Architecture

```
├── server.js                  # Express API server
├── agent/
│   ├── intentClassifier.js    # NLP intent classification
│   ├── resolver.js            # Resolution engine with KB lookup
│   ├── escalationEngine.js    # Risk assessment & escalation logic
│   ├── ticketManager.js       # Ticket CRUD & lifecycle
│   └── auditLogger.js         # Comprehensive audit trail
├── data/
│   ├── knowledgeBase.json     # 10 KB articles + Asset Policy
│   ├── employeeRequests.json  # 15 employee requests
│   ├── ticketQueue.json       # 10 existing tickets
│   └── auditTrail.json        # Runtime audit log
├── public/
│   ├── index.html             # SPA shell
│   ├── css/styles.css         # Premium dark theme
│   └── js/app.js              # Frontend application
├── test/
│   └── runTests.js            # Automated test suite
├── ARCHITECTURE.md            # Full architecture document
└── README.md                  # This file
```

---

## 🧪 How to Test

### Interactive Testing (Browser)
1. Run `npm start`
2. Open http://localhost:3000
3. **Select a request** from the top carousel (REQ-01 to REQ-15)
4. Click **Send** — the agent processes it and shows:
   - Classification with confidence score
   - Resolution with KB source citations
   - Follow-up questions (if needed)
   - Escalation alert (if triggered)
   - Ticket creation
5. Or click **"Process All Requests"** to batch-process all 15 at once

### Automated Tests
```bash
npm test
```

### API Testing (curl)
```bash
# Chat with the agent
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "My laptop won'\''t turn on", "employee_name": "Test User"}'

# Process all 15 requests
curl -X POST http://localhost:3000/api/process-all

# View tickets
curl http://localhost:3000/api/tickets

# View audit trail
curl http://localhost:3000/api/audit

# View knowledge base
curl http://localhost:3000/api/kb

# Dashboard stats
curl http://localhost:3000/api/dashboard/stats

# Reset system
curl -X POST http://localhost:3000/api/reset
```

---

## 📊 The 15 Employee Requests

| # | Employee | Issue | Agent Action |
|---|---|---|---|
| REQ-01 | Aditi Sharma | Laptop dead, 3.5 years | ⚠️ Escalate (policy conflict: KB-03 vs Asset Policy) |
| REQ-02 | Vikram Chawla | Guest Wi-Fi for visitor | ✅ Auto-resolve (front-desk kiosk) |
| REQ-03 | Karan Mehta | Locked out, 6 attempts | ✅ Auto-resolve (unlock account) |
| REQ-04 | Ritu Bhatia | Non-catalog software | ⏳ Security review (3-5 days) |
| REQ-05 | Sanjay Oberoi | VPN expired | ✅ Auto-resolve (renew credentials) |
| REQ-06 | Meera Iyer | Printer paper jam | ❓ Follow-up (need asset tag) |
| REQ-07 | Farhan Ali | WFH monitor request | ❓ Follow-up (need manager sign-off) |
| REQ-08 | Ananya Reddy | Phishing — forwarded to team | 🚨 CRITICAL escalation (policy violation) |
| REQ-09 | Rohit Desai | Mailbox full | ✅ Auto-resolve (archive + quota info) |
| REQ-10 | Kavya Pillai | Admin access to finance server | 🚨 Escalate (needs justification, ref TK-1050) |
| REQ-11 | Nikhil Bansal | Contractor VPN | ❓ Follow-up (needs manager approval) |
| REQ-12 | Sneha Kulkarni | Expense tool login | ❓ Clarify (IT vs Finance scope) |
| REQ-13 | Aman Gupta | Flickering screen, 2 years | 🔧 Follow-up (repair, not replacement) |
| REQ-14 | Tanya Chopra | Browser extension install | ⏳ Security review needed |
| REQ-15 | Rahul Menon | "its not working" | ❓ Follow-up (unclear — need details) |

---

## 🛠️ Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JS (Single Page Application)
- **Data Store:** JSON files (no database required)
- **Design:** Dark theme with glassmorphism and micro-animations

---

## 📄 License

MIT — Built for AIONOS Assignment 2
