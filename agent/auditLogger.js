/**
 * Audit Logger for Veridian Corp IT Service Agent
 * 
 * Maintains a comprehensive audit trail of all agent actions,
 * including classifications, resolutions, escalations, and tickets.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const AUDIT_PATH = path.join(__dirname, '..', 'data', 'auditTrail.json');

/**
 * Load audit trail
 */
function loadAuditTrail() {
  try {
    return JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  } catch (err) {
    return [];
  }
}

/**
 * Save audit trail
 */
function saveAuditTrail(trail) {
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(trail, null, 2), 'utf8');
}

/**
 * Log an agent action to the audit trail
 * @param {Object} entry - Audit entry
 * @returns {Object} The created audit entry with ID and timestamp
 */
function logAction({
  action_type,
  employee_name,
  employee_email,
  request_id,
  ticket_id,
  intent_classified,
  confidence,
  kb_articles_referenced,
  resolution_summary,
  escalation_level,
  escalation_target,
  follow_up_questions,
  status,
  message_received,
  agent_response,
  notes
}) {
  const trail = loadAuditTrail();

  const entry = {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    action_type: action_type || 'unknown',
    employee: {
      name: employee_name || 'Unknown',
      email: employee_email || ''
    },
    request_id: request_id || null,
    ticket_id: ticket_id || null,
    classification: {
      intent: intent_classified || null,
      confidence: confidence || null
    },
    kb_articles_referenced: kb_articles_referenced || [],
    resolution_summary: resolution_summary || null,
    escalation: {
      level: escalation_level || null,
      target: escalation_target || null
    },
    follow_up_questions: follow_up_questions || [],
    status: status || 'logged',
    interaction: {
      message_received: message_received || null,
      agent_response: agent_response ? agent_response.substring(0, 500) : null
    },
    notes: notes || null
  };

  trail.push(entry);
  saveAuditTrail(trail);

  return entry;
}

/**
 * Get audit trail entries with optional filters
 */
function getAuditTrail(filters = {}) {
  let trail = loadAuditTrail();

  if (filters.employee_email) {
    trail = trail.filter(e => e.employee.email === filters.employee_email);
  }
  if (filters.action_type) {
    trail = trail.filter(e => e.action_type === filters.action_type);
  }
  if (filters.request_id) {
    trail = trail.filter(e => e.request_id === filters.request_id);
  }
  if (filters.ticket_id) {
    trail = trail.filter(e => e.ticket_id === filters.ticket_id);
  }
  if (filters.intent) {
    trail = trail.filter(e => e.classification.intent === filters.intent);
  }
  if (filters.from_date) {
    trail = trail.filter(e => new Date(e.timestamp) >= new Date(filters.from_date));
  }
  if (filters.to_date) {
    trail = trail.filter(e => new Date(e.timestamp) <= new Date(filters.to_date));
  }
  if (filters.limit) {
    trail = trail.slice(-filters.limit);
  }

  return trail;
}

/**
 * Get audit summary statistics
 */
function getAuditStats() {
  const trail = loadAuditTrail();

  const actionTypeCounts = {};
  const intentCounts = {};
  const escalationCounts = {};

  trail.forEach(entry => {
    actionTypeCounts[entry.action_type] = (actionTypeCounts[entry.action_type] || 0) + 1;
    if (entry.classification.intent) {
      intentCounts[entry.classification.intent] = (intentCounts[entry.classification.intent] || 0) + 1;
    }
    if (entry.escalation.level) {
      escalationCounts[entry.escalation.level] = (escalationCounts[entry.escalation.level] || 0) + 1;
    }
  });

  return {
    total_entries: trail.length,
    by_action_type: actionTypeCounts,
    by_intent: intentCounts,
    by_escalation: escalationCounts
  };
}

/**
 * Clear audit trail (for testing)
 */
function clearAuditTrail() {
  saveAuditTrail([]);
}

module.exports = { logAction, getAuditTrail, getAuditStats, clearAuditTrail, loadAuditTrail };
