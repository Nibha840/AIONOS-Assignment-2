/**
 * Ticket Manager for Veridian Corp IT Service Agent
 * 
 * Handles ticket creation, lifecycle management, and tracking.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TICKETS_PATH = path.join(__dirname, '..', 'data', 'ticketQueue.json');

/**
 * Load all tickets
 */
function loadTickets() {
  try {
    return JSON.parse(fs.readFileSync(TICKETS_PATH, 'utf8'));
  } catch (err) {
    return [];
  }
}

/**
 * Save tickets
 */
function saveTickets(tickets) {
  fs.writeFileSync(TICKETS_PATH, JSON.stringify(tickets, null, 2), 'utf8');
}

/**
 * Generate next ticket ID
 */
function generateTicketId() {
  const tickets = loadTickets();
  const existingIds = tickets.map(t => {
    const match = t.id.match(/TK-(\d+)/);
    return match ? parseInt(match[1]) : 0;
  });
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 1051;
  return `TK-${maxId + 1}`;
}

/**
 * Create a new ticket from a resolution
 * @param {Object} params - Ticket parameters
 * @returns {Object} Created ticket
 */
function createTicket({
  employee,
  email,
  issue_summary,
  category,
  priority,
  status,
  resolution,
  kb_reference,
  notes,
  escalation,
  request_id
}) {
  const tickets = loadTickets();

  const ticket = {
    id: generateTicketId(),
    employee: employee || 'Unknown',
    email: email || '',
    issue_summary: issue_summary || 'No summary provided',
    category: category || 'general',
    priority: priority || 'medium',
    status: status || 'Open',
    is_closed: false,
    resolution: resolution || null,
    date_created: new Date().toISOString().split('T')[0],
    date_closed: null,
    kb_reference: kb_reference || null,
    notes: notes || '',
    escalation: escalation || null,
    request_id: request_id || null,
    history: [
      {
        timestamp: new Date().toISOString(),
        action: 'created',
        details: `Ticket created for: ${issue_summary}`
      }
    ]
  };

  tickets.push(ticket);
  saveTickets(tickets);

  return ticket;
}

/**
 * Update ticket status
 */
function updateTicketStatus(ticketId, newStatus, notes = '') {
  const tickets = loadTickets();
  const ticket = tickets.find(t => t.id === ticketId);

  if (!ticket) return null;

  const oldStatus = ticket.status;
  ticket.status = newStatus;

  if (['Resolved', 'Rejected', 'Approved'].some(s => newStatus.includes(s))) {
    ticket.is_closed = true;
    ticket.date_closed = new Date().toISOString().split('T')[0];
  }

  if (notes) {
    ticket.notes = notes;
    ticket.resolution = notes;
  }

  ticket.history.push({
    timestamp: new Date().toISOString(),
    action: 'status_change',
    details: `Status changed from "${oldStatus}" to "${newStatus}"${notes ? ': ' + notes : ''}`
  });

  saveTickets(tickets);
  return ticket;
}

/**
 * Get ticket by ID
 */
function getTicket(ticketId) {
  const tickets = loadTickets();
  return tickets.find(t => t.id === ticketId) || null;
}

/**
 * Get all tickets with optional filters
 */
function getTickets(filters = {}) {
  let tickets = loadTickets();

  if (filters.status) {
    tickets = tickets.filter(t => t.status.toLowerCase().includes(filters.status.toLowerCase()));
  }
  if (filters.category) {
    tickets = tickets.filter(t => t.category === filters.category);
  }
  if (filters.is_closed !== undefined) {
    tickets = tickets.filter(t => t.is_closed === filters.is_closed);
  }
  if (filters.priority) {
    tickets = tickets.filter(t => t.priority === filters.priority);
  }

  return tickets;
}

/**
 * Get dashboard statistics
 */
function getDashboardStats() {
  const tickets = loadTickets();
  const total = tickets.length;
  const open = tickets.filter(t => !t.is_closed).length;
  const closed = tickets.filter(t => t.is_closed).length;
  const critical = tickets.filter(t => t.priority === 'critical' && !t.is_closed).length;
  const high = tickets.filter(t => t.priority === 'high' && !t.is_closed).length;

  const categoryCounts = {};
  const statusCounts = {};
  const priorityCounts = {};

  tickets.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
    priorityCounts[t.priority || 'medium'] = (priorityCounts[t.priority || 'medium'] || 0) + 1;
  });

  return {
    total,
    open,
    closed,
    critical,
    high,
    resolution_rate: total > 0 ? Math.round((closed / total) * 100) : 0,
    by_category: categoryCounts,
    by_status: statusCounts,
    by_priority: priorityCounts
  };
}

module.exports = {
  loadTickets,
  saveTickets,
  createTicket,
  updateTicketStatus,
  getTicket,
  getTickets,
  getDashboardStats,
  generateTicketId
};
