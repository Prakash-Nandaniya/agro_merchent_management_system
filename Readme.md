# Karma Trading

**Karma Trading** is a custom-built, automated billing and digital ledger platform engineered specifically for local agricultural farmer-merchants.

- 🔗 **Live Site:** [https://www.karmatrading.org](https://www.karmatrading.org)
- 🔗 **GutHub   :** [Karma Trading](https://github.com/Prakash-Nandaniya/agro_merchent_management_system)


---

## 1. The Core Purpose

In the fast-paced local agro-trading environment, merchants traditionally rely on slow, manual paper ledgers. Karma Trading digitizes that entire workflow, allowing merchants to instantly generate professional invoices, maintain an immutable record of all transactions, and manage their daily commercial operations from a single, high-performance web dashboard.

---

## 2. Core Features & Capabilities

The application is designed to handle the complete lifecycle of a merchant's billing process:

- **Instant Invoice Generation** — Merchants can quickly draft and finalize commercial bills. Once a bill is generated, the system creates a formatted PDF that can be instantly downloaded, sent directly to clients, or printed on the spot.
- **The Digital Billbook** — All generated invoices are automatically saved and organized into a central "Billbook" (a digital ledger), completely replacing the need for physical record-keeping.
- **Advanced Search & Filtering** — Users can apply strict search filters to their Billbook to instantly locate past transactions based on specific dates, client names, or invoice amounts.
- **Billbook PDF Export** — For tax purposes, auditing, or physical archiving, merchants can download their entire filtered Billbook as a single, comprehensive PDF report.
- **Smart Profile Configuration** — To speed up the checkout process, merchants can configure their custom profile settings within the app. The system uses these settings to automatically autofill repetitive invoice fields (like merchant name, address, and contact info) on every new bill.

---

## 3. Tech Stack

The platform is built on a modern, decoupled full-stack architecture designed for speed and reliability:

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite, deployed on Vercel's global edge network |
| **Backend** | FastAPI (asynchronous Python framework) |
| **Database** | PostgreSQL, hosted on Supabase |
| **Containerization** | Docker |
| **Hosting (Backend)** | Google Cloud Platform (GCP) VM Instance |
| **DNS / Reverse Proxy / Security** | Cloudflare |

- **Frontend (User Interface):** Built with React and optimized with Vite for incredibly fast load times. Deployed on Vercel's global edge network.
- **Backend (API Engine):** Powered by FastAPI, an asynchronous Python framework that easily handles concurrent requests and the heavy processing required for instant PDF generation.
- **Database:** All transaction histories, bill records, and user configurations are securely stored in a highly relational PostgreSQL database hosted on Supabase.

---

## 4. Deployment Architecture & Security

The production environment is heavily secured and engineered to protect sensitive financial data using enterprise-grade networking routing:

- **Containerized Hosting** — The FastAPI backend is containerized using Docker and deployed on a secure Google Cloud Platform (GCP) Virtual Machine (VM) instance.
- **Strict HTTPS & Reverse Proxy** — Cloudflare acts as the authoritative DNS provider and reverse proxy. It sits in front of the application, ensuring that all traffic is strictly forced over secure HTTPS encryption, blocking any unencrypted connections.
- **Cloudflare Tunnels for Secure Backend Access** — Instead of opening public ports on the GCP Virtual Machine, the system utilizes Cloudflare Tunnels. This creates a secure, outbound-only connection from the GCP server directly to Cloudflare's network, completely shielding the backend API from the public internet, ensuring that only authenticated, proxied traffic can ever reach the server.

### Architecture Overview

```
┌──────────────┐        ┌────────────────────┐        ┌─────────────────────────┐
│   Merchant   │ HTTPS  │      Cloudflare    │ Tunnel │      GCP VM Instance    │
│  (Browser)   │───────▶│ DNS + Reverse Proxy│───────▶│ Docker → FastAPI Backend│
└────────┬─────┘        └────────────────────┘        └─────────────┬───────────┘
         |                                                          │
    ┌────────────────────┐                                          |
    │  React + Vite (UI) │                                          |
    │  Hosted on Vercel  │                                      PostgreSQL
    └────────────────────┘                                      (Supabase)
```

---
