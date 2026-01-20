# Guincoin Rewards Program — Cursor AI Prompt

## Role

You are acting as a **Product Architect + Systems Designer**.

Your task is to **evolve Guinco’s existing employee rewards program (“Guincoin Program”)** into a **self-service, intuitive, account-based system** with **manager allotments, peer-to-peer transfers, and a wellness rewards workflow**.

The system must work today using **Google Forms + Google Sheets**, and be designed to migrate later to an internal platform.

---

## Core Design Principles (Mandatory)

### 1. Bank-Account Mental Model
- Every employee has a balance
- Every transaction is logged
- Pending vs posted transactions are visible
- Full audit trail for all activity

### 2. Self-Service First
- Managers distribute coins without HR involvement
- Employees submit wellness tasks themselves
- Back office staff only verifies documents (no manual calculations)

### 3. Mobile-First
- Designed for employees working in the field
- Minimal friction
- No PDFs except where medically required

---

## Context

- Employee identity is based on **Google Workspace email**
- Current tools:
  - Google Forms
  - Google Sheets
- Workforce includes field technicians and office staff
- Leadership priorities:
  - Engagement
  - Peer recognition
  - Manager empowerment
  - Budget enforcement
  - Auditability
  - Minimal administrative overhead

---

## Source Material (Must Be Used)

You must review and build from:
1. **Guincoin Employee Tracker** (balances & history)
2. **Guincoin Recognition Form responses**
3. **Guinco Wellness Program meeting transcript**

Use these to infer:
- Existing workflows
- Data structures
- Budget and compliance constraints
- Pain points

---

## Functional Requirements

### 1. Manager / Supervisor Allotments

- Managers receive a **Guincoin allotment** per time period (monthly or quarterly)
- Allotments:
  - Are pre-funded
  - Automatically reset each period
  - Cannot be exceeded
- Managers can:
  - Award coins to employees by email
  - Include a recognition message
- Each award:
  - Creates a ledger transaction
  - Sends an email notification to the recipient
- All activity must be auditable

---

### 2. Peer-to-Peer Transfers

- Employees can send Guincoins to peers
- Transfers:
  - Pull from sender’s balance
  - Are capped per period to prevent abuse
  - Require a short message (kudos / recognition)
- Recipient receives:
  - Email notification
  - Updated balance
- All transfers are logged as ledger transactions

---

### 3. Wellness Task Workflow (Approval-Based)

The wellness component must support **document-verified health tasks**.

#### Wellness Task Flow

1. Employee selects a **specific wellness task**
   - Example: Annual physical, biometric screening, etc.
2. Employee downloads the task-specific form
3. Employee prints and brings the form to their **PCP / doctor**
4. Doctor completes and signs the form
5. Employee uploads the completed form back to the portal
6. System creates a **PENDING Guincoin transaction**
7. Back office staff reviews the document
8. Upon approval:
   - Task is marked **Completed**
   - Guincoins are **automatically posted** to the employee’s account
9. Employee receives an email confirmation

#### Wellness Rules

- Coins are **never posted automatically**
- All wellness rewards require approval
- Pending vs approved status must be visible to the employee
- Rejected submissions must allow resubmission
- Each task can have:
  - A fixed Guincoin value
  - A frequency rule (annual, one-time, etc.)

---

### 4. Bank-Account Experience

Employees must be able to view:
- Current balance
- Pending rewards
- Posted transactions
- Transaction source:
  - Manager award
  - Peer transfer
  - Wellness task
  - Adjustment
- Date, amount, and description for every entry

The system should feel intuitive without training.

---

## Deliverables

### 1. Program Design (Human Layer)
- How employees earn, transfer, and receive coins
- Manager vs peer behavior
- Wellness approval process
- Anti-abuse guardrails
- Real-world usage examples

---

### 2. Data Model

Design a normalized schema usable in:
- Google Sheets (immediate)
- A database (future)

Include:
- Employees
- Accounts / balances
- Ledger transactions (pending / posted)
- Manager allotments
- Wellness tasks
- Wellness submissions
- Approval status

---

### 3. Workflow Architecture

- Google Form flows for:
  - Manager awards
  - Peer-to-peer transfers
  - Wellness submissions
- File upload handling
- Approval flow for back office
- Email notification triggers

---

### 4. Governance & Controls

- Budget enforcement
- Period resets
- Wellness approval permissions
- Audit visibility for leadership without micromanagement

---

### 5. Technical Roadmap

Provide phased execution:

- **Phase 1:** Structured Google Forms + Sheets
- **Phase 2:** Dashboards & reporting visibility
- **Phase 3:** Internal system with API-driven architecture

Label all work as:
- Immediate
- Medium-term
- Long-term

---

### 6. Open Questions

List:
- Assumptions being made
- Questions requiring HR or leadership decisions before implementation

---

## Output Requirements

- Clear section headers
- Tables where appropriate
- No generic advice
- Write for review by HR, IT, and leadership

---

## Success Criteria

The system must:
- Feel intuitive like a bank account
- Allow managers and employees to self-serve
- Enforce budgets automatically
- Support wellness approvals cleanly
- Be auditable and scalable
