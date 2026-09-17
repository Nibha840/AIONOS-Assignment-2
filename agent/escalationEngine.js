/**
 * Escalation Engine for Veridian Corp IT Service Agent
 * 
 * Determines whether a request should be escalated based on
 * risk assessment, policy requirements, and contextual analysis.
 */

const ESCALATION_RULES = {
  // Critical — immediate escalation
  security_incident: {
    level: 'critical',
    auto_escalate: true,
    target: 'Security Team (security@veridian-corp.example)',
    reason: 'Security incidents require immediate investigation by the Security team.',
    sla_hours: 1
  },
  // High — needs review before action
  admin_access: {
    level: 'high',
    auto_escalate: true,
    target: 'IT Security + Manager',
    reason: 'Elevated access requests carry significant security risk and require business justification.',
    sla_hours: 4
  },
  // Medium — conditional escalation
  policy_conflict: {
    level: 'medium',
    auto_escalate: false,
    target: 'IT Manager + Finance',
    reason: 'Conflicting policies require management decision.',
    sla_hours: 24
  },
  // Low — informational escalation
  cross_department: {
    level: 'low',
    auto_escalate: false,
    target: 'Relevant Department',
    reason: 'Request falls outside IT scope and needs to be redirected.',
    sla_hours: 48
  }
};

const ESCALATION_LEVELS = {
  critical: { color: '#ff4444', icon: '🚨', label: 'CRITICAL', numeric: 4 },
  high: { color: '#ff8800', icon: '⚠️', label: 'HIGH', numeric: 3 },
  medium: { color: '#ffcc00', icon: '🔶', label: 'MEDIUM', numeric: 2 },
  low: { color: '#4488ff', icon: 'ℹ️', label: 'LOW', numeric: 1 }
};

/**
 * Evaluate whether an intent requires escalation
 * @param {string} intentName - The classified intent
 * @param {Object} resolution - The generated resolution
 * @param {string} originalMessage - The employee's message
 * @returns {Object} Escalation assessment
 */
function evaluateEscalation(intentName, resolution, originalMessage) {
  const assessment = {
    should_escalate: false,
    level: null,
    target: null,
    reason: null,
    sla_hours: null,
    risk_factors: [],
    auto_escalated: false,
    human_review_required: false
  };

  // Check predefined escalation rules
  if (ESCALATION_RULES[intentName]) {
    const rule = ESCALATION_RULES[intentName];
    assessment.should_escalate = true;
    assessment.level = rule.level;
    assessment.target = rule.target;
    assessment.reason = rule.reason;
    assessment.sla_hours = rule.sla_hours;
    assessment.auto_escalated = rule.auto_escalate;
    assessment.human_review_required = true;
  }

  // Check for policy conflicts in resolution
  if (resolution.escalation_reason) {
    assessment.should_escalate = true;
    assessment.level = assessment.level || 'medium';
    assessment.reason = resolution.escalation_reason;
    assessment.risk_factors.push('Policy conflict detected');
    assessment.human_review_required = true;
  }

  // Check for security keywords in the message
  const securityKeywords = /phishing|malware|hack|breach|unauthorized|suspicious.*email/i;
  if (securityKeywords.test(originalMessage) && intentName !== 'security_incident') {
    assessment.risk_factors.push('Security-related keywords detected');
    if (!assessment.should_escalate) {
      assessment.should_escalate = true;
      assessment.level = 'high';
      assessment.target = 'Security Team';
      assessment.reason = 'Message contains security-related keywords that may indicate an unreported incident.';
    }
  }

  // Check if the employee forwarded a suspicious email
  if (/forward/i.test(originalMessage) && /phishing|suspicious|malware/i.test(originalMessage)) {
    assessment.risk_factors.push('Employee forwarded suspicious content — policy violation (KB-09)');
    assessment.level = 'critical';
    assessment.human_review_required = true;
  }

  // Check for urgency indicators
  if (/urgent|asap|immediately|emergency|critical/i.test(originalMessage)) {
    assessment.risk_factors.push('Urgency keywords detected');
  }

  // Check for approval requirements
  if (resolution.requires_approval) {
    assessment.risk_factors.push('Requires approval(s)');
    if (!assessment.should_escalate) {
      assessment.should_escalate = false; // Approval != escalation
    }
  }

  // Check for unclear/vague requests
  if (intentName === 'unclear') {
    assessment.risk_factors.push('Request is unclear — may need human judgment');
    // Don't auto-escalate unclear requests, ask follow-up first
  }

  return assessment;
}

/**
 * Get the escalation level display info
 */
function getEscalationLevelInfo(level) {
  return ESCALATION_LEVELS[level] || ESCALATION_LEVELS.low;
}

module.exports = { evaluateEscalation, getEscalationLevelInfo, ESCALATION_RULES, ESCALATION_LEVELS };
