/**
 * Veridian Corp IT Service Agent — Express Server
 * 
 * REST API serving the IT support agent, knowledge base,
 * ticket management, and audit trail.
 * 
 * Run: npm start
 * URL: http://localhost:3000
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

// Agent modules
const { classifyIntent } = require('./agent/intentClassifier');
const { generateResolution, findRelevantArticles } = require('./agent/resolver');
const { evaluateEscalation, getEscalationLevelInfo } = require('./agent/escalationEngine');
const { createTicket, getTicket, getTickets, updateTicketStatus, getDashboardStats } = require('./agent/ticketManager');
const { logAction, getAuditTrail, getAuditStats } = require('./agent/auditLogger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store conversation sessions
const sessions = {};

// ============================================================
//  API ROUTES
// ============================================================

/**
 * POST /api/chat
 * Main chat endpoint — processes employee messages through the agent pipeline
 */
app.post('/api/chat', (req, res) => {
  try {
    const { message, employee_name, employee_email, request_id, session_id } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Initialize or retrieve session
    const sid = session_id || `session-${Date.now()}`;
    if (!sessions[sid]) {
      sessions[sid] = {
        id: sid,
        employee_name: employee_name || 'Anonymous',
        employee_email: employee_email || '',
        history: [],
        ticket_id: null
      };
    }
    const session = sessions[sid];

    // Update session info
    if (employee_name) session.employee_name = employee_name;
    if (employee_email) session.employee_email = employee_email;

    // Step 1: Classify intent
    const classification = classifyIntent(message);

    // Step 2: Generate resolution
    const resolution = generateResolution(
      classification,
      message,
      { name: session.employee_name, email: session.employee_email },
      { history: session.history }
    );

    // Step 3: Evaluate escalation
    const escalation = evaluateEscalation(classification.intent, resolution, message);

    // Step 4: Create ticket if recommended
    let ticket = null;
    if (resolution.ticket_recommended !== false) {
      ticket = createTicket({
        employee: session.employee_name,
        email: session.employee_email,
        issue_summary: message.substring(0, 200),
        category: classification.intent,
        priority: escalation.should_escalate ? escalation.level : classification.priority,
        status: resolution.status === 'resolved' ? 'Resolved' :
               resolution.status === 'escalated' ? `Escalated to ${escalation.target}` :
               resolution.status === 'redirected' ? `Redirected to ${resolution.redirect_department}` :
               resolution.status === 'pending_security_review' ? 'Pending Security review' :
               resolution.status === 'pending_approval' ? 'Pending approval' :
               'Open — investigating',
        resolution: resolution.status === 'resolved' ? resolution.resolution_steps.join('; ') : null,
        kb_reference: resolution.sources.length > 0 ? resolution.sources.map(s => s.id).join(', ') : null,
        notes: resolution.resolution_steps.join('\n'),
        escalation: escalation.should_escalate ? {
          level: escalation.level,
          target: escalation.target,
          reason: escalation.reason
        } : null,
        request_id: request_id || null
      });
      session.ticket_id = ticket.id;
    }

    // Step 5: Log to audit trail
    const auditEntry = logAction({
      action_type: resolution.action_type,
      employee_name: session.employee_name,
      employee_email: session.employee_email,
      request_id: request_id || null,
      ticket_id: ticket ? ticket.id : null,
      intent_classified: classification.intent,
      confidence: classification.confidence,
      kb_articles_referenced: resolution.sources.map(s => s.id),
      resolution_summary: resolution.resolution_steps.join('; '),
      escalation_level: escalation.should_escalate ? escalation.level : null,
      escalation_target: escalation.should_escalate ? escalation.target : null,
      follow_up_questions: resolution.follow_up_questions,
      status: resolution.status,
      message_received: message,
      agent_response: resolution.response_message
    });

    // Step 6: Add to session history
    session.history.push({
      timestamp: new Date().toISOString(),
      role: 'employee',
      message: message
    });
    session.history.push({
      timestamp: new Date().toISOString(),
      role: 'agent',
      message: resolution.response_message,
      classification: classification,
      resolution: resolution
    });

    // Build response
    const response = {
      session_id: sid,
      classification: {
        intent: classification.intent,
        label: classification.label,
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        priority: classification.priority
      },
      resolution: {
        action_type: resolution.action_type,
        status: resolution.status,
        message: resolution.response_message,
        follow_up_questions: resolution.follow_up_questions,
        resolution_steps: resolution.resolution_steps,
        requires_approval: resolution.requires_approval,
        redirect_department: resolution.redirect_department
      },
      sources: resolution.sources,
      precedent_tickets: resolution.precedent_tickets,
      escalation: escalation.should_escalate ? {
        level: escalation.level,
        level_info: getEscalationLevelInfo(escalation.level),
        target: escalation.target,
        reason: escalation.reason,
        risk_factors: escalation.risk_factors,
        sla_hours: escalation.sla_hours
      } : null,
      ticket: ticket ? {
        id: ticket.id,
        status: ticket.status,
        priority: ticket.priority,
        date_created: ticket.date_created
      } : null,
      audit_id: auditEntry.id
    };

    res.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * GET /api/requests
 * List all employee requests from the data pack
 */
app.get('/api/requests', (req, res) => {
  try {
    const requestsPath = path.join(__dirname, 'data', 'employeeRequests.json');
    const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load requests' });
  }
});

/**
 * GET /api/requests/:id
 * Get a specific employee request
 */
app.get('/api/requests/:id', (req, res) => {
  try {
    const requestsPath = path.join(__dirname, 'data', 'employeeRequests.json');
    const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
    const request = requests.find(r => r.id === req.params.id.toUpperCase());
    if (!request) return res.status(404).json({ error: 'Request not found' });
    res.json(request);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load request' });
  }
});

/**
 * GET /api/tickets
 * List all tickets with optional filters
 */
app.get('/api/tickets', (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.category) filters.category = req.query.category;
    if (req.query.priority) filters.priority = req.query.priority;
    if (req.query.is_closed !== undefined) filters.is_closed = req.query.is_closed === 'true';

    const tickets = getTickets(filters);
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load tickets' });
  }
});

/**
 * GET /api/tickets/:id
 * Get a specific ticket
 */
app.get('/api/tickets/:id', (req, res) => {
  try {
    const ticket = getTicket(req.params.id.toUpperCase());
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load ticket' });
  }
});

/**
 * PATCH /api/tickets/:id
 * Update ticket status
 */
app.patch('/api/tickets/:id', (req, res) => {
  try {
    const { status, notes } = req.body;
    const ticket = updateTicketStatus(req.params.id.toUpperCase(), status, notes);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Log the update
    logAction({
      action_type: 'ticket_update',
      ticket_id: ticket.id,
      resolution_summary: `Status updated to: ${status}`,
      status: status,
      notes: notes
    });

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

/**
 * GET /api/kb
 * List all knowledge base articles
 */
app.get('/api/kb', (req, res) => {
  try {
    const kbPath = path.join(__dirname, 'data', 'knowledgeBase.json');
    const articles = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load knowledge base' });
  }
});

/**
 * GET /api/kb/:id
 * Get a specific KB article
 */
app.get('/api/kb/:id', (req, res) => {
  try {
    const kbPath = path.join(__dirname, 'data', 'knowledgeBase.json');
    const articles = JSON.parse(fs.readFileSync(kbPath, 'utf8'));
    const article = articles.find(a => a.id === req.params.id.toUpperCase());
    if (!article) return res.status(404).json({ error: 'Article not found' });
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load article' });
  }
});

/**
 * GET /api/audit
 * Get audit trail with optional filters
 */
app.get('/api/audit', (req, res) => {
  try {
    const filters = {};
    if (req.query.employee_email) filters.employee_email = req.query.employee_email;
    if (req.query.action_type) filters.action_type = req.query.action_type;
    if (req.query.request_id) filters.request_id = req.query.request_id;
    if (req.query.intent) filters.intent = req.query.intent;
    if (req.query.limit) filters.limit = parseInt(req.query.limit);

    const trail = getAuditTrail(filters);
    res.json(trail);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit trail' });
  }
});

/**
 * GET /api/audit/stats
 * Get audit trail statistics
 */
app.get('/api/audit/stats', (req, res) => {
  try {
    const stats = getAuditStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit stats' });
  }
});

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const ticketStats = getDashboardStats();
    const auditStats = getAuditStats();

    res.json({
      tickets: ticketStats,
      audit: auditStats,
      system: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        company: 'Veridian Corp',
        week: 'Monday, 21 September 2026 – Friday, 25 September 2026'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

/**
 * POST /api/process-all
 * Process all 15 employee requests through the agent pipeline
 */
app.post('/api/process-all', (req, res) => {
  try {
    const requestsPath = path.join(__dirname, 'data', 'employeeRequests.json');
    const requests = JSON.parse(fs.readFileSync(requestsPath, 'utf8'));
    const results = [];

    for (const request of requests) {
      const classification = classifyIntent(request.request);
      const resolution = generateResolution(
        classification,
        request.request,
        { name: request.employee, email: request.email }
      );
      const escalation = evaluateEscalation(classification.intent, resolution, request.request);

      let ticket = null;
      if (resolution.ticket_recommended !== false) {
        ticket = createTicket({
          employee: request.employee,
          email: request.email,
          issue_summary: request.request.substring(0, 200),
          category: classification.intent,
          priority: escalation.should_escalate ? escalation.level : classification.priority,
          status: resolution.status === 'resolved' ? 'Resolved' :
                 resolution.status === 'escalated' ? `Escalated to ${escalation.target}` :
                 resolution.status === 'redirected' ? `Redirected to ${resolution.redirect_department}` :
                 resolution.status === 'pending_security_review' ? 'Pending Security review' :
                 resolution.status === 'pending_approval' ? 'Pending approval' :
                 'Open — investigating',
          resolution: resolution.status === 'resolved' ? resolution.resolution_steps.join('; ') : null,
          kb_reference: resolution.sources.length > 0 ? resolution.sources.map(s => s.id).join(', ') : null,
          notes: resolution.resolution_steps.join('\n'),
          escalation: escalation.should_escalate ? {
            level: escalation.level,
            target: escalation.target,
            reason: escalation.reason
          } : null,
          request_id: request.id
        });
      }

      logAction({
        action_type: resolution.action_type,
        employee_name: request.employee,
        employee_email: request.email,
        request_id: request.id,
        ticket_id: ticket ? ticket.id : null,
        intent_classified: classification.intent,
        confidence: classification.confidence,
        kb_articles_referenced: resolution.sources.map(s => s.id),
        resolution_summary: resolution.resolution_steps.join('; '),
        escalation_level: escalation.should_escalate ? escalation.level : null,
        escalation_target: escalation.should_escalate ? escalation.target : null,
        follow_up_questions: resolution.follow_up_questions,
        status: resolution.status,
        message_received: request.request,
        agent_response: resolution.response_message
      });

      results.push({
        request_id: request.id,
        employee: request.employee,
        intent: classification.intent,
        intent_label: classification.label,
        confidence: classification.confidence,
        action_type: resolution.action_type,
        status: resolution.status,
        ticket_id: ticket ? ticket.id : null,
        escalated: escalation.should_escalate,
        escalation_level: escalation.level,
        sources: resolution.sources.map(s => s.id)
      });
    }

    res.json({
      processed: results.length,
      results: results
    });
  } catch (error) {
    console.error('Process all error:', error);
    res.status(500).json({ error: 'Failed to process requests', details: error.message });
  }
});

/**
 * POST /api/reset
 * Reset data to original state (for demo purposes)
 */
app.post('/api/reset', (req, res) => {
  try {
    // Reset ticket queue to original
    const originalTicketsPath = path.join(__dirname, 'data', 'ticketQueue.json');
    const originalTickets = [
      {"id":"TK-1042","employee":"R. Verma","issue_summary":"VPN credential expired","status":"Resolved","is_closed":true,"resolution":"Employee credentials were renewed through the VPN portal.","date_created":"2026-09-14","date_closed":"2026-09-14","kb_reference":"KB-02","category":"vpn_access"},
      {"id":"TK-1043","employee":"S. Iyer","issue_summary":"Laptop replacement (3.2 yrs old)","status":"Approved — pending fulfillment","is_closed":false,"resolution":null,"date_created":"2026-09-15","date_closed":null,"kb_reference":"KB-03","category":"laptop_issue","notes":"Laptop age of 3.2 years meets KB-03 threshold of 3 years. Approved for replacement."},
      {"id":"TK-1044","employee":"A. Khan","issue_summary":"Non-catalog software request","status":"Pending Security review","is_closed":false,"resolution":null,"date_created":"2026-09-16","date_closed":null,"kb_reference":"KB-04","category":"software_install","notes":"Software not found in approved catalog."},
      {"id":"TK-1045","employee":"P. Joshi","issue_summary":"Mailbox quota increase","status":"Approved at 35GB","is_closed":true,"resolution":"Manager approval received. Quota increased from 25GB to 35GB.","date_created":"2026-09-10","date_closed":"2026-09-12","kb_reference":"KB-06","category":"email_quota"},
      {"id":"TK-1046","employee":"M. Das","issue_summary":"Printer paper jam, floor 2","status":"Resolved","is_closed":true,"resolution":"Technician dispatched. Physical jam cleared and print spooler restarted.","date_created":"2026-09-17","date_closed":"2026-09-17","kb_reference":"KB-05","category":"printer_issue"},
      {"id":"TK-1047","employee":"K. Singh","issue_summary":"Home office equipment request","status":"Pending Finance","is_closed":false,"resolution":null,"date_created":"2026-09-18","date_closed":null,"kb_reference":"KB-10","category":"home_equipment","notes":"Manager sign-off received. Awaiting Finance approval."},
      {"id":"TK-1048","employee":"T. Rao","issue_summary":"Phishing email reported","status":"Escalated to Security — under investigation","is_closed":false,"resolution":null,"date_created":"2026-09-19","date_closed":null,"kb_reference":"KB-09","category":"security_incident"},
      {"id":"TK-1049","employee":"V. Nambiar","issue_summary":"Password reset","status":"Resolved","is_closed":true,"resolution":"Account unlocked by IT. Employee reset password via self-service portal.","date_created":"2026-09-19","date_closed":"2026-09-19","kb_reference":"KB-01","category":"password_reset"},
      {"id":"TK-1050","employee":"J. Fernandes","issue_summary":"Admin access request","status":"Rejected — no business justification provided","is_closed":true,"resolution":"Request denied. No sufficient business justification.","date_created":"2026-09-20","date_closed":"2026-09-20","kb_reference":null,"category":"admin_access","notes":"Admin access requests require documented business justification and manager approval."},
      {"id":"TK-1051","employee":"L. Menon","issue_summary":"Guest Wi-Fi issued","status":"Resolved","is_closed":true,"resolution":"Directed employee to front-desk kiosk. Guest Wi-Fi credentials generated.","date_created":"2026-09-20","date_closed":"2026-09-20","kb_reference":"KB-07","category":"guest_wifi"}
    ];
    fs.writeFileSync(originalTicketsPath, JSON.stringify(originalTickets, null, 2), 'utf8');

    // Clear audit trail
    const auditPath = path.join(__dirname, 'data', 'auditTrail.json');
    fs.writeFileSync(auditPath, '[]', 'utf8');

    // Clear sessions
    Object.keys(sessions).forEach(key => delete sessions[key]);

    res.json({ message: 'System reset to original state', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset system' });
  }
});

// Serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🏢  Veridian Corp IT Service Agent                         ║
║   ──────────────────────────────────────                     ║
║                                                              ║
║   Server running at: http://localhost:${PORT}                  ║
║                                                              ║
║   Week of: Monday, 21 Sep 2026 – Friday, 25 Sep 2026        ║
║                                                              ║
║   API Endpoints:                                             ║
║   • POST /api/chat          — Chat with the agent            ║
║   • GET  /api/requests      — Employee requests              ║
║   • GET  /api/tickets       — Ticket queue                   ║
║   • GET  /api/kb            — Knowledge base                 ║
║   • GET  /api/audit         — Audit trail                    ║
║   • GET  /api/dashboard/stats — Dashboard                    ║
║   • POST /api/process-all   — Process all 15 requests        ║
║   • POST /api/reset         — Reset to original state        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
