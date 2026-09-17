/**
 * Intent Classifier for Veridian Corp IT Service Agent
 * 
 * Classifies employee messages into intent categories using
 * keyword matching, pattern recognition, and contextual analysis.
 */

const INTENT_DEFINITIONS = {
  password_reset: {
    label: 'Password Reset / Account Lockout',
    keywords: ['password', 'locked out', 'lockout', 'lock out', 'login', 'log in', 'cant login', "can't login", 'reset', 'failed attempts', 'unlock', 'account locked'],
    patterns: [/locked?\s*out/i, /password/i, /failed\s*attempt/i, /can'?t\s*(log\s*in|sign\s*in)/i, /account.*lock/i],
    priority: 'medium',
    kb_articles: ['KB-01']
  },
  vpn_access: {
    label: 'VPN Access',
    keywords: ['vpn', 'remote access', 'credentials expired', 'vpn expired', 'vpn access', 'contractor vpn', 'remote connect'],
    patterns: [/vpn/i, /remote\s*access/i, /credential.*expir/i],
    priority: 'medium',
    kb_articles: ['KB-02']
  },
  laptop_issue: {
    label: 'Laptop Issue / Hardware',
    keywords: ['laptop', 'computer', 'hardware', "won't turn on", 'dead', 'broken', 'screen flickering', 'flickering', 'replacement', 'not working laptop', 'hardware failure'],
    patterns: [/laptop/i, /computer.*(?:dead|broken|turn|work)/i, /screen.*flicker/i, /won'?t\s*turn\s*on/i, /hardware\s*fail/i],
    priority: 'medium',
    kb_articles: ['KB-03', 'ASSET-POLICY']
  },
  software_install: {
    label: 'Software Installation',
    keywords: ['software', 'install', 'application', 'tool', 'program', 'catalog', 'browser extension', 'extension', 'non-catalog', 'data-analysis'],
    patterns: [/install/i, /software/i, /browser\s*extension/i, /not\s*in\s*(?:the\s*)?(?:software\s*)?catalog/i, /approval.*install/i],
    priority: 'low',
    kb_articles: ['KB-04']
  },
  printer_issue: {
    label: 'Printer Issue',
    keywords: ['printer', 'print', 'paper jam', 'printing', 'spooler', 'paper', 'jam'],
    patterns: [/printer/i, /print/i, /paper\s*jam/i, /spooler/i],
    priority: 'low',
    kb_articles: ['KB-05']
  },
  email_quota: {
    label: 'Email / Mailbox Issue',
    keywords: ['email', 'mailbox', 'quota', 'full', 'storage', 'inbox', "can't send", 'cannot send', 'mail full', 'mailbox full'],
    patterns: [/mail(?:box)?\s*(?:is\s*)?full/i, /can'?t\s*send\s*email/i, /quota/i, /email.*storage/i],
    priority: 'medium',
    kb_articles: ['KB-06']
  },
  guest_wifi: {
    label: 'Guest Wi-Fi Access',
    keywords: ['wifi', 'wi-fi', 'guest', 'visitor', 'wireless', 'guest wifi', 'guest wi-fi', 'visiting'],
    patterns: [/guest.*wi-?fi/i, /wi-?fi.*guest/i, /visitor.*(?:wifi|internet|access)/i, /guest.*visit/i],
    priority: 'low',
    kb_articles: ['KB-07']
  },
  expense_tool: {
    label: 'Expense Tool Access',
    keywords: ['expense', 'expense tool', 'expense management', 'finance tool'],
    patterns: [/expense\s*(?:tool|management|software|system)/i, /expense/i],
    priority: 'low',
    kb_articles: ['KB-08']
  },
  security_incident: {
    label: 'Security Incident',
    keywords: ['phishing', 'malware', 'virus', 'hack', 'hacked', 'suspicious', 'unauthorized', 'security', 'breach', 'scam', 'forwarding', 'forward'],
    patterns: [/phishing/i, /malware/i, /suspicious\s*(?:email|link|attachment)/i, /unauthorized\s*access/i, /security\s*(?:incident|breach)/i, /forward.*(?:phishing|suspicious)/i],
    priority: 'critical',
    kb_articles: ['KB-09']
  },
  home_equipment: {
    label: 'Work-From-Home Equipment',
    keywords: ['work from home', 'wfh', 'remote', 'home office', 'monitor', 'chair', 'equipment', 'home equipment', 'working from home'],
    patterns: [/work(?:ing)?\s*(?:from|at)\s*home/i, /home\s*office/i, /wfh/i, /remote.*(?:monitor|chair|equipment)/i],
    priority: 'low',
    kb_articles: ['KB-10']
  },
  admin_access: {
    label: 'Admin / Elevated Access Request',
    keywords: ['admin', 'administrator', 'admin access', 'elevated', 'root', 'server access', 'privileged'],
    patterns: [/admin\s*access/i, /administrator/i, /elevated.*access/i, /server.*access/i, /root\s*access/i],
    priority: 'high',
    kb_articles: []
  },
  unclear: {
    label: 'Unclear / Insufficient Information',
    keywords: [],
    patterns: [],
    priority: 'low',
    kb_articles: []
  }
};

/**
 * Classify the intent of an employee message
 * @param {string} message - The employee's message
 * @returns {Object} Classification result with intent, confidence, matched keywords, and KB references
 */
function classifyIntent(message) {
  if (!message || typeof message !== 'string') {
    return {
      intent: 'unclear',
      label: 'Unclear / Insufficient Information',
      confidence: 0,
      matched_keywords: [],
      matched_patterns: [],
      kb_articles: [],
      priority: 'low',
      reasoning: 'No message provided or invalid input'
    };
  }

  const normalizedMessage = message.toLowerCase().trim();
  const scores = {};
  const matchDetails = {};

  // Score each intent
  for (const [intentName, definition] of Object.entries(INTENT_DEFINITIONS)) {
    if (intentName === 'unclear') continue;

    let score = 0;
    const matchedKeywords = [];
    const matchedPatterns = [];

    // Keyword matching (each keyword match = 1 point)
    for (const keyword of definition.keywords) {
      if (normalizedMessage.includes(keyword.toLowerCase())) {
        score += 1;
        matchedKeywords.push(keyword);
      }
    }

    // Pattern matching (each pattern match = 2 points - more specific)
    for (const pattern of definition.patterns) {
      if (pattern.test(message)) {
        score += 2;
        matchedPatterns.push(pattern.toString());
      }
    }

    if (score > 0) {
      scores[intentName] = score;
      matchDetails[intentName] = { matchedKeywords, matchedPatterns };
    }
  }

  // Find the highest scoring intent
  const sortedIntents = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (sortedIntents.length === 0) {
    // Check message length — very short messages are likely unclear
    if (normalizedMessage.split(/\s+/).length < 5) {
      return {
        intent: 'unclear',
        label: 'Unclear / Insufficient Information',
        confidence: 0.9,
        matched_keywords: [],
        matched_patterns: [],
        kb_articles: [],
        priority: 'low',
        reasoning: 'Message is too short or vague to determine intent. Need more information from the employee.'
      };
    }

    return {
      intent: 'unclear',
      label: 'Unclear / Insufficient Information',
      confidence: 0.7,
      matched_keywords: [],
      matched_patterns: [],
      kb_articles: [],
      priority: 'low',
      reasoning: 'No matching keywords or patterns found. Unable to classify the issue.'
    };
  }

  const [topIntent, topScore] = sortedIntents[0];
  const definition = INTENT_DEFINITIONS[topIntent];
  const maxPossibleScore = definition.keywords.length + (definition.patterns.length * 2);
  const confidence = Math.min(topScore / Math.max(maxPossibleScore * 0.4, 1), 1.0);

  return {
    intent: topIntent,
    label: definition.label,
    confidence: Math.round(confidence * 100) / 100,
    matched_keywords: matchDetails[topIntent].matchedKeywords,
    matched_patterns: matchDetails[topIntent].matchedPatterns,
    kb_articles: definition.kb_articles,
    priority: definition.priority,
    reasoning: `Classified as "${definition.label}" based on ${matchDetails[topIntent].matchedKeywords.length} keyword match(es) and ${matchDetails[topIntent].matchedPatterns.length} pattern match(es).`,
    all_scores: sortedIntents.map(([intent, score]) => ({ intent, score }))
  };
}

/**
 * Get intent definition by name
 */
function getIntentDefinition(intentName) {
  return INTENT_DEFINITIONS[intentName] || INTENT_DEFINITIONS.unclear;
}

module.exports = { classifyIntent, getIntentDefinition, INTENT_DEFINITIONS };
