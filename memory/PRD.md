# DPDP Shield - PRD

## Original Problem Statement
Build DPDP Shield - an incident-response command center web app for Indian SMEs with: admin auth, command center dashboard, war room with 72h countdown, evidence locker, mailbox with Gmail IMAP/SMTP, attack vector analysis, settings, reports tracking, PDF generation, and CSV logging.

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui (dark theme SaaS dashboard)
- **Backend**: FastAPI (Python) with CSV-first storage + MongoDB for state
- **Database**: MongoDB for breach state, settings, OTP storage; CSV files for customers, mail_replies, admin_access, reports_sent
- **Email**: Gmail IMAP/SMTP integration
- **PDF**: ReportLab server-side generation

## User Personas
- **Admin/DPO**: Primary user managing DPDP compliance and incident response
- **Compliance Officer**: Read-only access to audit reports
- **IT Operations**: Logs access + containment actions

## Core Requirements (Static)
- Admin authentication with CSV logging
- 30+ preloaded customer records (Indian names)
- Breach workflow: trigger → contain → notify DPB → notify users → close
- OTP verification via email for data requests (SHOW/DELETE/CORRECT)
- 7 PDF report types with CSV logging
- Attack vector identification (API vs Email)
- Dark/light theme toggle

## What's Been Implemented (Feb 21, 2026)
- Full backend with 22+ API endpoints (100% tested)
- Login page with hardcoded admin credentials
- Command Center with health monitor, panic button, readiness checklist
- War Room with 72h countdown timer, stepper workflow, action cards
- Evidence Locker with timeline, encryption proof toggle, audit report download
- Mailbox with Gmail integration, email processing, OTP verification flow
- Attack Vector analysis with API/Email security cards and scoring
- Settings with integration toggles, roles, simulation controls, theme toggle
- Reports Sent table with filters
- Customers page with CRUD, search, export
- 7 PDF types: DPB Notice, Customer Breach Notice, Audit Report, Data Export, Deletion Certificate, Correction Confirmation, Vector Analysis
- CSV files: customers.csv, mail_replies.csv, admin_access.csv, reports_sent.csv

## Prioritized Backlog
### P0 (Critical)
- None remaining

### P1 (Important)
- Gmail App Password setup (current password may not work with IMAP if 2FA enabled)
- LLM-powered free-text correction parsing (Emergent LLM key available)
- Customer CSV import from UI

### P2 (Nice to Have)
- Real-time breach notification sound effects
- Evidence file upload to Evidence Locker
- SMS/WhatsApp actual integration for breach notifications
- More detailed traffic charts (Recharts)
- PDF SHA256 hash display in reports table

## Next Tasks
1. Verify Gmail IMAP/SMTP with proper App Password
2. Add LLM-powered free-text parsing for CORRECT requests
3. Add CSV import functionality for customers
4. Add evidence file upload
5. Add Recharts-based traffic visualization
