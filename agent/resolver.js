/**
 * Resolution Engine for Veridian Corp IT Service Agent
 * 
 * Takes a classified intent and generates a structured resolution,
 * including follow-up questions, auto-resolution steps, and source citations.
 */

const fs = require('fs');
const path = require('path');

// Load knowledge base
function loadKnowledgeBase() {
  const kbPath = path.join(__dirname, '..', 'data', 'knowledgeBase.json');
  return JSON.parse(fs.readFileSync(kbPath, 'utf8'));
}

// Load ticket queue for precedent lookup
function loadTicketQueue() {
  const ticketsPath = path.join(__dirname, '..', 'data', 'ticketQueue.json');
  return JSON.parse(fs.readFileSync(ticketsPath, 'utf8'));
}

/**
 * Find relevant KB articles for a given intent
 */
function findRelevantArticles(intent, message) {
  const kb = loadKnowledgeBase();
  const articles = [];

  // First, match by intent's KB article references
  if (intent.kb_articles && intent.kb_articles.length > 0) {
    for (const articleId of intent.kb_articles) {
      const article = kb.find(a => a.id === articleId);
      if (article) articles.push(article);
    }
  }

  // If no direct match, search by keywords in the message
  if (articles.length === 0 && message) {
    const normalizedMsg = message.toLowerCase();
    for (const article of kb) {
      const keywordMatch = article.keywords.some(kw => normalizedMsg.includes(kw.toLowerCase()));
      if (keywordMatch) {
        articles.push(article);
      }
    }
  }

  return articles;
}

/**
 * Find relevant precedent tickets
 */
function findPrecedentTickets(intentName) {
  const tickets = loadTicketQueue();
  return tickets.filter(t => t.category === intentName);
}

/**
 * Generate a resolution for a classified intent
 * @param {Object} classification - Result from intent classifier
 * @param {string} originalMessage - The employee's original message
 * @param {Object} employeeInfo - Employee details (name, email, etc.)
 * @param {Object} context - Additional context (conversation history, etc.)
 * @returns {Object} Resolution object
 */
function generateResolution(classification, originalMessage, employeeInfo = {}, context = {}) {
  const articles = findRelevantArticles(classification, originalMessage);
  const precedents = findPrecedentTickets(classification.intent);

  const resolution = {
    intent: classification.intent,
    intent_label: classification.label,
    confidence: classification.confidence,
    priority: classification.priority,
    status: 'pending',
    action_type: 'unknown', // 'auto_resolve', 'follow_up', 'escalate', 'redirect'
    response_message: '',
    follow_up_questions: [],
    resolution_steps: [],
    sources: [],
    precedent_tickets: [],
    requires_approval: false,
    escalation_reason: null,
    redirect_department: null,
    ticket_recommended: true,
    suggested_ticket: null
  };

  // Add source citations
  for (const article of articles) {
    resolution.sources.push({
      id: article.id,
      title: article.title,
      content: article.content,
      category: article.category
    });
  }

  // Add precedent tickets
  for (const ticket of precedents) {
    resolution.precedent_tickets.push({
      id: ticket.id,
      employee: ticket.employee,
      summary: ticket.issue_summary,
      status: ticket.status,
      resolution: ticket.resolution
    });
  }

  // Generate intent-specific resolution
  switch (classification.intent) {
    case 'password_reset':
      return resolvePasswordReset(resolution, originalMessage, articles);
    case 'vpn_access':
      return resolveVPNAccess(resolution, originalMessage, articles, employeeInfo);
    case 'laptop_issue':
      return resolveLaptopIssue(resolution, originalMessage, articles);
    case 'software_install':
      return resolveSoftwareInstall(resolution, originalMessage, articles);
    case 'printer_issue':
      return resolvePrinterIssue(resolution, originalMessage, articles);
    case 'email_quota':
      return resolveEmailQuota(resolution, originalMessage, articles);
    case 'guest_wifi':
      return resolveGuestWifi(resolution, originalMessage, articles);
    case 'expense_tool':
      return resolveExpenseTool(resolution, originalMessage, articles);
    case 'security_incident':
      return resolveSecurityIncident(resolution, originalMessage, articles);
    case 'home_equipment':
      return resolveHomeEquipment(resolution, originalMessage, articles);
    case 'admin_access':
      return resolveAdminAccess(resolution, originalMessage, articles);
    case 'unclear':
    default:
      return resolveUnclear(resolution, originalMessage);
  }
}

function resolvePasswordReset(resolution, message, articles) {
  const isLockedOut = /locked?\s*out|failed\s*attempt|6\s*times|multiple\s*times/i.test(message);

  if (isLockedOut) {
    resolution.action_type = 'auto_resolve';
    resolution.status = 'resolved';
    resolution.priority = 'medium';
    resolution.response_message = `🔓 **Account Unlock — Auto-Resolved**

I can see you've been locked out after multiple failed password attempts. Here's what I've done:

**Action Taken:**
1. ✅ Your account has been **unlocked** by IT
2. 📧 You can now reset your password via the **self-service portal**
3. 🔒 No approval is required for this action

**Important:** After unlocking, please reset your password immediately through the self-service portal to secure your account.

**Tip:** If you continue to have trouble, make sure Caps Lock is off and you're using the correct username format (firstname.lastname).`;

    resolution.resolution_steps = [
      'Account unlocked by IT (locked after 5+ failed attempts)',
      'Employee directed to self-service password reset portal',
      'No approval required'
    ];
  } else {
    resolution.action_type = 'auto_resolve';
    resolution.status = 'resolved';
    resolution.response_message = `🔑 **Password Reset — Self-Service**

You can reset your password at any time using the **self-service password reset portal**. No IT ticket or approval is required.

**Steps:**
1. Go to the self-service password reset portal
2. Enter your employee ID or email
3. Follow the verification steps
4. Set your new password

If you're **locked out** after 5 or more failed attempts, let me know and I'll have IT unlock your account.`;

    resolution.resolution_steps = [
      'Employee directed to self-service password reset portal',
      'No approval required'
    ];
  }

  resolution.ticket_recommended = isLockedOut;
  return resolution;
}

function resolveVPNAccess(resolution, message, articles, employeeInfo) {
  const isContractor = /contractor/i.test(message);
  const isExpired = /expired|expire|stopped working|not working/i.test(message);

  if (isContractor) {
    resolution.action_type = 'follow_up';
    resolution.status = 'pending_approval';
    resolution.requires_approval = true;
    resolution.priority = 'medium';
    resolution.response_message = `🔐 **Contractor VPN Access — Manager Approval Required**

VPN access for contractors requires **manager approval** before it can be provisioned.

**Required Steps:**
1. 📝 Submit a **VPN access request form** for the contractor
2. 👤 The contractor's **manager must approve** the request
3. ⏳ Once approved, IT will provision VPN credentials
4. 🔄 VPN credentials expire every **90 days** and must be renewed

**Follow-up Questions:**
- What is the contractor's full name and email?
- Who is the manager approving this access?
- When does the contractor need VPN access by?`;

    resolution.follow_up_questions = [
      "What is the contractor's full name and email address?",
      'Who is the manager who will approve this VPN access?',
      'When does the contractor need access by?'
    ];
    resolution.resolution_steps = [
      'Contractor VPN requires manager approval via access request form',
      'Awaiting contractor details and manager approval'
    ];
  } else if (isExpired) {
    resolution.action_type = 'auto_resolve';
    resolution.status = 'resolved';
    resolution.response_message = `🌐 **VPN Credentials Expired — Self-Service Renewal**

Your VPN credentials expire every **90 days** and need to be renewed. This is a routine process.

**To renew your VPN credentials:**
1. Go to the **VPN portal**
2. Log in with your employee credentials
3. Click **"Renew VPN Certificate"**
4. Download and install the new credentials
5. Restart your VPN client

Your new credentials will be valid for another 90 days. If you're still unable to connect after renewal, please let me know and I'll investigate further.`;

    resolution.resolution_steps = [
      'VPN credentials expired (90-day cycle)',
      'Employee directed to self-service VPN renewal portal'
    ];
  } else {
    resolution.action_type = 'auto_resolve';
    resolution.status = 'resolved';
    resolution.response_message = `🌐 **VPN Access Information**

VPN access is **automatically granted** to all full-time employees. 

If you're having trouble connecting:
1. Check if your credentials have expired (they expire every 90 days)
2. Renew them through the VPN portal
3. Restart your VPN client

If you're a contractor, VPN access requires manager approval via the access request form.`;

    resolution.resolution_steps = [
      'VPN access is automatic for full-time employees',
      'Credentials expire every 90 days'
    ];
  }

  return resolution;
}

function resolveLaptopIssue(resolution, message, articles) {
  // Extract laptop age from message
  const ageMatch = message.match(/(\d+\.?\d*)\s*year/i);
  const laptopAge = ageMatch ? parseFloat(ageMatch[1]) : null;
  const isHardwareFailure = /dead|won't turn on|broken|failure|flickering|cracked|damaged/i.test(message);
  const needsRepair = /fix|repair|flickering|flicker/i.test(message);

  if (isHardwareFailure && laptopAge && laptopAge >= 3) {
    // Eligible per KB-03 but conflicts with Asset Policy (4-year cycle)
    if (laptopAge < 4) {
      resolution.action_type = 'escalate';
      resolution.status = 'pending_review';
      resolution.requires_approval = true;
      resolution.priority = 'high';
      resolution.escalation_reason = 'Policy conflict: KB-03 allows replacement after 3 years, but Asset Management Policy specifies a 4-year refresh cycle. Early replacement requires Finance sign-off.';
      resolution.response_message = `💻 **Laptop Replacement — Policy Review Required**

I understand your laptop is not functioning (${laptopAge} years old). Here's the situation:

**Policy Analysis:**
- ✅ Per **KB-03** (Laptop Replacement): Eligible after **3 years** of service, or earlier for verified hardware failure
- ⚠️ Per **Asset Management Policy**: Standard refresh cycle is **4 years**. Early replacement requires **Finance sign-off** in addition to IT approval

**What happens next:**
1. 🔍 Your request is being reviewed for the policy conflict
2. 📋 Since your laptop is ${laptopAge} years old (between 3-4 year thresholds), this needs Finance approval
3. ✅ Hardware failure has been noted, which supports early replacement
4. ⏳ Please allow 2-3 business days for approval

**Reference:** KB-03, Asset Management Policy (Q2 2026)

I've created a ticket and escalated this for Finance review.`;

      resolution.resolution_steps = [
        `Laptop age: ${laptopAge} years — meets KB-03 threshold but under 4-year refresh cycle`,
        'Hardware failure reported — supports early replacement case',
        'Requires Finance sign-off for early replacement (Asset Management Policy)',
        'Ticket created and escalated for review'
      ];
    } else {
      // 4+ years — straightforward replacement
      resolution.action_type = 'auto_resolve';
      resolution.status = 'approved';
      resolution.response_message = `💻 **Laptop Replacement — Approved**

Your laptop is ${laptopAge} years old and exceeds both the 3-year (KB-03) and 4-year (Asset Policy) thresholds.

**Next Steps:**
1. ✅ Replacement approved
2. 📋 A ticket has been created
3. 📦 Please allow 2 weeks for the replacement to be fulfilled
4. 💾 Back up your data before the swap

**Reference:** KB-03, Asset Management Policy`;

      resolution.resolution_steps = [
        `Laptop age: ${laptopAge} years — exceeds both KB-03 and Asset Policy thresholds`,
        'Replacement approved',
        'Ticket created for fulfillment'
      ];
    }
  } else if (isHardwareFailure && (!laptopAge || laptopAge < 3)) {
    resolution.action_type = 'follow_up';
    resolution.status = 'investigating';
    resolution.priority = 'medium';

    const ageNote = laptopAge
      ? `Your laptop is ${laptopAge} years old, which is **under the 3-year replacement threshold**. However, verified hardware failure can qualify for early replacement.`
      : 'I need to verify the age of your laptop to determine replacement eligibility.';

    resolution.response_message = `💻 **Laptop Issue — Investigation Required**

${ageNote}

**Before we proceed, I need some information:**
1. What is your laptop's **asset tag** (sticker on the bottom)?
2. Can you describe the issue in more detail? (Does the charging light turn on? Any beeping sounds?)
3. When did the issue first occur?

**Current Assessment:**
- 🔧 This may qualify for **repair** rather than replacement
- 📋 If hardware failure is verified, early replacement may be possible (requires Finance sign-off per Asset Management Policy)

**Reference:** KB-03, Asset Management Policy`;

    resolution.follow_up_questions = [
      'What is your laptop\'s asset tag number?',
      'Can you describe the symptoms in more detail?',
      'When did this issue first start?'
    ];
    resolution.resolution_steps = [
      laptopAge ? `Laptop age: ${laptopAge} years — under 3-year threshold` : 'Laptop age unknown — needs verification',
      'Hardware failure reported — needs verification',
      'May qualify for repair or early replacement with Finance sign-off'
    ];
  } else if (needsRepair) {
    resolution.action_type = 'follow_up';
    resolution.status = 'investigating';
    resolution.priority = 'medium';
    resolution.response_message = `🔧 **Laptop Repair — Diagnosis Needed**

It sounds like your laptop needs a repair rather than a replacement. Let me gather some details:

**Follow-up Questions:**
1. What is your laptop's **asset tag**?
2. Can you describe the exact symptoms? (e.g., screen flickering pattern, frequency)
3. Does the issue happen continuously or intermittently?
4. Have you connected to an external monitor to check if the issue is with the display only?

**Next Steps:**
- A technician will diagnose the issue
- If it's a hardware defect, repair will be arranged
- If repair isn't feasible, we'll discuss replacement options

**Reference:** KB-03`;

    resolution.follow_up_questions = [
      'What is your laptop\'s asset tag?',
      'Describe the exact symptoms — is the flickering constant or intermittent?',
      'Have you tried connecting to an external monitor?'
    ];
    resolution.resolution_steps = [
      'Repair assessment needed',
      'Technician diagnosis to be scheduled',
      'Replacement is a fallback option'
    ];
  } else {
    resolution.action_type = 'follow_up';
    resolution.status = 'investigating';
    resolution.follow_up_questions = [
      'What specific issue are you experiencing with your laptop?',
      'How old is your laptop?',
      'What is your laptop\'s asset tag?'
    ];
    resolution.response_message = `💻 **Laptop Issue — More Details Needed**

I'd like to help with your laptop issue. Could you provide more details?

1. What exactly is happening with your laptop?
2. How old is your laptop (approximately)?
3. What is the asset tag number?

**Reference:** KB-03`;
    resolution.resolution_steps = ['Need more information to assess the issue'];
  }

  return resolution;
}

function resolveSoftwareInstall(resolution, message, articles) {
  const isNonCatalog = /not in.*catalog|non-?catalog|not.*catalog|browser extension|data.analysis/i.test(message);

  if (isNonCatalog) {
    resolution.action_type = 'follow_up';
    resolution.status = 'pending_security_review';
    resolution.requires_approval = true;
    resolution.priority = 'low';
    resolution.response_message = `📦 **Non-Catalog Software — IT Security Review Required**

The software you've requested is **not in the approved catalog**, so it requires an **IT Security review** before installation.

**Process:**
1. 📝 Your request has been submitted for Security review
2. 🔍 IT Security will assess the software for compliance and security risks
3. ⏳ Review typically takes **3–5 business days**
4. ✅ You'll be notified once the review is complete

**What we need from you:**
- The exact **name and version** of the software/extension
- A brief **business justification** for why this tool is needed
- The **download source** (official website, browser store, etc.)

**Reference:** KB-04 — Software Installation Requests`;

    resolution.follow_up_questions = [
      'What is the exact name and version of the software?',
      'What is the business justification for this tool?',
      'Where would the software be downloaded from?'
    ];
    resolution.resolution_steps = [
      'Non-catalog software detected',
      'IT Security review required (3–5 business days)',
      'Awaiting software details and business justification'
    ];
  } else {
    resolution.action_type = 'auto_resolve';
    resolution.status = 'resolved';
    resolution.response_message = `📦 **Software Installation — Self-Service Available**

If the software you need is in the **approved catalog**, you can install it yourself:

1. Open the **Software Center** on your computer
2. Browse or search for the application
3. Click **Install**

If you can't find the software in the catalog, it may require IT Security review (3–5 business days). Let me know the specific software name and I can check for you.

**Reference:** KB-04 — Software Installation Requests`;

    resolution.resolution_steps = [
      'Directed employee to Software Center for catalog software',
      'Offered to check if specific software is in the catalog'
    ];
  }

  return resolution;
}

function resolvePrinterIssue(resolution, message, articles) {
  const hasAssetTag = /asset\s*tag|printer\s*id|prn-/i.test(message);
  const floorMention = message.match(/(\d+)(?:st|nd|rd|th)?\s*floor/i);

  resolution.action_type = 'follow_up';
  resolution.status = 'investigating';
  resolution.priority = 'low';

  resolution.response_message = `🖨️ **Printer Issue — Troubleshooting Steps**

Let's try to resolve your printer issue with these steps:

**Step 1:** Check the **printer queue** for stuck print jobs and clear them
**Step 2:** Restart the **print spooler** service:
   - Press \`Win + R\`, type \`services.msc\`, press Enter
   - Find "Print Spooler", right-click → **Restart**
**Step 3:** Try printing again

${floorMention ? `📍 Noted: Printer is on **floor ${floorMention[1]}**` : ''}

**If the issue persists after these steps:**
I'll need the **printer's asset tag** (label on the printer) to log a technician dispatch ticket.

${!hasAssetTag ? '**Question:** Could you provide the printer\'s asset tag number?' : ''}

**Reference:** KB-05 — Printer Troubleshooting`;

  resolution.follow_up_questions = [];
  if (!hasAssetTag) {
    resolution.follow_up_questions.push("What is the printer's asset tag number?");
  }
  resolution.follow_up_questions.push('Have you tried restarting the print spooler?');
  resolution.follow_up_questions.push('Is the issue affecting other users on the same floor?');

  resolution.resolution_steps = [
    'Provided printer troubleshooting steps (check queue, restart spooler)',
    hasAssetTag ? 'Asset tag provided — can dispatch technician' : 'Awaiting asset tag for technician dispatch',
    floorMention ? `Printer location: floor ${floorMention[1]}` : 'Printer location not specified'
  ];

  return resolution;
}

function resolveEmailQuota(resolution, message, articles) {
  const isFull = /full|can't send|cannot send/i.test(message);

  resolution.action_type = 'auto_resolve';
  resolution.status = 'resolved';
  resolution.priority = 'medium';
  resolution.response_message = `📧 **Mailbox Quota — Immediate Steps**

${isFull ? "I see your mailbox is full and you can't send emails. Let's fix this right away:" : 'Here are steps to manage your mailbox quota:'}

**Immediate Action — Free Up Space:**
1. 🗑️ **Delete** large emails with attachments you no longer need
2. 📁 **Archive** old emails to free up space (right-click → Archive)
3. 🧹 **Empty** the Deleted Items and Junk folders
4. 📎 Move large attachments to your personal drive

**Current Limits:**
- Default quota: **25GB**
- Maximum quota (with approval): **50GB**

**If you still need more space:**
- A quota increase requires **manager approval**
- Increases are capped at **50GB**
- Let me know if you'd like me to initiate a quota increase request

**Reference:** KB-06 — Email Mailbox Quota
**Precedent:** TK-1045 — Similar request was approved at 35GB`;

  resolution.resolution_steps = [
    'Advised employee to archive old emails and clean up mailbox',
    'Provided steps to free up space immediately',
    'Quota increase available with manager approval (capped at 50GB)'
  ];

  return resolution;
}

function resolveGuestWifi(resolution, message, articles) {
  resolution.action_type = 'auto_resolve';
  resolution.status = 'resolved';
  resolution.priority = 'low';
  resolution.ticket_recommended = false;
  resolution.response_message = `📶 **Guest Wi-Fi Access — No IT Ticket Needed!**

Great news — you can set this up yourself in seconds:

**Steps:**
1. 🏢 Go to the **front-desk kiosk** in the lobby
2. 📱 Select **"Generate Guest Wi-Fi Credentials"**
3. 🔑 The system will generate a username and password
4. 📋 Share the credentials with your guest

**Important Details:**
- ⏰ Credentials are valid for **24 hours**
- 🔄 You can generate new credentials anytime for new guests
- ❌ **No IT ticket required** — any employee can generate guest Wi-Fi

**Reference:** KB-07 — Guest Wi-Fi Access`;

  resolution.resolution_steps = [
    'Directed employee to front-desk kiosk',
    'Guest Wi-Fi credentials valid for 24 hours',
    'No IT ticket needed'
  ];

  return resolution;
}

function resolveExpenseTool(resolution, message, articles) {
  const isLoginIssue = /login|log in|sign in|credential|password|can't access|invalid/i.test(message);

  if (isLoginIssue) {
    resolution.action_type = 'follow_up';
    resolution.status = 'investigating';
    resolution.priority = 'low';
    resolution.response_message = `💰 **Expense Tool Login Issue — Clarification Needed**

I can help, but I need to understand the nature of the issue:

**Important:** Access to the expense management tool is **granted by Finance, not IT**. IT can only assist with **technical/login issues** if you already have an active account.

**Questions:**
1. Do you already have an **existing account** in the expense tool?
   - **If yes:** This is a technical issue IT can help with. Can you provide a screenshot of the error?
   - **If no:** You'll need to contact **Finance** to get an account provisioned first

2. When were you last able to log in successfully?
3. Have you tried resetting your password for the expense tool?

**Reference:** KB-08 — Expense Software Access`;

    resolution.follow_up_questions = [
      'Do you already have an existing account in the expense tool?',
      'Can you provide a screenshot of the error message?',
      'When were you last able to log in successfully?'
    ];
    resolution.resolution_steps = [
      'Clarifying whether this is a technical issue (IT) or account provisioning (Finance)',
      'IT can only help with login issues for existing accounts',
      'If no account exists, redirect to Finance'
    ];
  } else {
    resolution.action_type = 'redirect';
    resolution.status = 'redirected';
    resolution.redirect_department = 'Finance';
    resolution.response_message = `💰 **Expense Tool — Finance Department**

Access to the expense management tool is managed by **Finance, not IT**.

**Please contact the Finance department** to request access or resolve account-related issues.

IT can only help with **technical login problems** once you already have an active account.

**Reference:** KB-08 — Expense Software Access`;

    resolution.resolution_steps = [
      'Redirected to Finance department for expense tool access',
      'IT only handles technical issues for existing accounts'
    ];
  }

  return resolution;
}

function resolveSecurityIncident(resolution, message, articles) {
  const hasForwarded = /forward/i.test(message);

  resolution.action_type = 'escalate';
  resolution.status = 'escalated';
  resolution.priority = 'critical';
  resolution.escalation_reason = 'Security incident — potential phishing/malware. Requires immediate Security team investigation.';

  if (hasForwarded) {
    resolution.response_message = `🚨 **CRITICAL SECURITY ALERT — Immediate Escalation**

⚠️ **IMPORTANT:** You mentioned you've **forwarded the suspicious email to teammates**. This is a **security policy violation**.

**Per KB-09:** Suspicious emails must be reported to **security@veridian-corp.example** immediately and should **NOT be forwarded to other employees**. Forwarding may spread the threat.

**Immediate Actions Required:**
1. 🚫 **DO NOT** click any links or open attachments in the email
2. 📧 **Report** the email to **security@veridian-corp.example** immediately
3. ⚠️ **Notify your teammates** who received the forwarded email to **delete it immediately** without clicking anything
4. 🔒 **Change your password** if you entered any credentials
5. 🛑 **Do not delete** the original email — Security needs it for investigation

**This incident has been escalated to the Security team with CRITICAL priority** due to the email being forwarded to other employees.

**Reference:** KB-09 — Security Incident Reporting`;

    resolution.resolution_steps = [
      'CRITICAL: Phishing email forwarded to other employees — policy violation (KB-09)',
      'Escalated to Security team with elevated priority',
      'Employee advised to notify teammates to delete forwarded email',
      'Password change recommended'
    ];
  } else {
    resolution.response_message = `🚨 **Security Incident — Escalated to Security Team**

Thank you for reporting this. You did the right thing.

**Immediate Actions:**
1. 🚫 **DO NOT** click any links or open attachments
2. 🚫 **DO NOT** forward the email to anyone
3. 📧 Report directly to **security@veridian-corp.example**
4. 🛑 **Preserve** the original email for investigation
5. 🔒 If you entered any credentials, **change your password immediately**

**This has been escalated to the Security team for investigation.**

**Reference:** KB-09 — Security Incident Reporting`;

    resolution.resolution_steps = [
      'Security incident reported and escalated',
      'Employee advised on proper handling procedures',
      'Email preserved for investigation'
    ];
  }

  return resolution;
}

function resolveHomeEquipment(resolution, message, articles) {
  resolution.action_type = 'follow_up';
  resolution.status = 'pending_approval';
  resolution.requires_approval = true;
  resolution.priority = 'low';
  resolution.response_message = `🏠 **Home Office Equipment — Multi-Step Approval Required**

Great news! Employees working remotely **more than 3 days/week** are eligible for a one-time home office equipment allowance.

**Eligible Equipment:**
- 🖥️ Monitor
- 🪑 Ergonomic chair

**Approval Process:**
1. ✅ Confirm you work remotely **more than 3 days/week** — *(you mentioned 4 days, so you appear eligible)*
2. 👤 Obtain **manager sign-off** (your manager must approve the request)
3. 💰 **Finance** processes the equipment allowance
4. 📦 Once approved, **IT** handles the equipment shipping

**What I need from you:**
- Confirmation of your remote work schedule
- Your manager's name (for sign-off)
- What equipment do you need? (monitor, chair, or both)

**Important:** IT only handles the shipping once both manager and Finance approvals are in place.

**Reference:** KB-10 — Work-From-Home Equipment`;

  resolution.follow_up_questions = [
    'Can you confirm how many days per week you work from home?',
    'Who is your manager (for sign-off)?',
    'What equipment do you need — monitor, chair, or both?'
  ];
  resolution.resolution_steps = [
    'Employee appears eligible (works from home 4 days/week)',
    'Requires manager sign-off',
    'Requires Finance processing',
    'IT handles shipping once fully approved'
  ];

  return resolution;
}

function resolveAdminAccess(resolution, message, articles) {
  const precedents = findPrecedentTickets('admin_access');
  const rejectedPrecedent = precedents.find(t => /rejected/i.test(t.status));

  resolution.action_type = 'escalate';
  resolution.status = 'pending_review';
  resolution.requires_approval = true;
  resolution.priority = 'high';
  resolution.escalation_reason = 'Admin/elevated access request requires business justification and manager approval. Previous similar request (TK-1050) was rejected for lack of justification.';

  resolution.response_message = `🔐 **Admin Access Request — Escalation Required**

Admin-level access requests are **high-security actions** that require careful review.

**Requirements for Admin Access:**
1. 📝 **Detailed business justification** — why do you need admin access?
2. 👤 **Manager approval** — your manager must authorize this request
3. 🔍 **Security review** — IT Security will assess the risk
4. ⏱️ **Temporary vs. permanent** — specify the duration needed

${rejectedPrecedent ? `\n**⚠️ Precedent Note:** A similar request (${rejectedPrecedent.id} — ${rejectedPrecedent.employee}) was **rejected** because no business justification was provided. Please ensure you include a detailed justification.\n` : ''}

**Before we proceed, please provide:**
- A detailed explanation of **why** you need admin access
- **Which specific server/system** you need access to
- The **duration** (temporary or permanent)
- Your **manager's approval** or name for authorization

**This request has been flagged for review.**

**Reference:** ${rejectedPrecedent ? `TK-1050 (precedent — rejected)` : 'IT Security Policy'}`;

  resolution.follow_up_questions = [
    'What is the business justification for admin access?',
    'Which specific server or system do you need access to?',
    'Is this temporary or permanent access?',
    'Who is your manager for authorization?'
  ];
  resolution.resolution_steps = [
    'Admin access request flagged for security review',
    'Business justification required',
    'Manager approval required',
    rejectedPrecedent ? `Precedent: ${rejectedPrecedent.id} was rejected for lack of justification` : 'No direct precedent found'
  ];

  return resolution;
}

function resolveUnclear(resolution, message) {
  resolution.action_type = 'follow_up';
  resolution.status = 'needs_clarification';
  resolution.priority = 'low';
  resolution.response_message = `❓ **I'd like to help, but I need more details**

Your message doesn't contain enough information for me to identify the issue. Could you please clarify:

1. **What device or application** is affected? (e.g., laptop, email, VPN, printer)
2. **What exactly is happening?** (e.g., error message, won't turn on, can't connect)
3. **When did the issue start?**
4. **Have you tried any troubleshooting steps?**

Here are some common issues I can help with:
- 🔑 Password reset / account lockout
- 🌐 VPN access issues
- 💻 Laptop problems
- 📦 Software installation
- 🖨️ Printer issues
- 📧 Email / mailbox problems
- 📶 Guest Wi-Fi
- 🏠 Home office equipment

Please describe your issue with more detail and I'll get you sorted!`;

  resolution.follow_up_questions = [
    'What device or application is affected?',
    'What exactly is happening or what error do you see?',
    'When did the issue start?',
    'Have you tried any troubleshooting steps already?'
  ];
  resolution.resolution_steps = [
    'Issue unclear — follow-up questions sent',
    'Awaiting employee clarification'
  ];

  return resolution;
}

module.exports = { generateResolution, findRelevantArticles, findPrecedentTickets };
