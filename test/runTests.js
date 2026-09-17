/**
 * Test Suite for Veridian Corp IT Service Agent
 * 
 * Tests intent classification, resolution logic, escalation,
 * ticket management, and audit trail.
 * 
 * Run: npm test
 */

const { classifyIntent } = require('../agent/intentClassifier');
const { generateResolution } = require('../agent/resolver');
const { evaluateEscalation } = require('../agent/escalationEngine');

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${testName}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${testName}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ============================================================
//  INTENT CLASSIFICATION TESTS
// ============================================================
section('Intent Classification');

// REQ-01: Laptop dead
const req01 = classifyIntent("My laptop won't turn on at all, it's completely dead, had it about 3.5 years now.");
assert(req01.intent === 'laptop_issue', 'REQ-01: Laptop dead → laptop_issue');
assert(req01.confidence > 0, 'REQ-01: Has confidence score');
assert(req01.kb_articles.includes('KB-03'), 'REQ-01: References KB-03');

// REQ-02: Guest Wi-Fi
const req02 = classifyIntent("Can I get Wi-Fi access for a guest visiting our office tomorrow?");
assert(req02.intent === 'guest_wifi', 'REQ-02: Guest Wi-Fi → guest_wifi');

// REQ-03: Locked out
const req03 = classifyIntent("I'm locked out of my account, tried my password 6 times.");
assert(req03.intent === 'password_reset', 'REQ-03: Locked out → password_reset');

// REQ-04: Non-catalog software
const req04 = classifyIntent("Need approval to install a data-analysis tool that's not in the software catalog.");
assert(req04.intent === 'software_install', 'REQ-04: Non-catalog software → software_install');

// REQ-05: VPN expired
const req05 = classifyIntent("My VPN stopped working this morning, says credentials expired.");
assert(req05.intent === 'vpn_access', 'REQ-05: VPN expired → vpn_access');

// REQ-06: Printer issue
const req06 = classifyIntent("Printer on the 3rd floor keeps showing 'paper jam' even though there's no jam.");
assert(req06.intent === 'printer_issue', 'REQ-06: Printer jam → printer_issue');

// REQ-07: Home office monitor
const req07 = classifyIntent("I've started working from home 4 days a week, how do I get a monitor?");
assert(req07.intent === 'home_equipment', 'REQ-07: WFH monitor → home_equipment');

// REQ-08: Phishing
const req08 = classifyIntent("I think I got a phishing email asking for my login — forwarding it to a few teammates to check.");
assert(req08.intent === 'security_incident', 'REQ-08: Phishing → security_incident');

// REQ-09: Mailbox full
const req09 = classifyIntent("My mailbox is full and I can't send emails.");
assert(req09.intent === 'email_quota', 'REQ-09: Mailbox full → email_quota');

// REQ-10: Admin access
const req10 = classifyIntent("Can someone give me admin access to the finance reporting server? Need it urgently for month-end.");
assert(req10.intent === 'admin_access', 'REQ-10: Admin access → admin_access');

// REQ-11: Contractor VPN
const req11 = classifyIntent("New contractor joining my team next week, they'll need VPN access.");
assert(req11.intent === 'vpn_access', 'REQ-11: Contractor VPN → vpn_access');

// REQ-12: Expense tool
const req12 = classifyIntent("I can't log into the expense tool, keeps saying invalid credentials.");
assert(req12.intent === 'expense_tool', 'REQ-12: Expense tool → expense_tool');

// REQ-13: Flickering screen
const req13 = classifyIntent("Laptop screen is flickering on and off, had it 2 years, might just need a fix not a replacement.");
assert(req13.intent === 'laptop_issue', 'REQ-13: Flickering screen → laptop_issue');

// REQ-14: Browser extension
const req14 = classifyIntent("Requesting approval to install a browser extension for productivity tracking.");
assert(req14.intent === 'software_install', 'REQ-14: Browser extension → software_install');

// REQ-15: Unclear
const req15 = classifyIntent("hey can you help, its not working");
assert(req15.intent === 'unclear', 'REQ-15: Vague message → unclear');

// ============================================================
//  RESOLUTION TESTS
// ============================================================
section('Resolution Engine');

// Auto-resolve: Password lockout
const res03 = generateResolution(req03, "I'm locked out of my account, tried my password 6 times.");
assert(res03.action_type === 'auto_resolve', 'REQ-03: Password lockout → auto_resolve');
assert(res03.sources.length > 0, 'REQ-03: Has source citations');
assert(res03.sources[0].id === 'KB-01', 'REQ-03: Sources KB-01');

// Auto-resolve: Guest Wi-Fi
const res02 = generateResolution(req02, "Can I get Wi-Fi access for a guest visiting our office tomorrow?");
assert(res02.action_type === 'auto_resolve', 'REQ-02: Guest Wi-Fi → auto_resolve');
assert(res02.ticket_recommended === false, 'REQ-02: No ticket needed');

// Auto-resolve: VPN expired
const res05 = generateResolution(req05, "My VPN stopped working this morning, says credentials expired.");
assert(res05.action_type === 'auto_resolve', 'REQ-05: VPN expired → auto_resolve');

// Follow-up: Printer issue
const res06 = generateResolution(req06, "Printer on the 3rd floor keeps showing 'paper jam' even though there's no jam.");
assert(res06.action_type === 'follow_up', 'REQ-06: Printer → follow_up');
assert(res06.follow_up_questions.length > 0, 'REQ-06: Has follow-up questions');

// Follow-up: Home equipment
const res07 = generateResolution(req07, "I've started working from home 4 days a week, how do I get a monitor?");
assert(res07.action_type === 'follow_up', 'REQ-07: Home equipment → follow_up');
assert(res07.requires_approval === true, 'REQ-07: Requires approval');

// Escalate: Phishing forwarded
const res08 = generateResolution(req08, "I think I got a phishing email asking for my login — forwarding it to a few teammates to check.");
assert(res08.action_type === 'escalate', 'REQ-08: Phishing → escalate');
assert(res08.priority === 'critical', 'REQ-08: Priority is critical');

// Escalate: Admin access
const res10 = generateResolution(req10, "Can someone give me admin access to the finance reporting server? Need it urgently for month-end.");
assert(res10.action_type === 'escalate', 'REQ-10: Admin access → escalate');
assert(res10.requires_approval === true, 'REQ-10: Requires approval');

// Follow-up: Unclear
const res15 = generateResolution(req15, "hey can you help, its not working");
assert(res15.action_type === 'follow_up', 'REQ-15: Unclear → follow_up');
assert(res15.follow_up_questions.length > 0, 'REQ-15: Asks follow-up questions');

// Escalate: Laptop 3.5 years (policy conflict)
const res01 = generateResolution(req01, "My laptop won't turn on at all, it's completely dead, had it about 3.5 years now.");
assert(res01.action_type === 'escalate', 'REQ-01: Laptop 3.5yr → escalate (policy conflict)');
assert(res01.escalation_reason && res01.escalation_reason.length > 0, 'REQ-01: Has escalation reason');

// Contractor VPN: needs approval
const res11 = generateResolution(req11, "New contractor joining my team next week, they'll need VPN access.");
assert(res11.action_type === 'follow_up', 'REQ-11: Contractor VPN → follow_up');
assert(res11.requires_approval === true, 'REQ-11: Contractor requires manager approval');

// ============================================================
//  ESCALATION TESTS
// ============================================================
section('Escalation Engine');

// Security incident escalation
const esc08 = evaluateEscalation('security_incident', res08, "I think I got a phishing email asking for my login — forwarding it to a few teammates to check.");
assert(esc08.should_escalate === true, 'REQ-08: Should escalate');
assert(esc08.level === 'critical', 'REQ-08: Critical level');
assert(esc08.risk_factors.length > 0, 'REQ-08: Has risk factors');

// Admin access escalation
const esc10 = evaluateEscalation('admin_access', res10, "Can someone give me admin access to the finance reporting server? Need it urgently for month-end.");
assert(esc10.should_escalate === true, 'REQ-10: Should escalate');
assert(esc10.level === 'high', 'REQ-10: High level');

// Guest Wi-Fi: no escalation
const esc02 = evaluateEscalation('guest_wifi', res02, "Can I get Wi-Fi access for a guest visiting our office tomorrow?");
assert(esc02.should_escalate === false, 'REQ-02: No escalation needed');

// Password reset: no escalation
const esc03 = evaluateEscalation('password_reset', res03, "I'm locked out of my account, tried my password 6 times.");
assert(esc03.should_escalate === false, 'REQ-03: No escalation needed');

// ============================================================
//  SOURCE CITATION TESTS
// ============================================================
section('Source Citations');

assert(res03.sources.some(s => s.id === 'KB-01'), 'Password reset cites KB-01');
assert(res02.sources.some(s => s.id === 'KB-07'), 'Guest Wi-Fi cites KB-07');
assert(res05.sources.some(s => s.id === 'KB-02'), 'VPN expired cites KB-02');
assert(res08.sources.some(s => s.id === 'KB-09'), 'Phishing cites KB-09');
assert(res06.sources.some(s => s.id === 'KB-05'), 'Printer issue cites KB-05');

// ============================================================
//  SUMMARY
// ============================================================
console.log('\n═══════════════════════════════════════');
console.log(`  Results: ${passed}/${total} passed, ${failed} failed`);
console.log('═══════════════════════════════════════\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('  🎉 All tests passed!\n');
  process.exit(0);
}
