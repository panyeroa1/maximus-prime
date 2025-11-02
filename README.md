<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1FF7YL2UNhSZ5G3Y6yfqsQ4wN07sML25L

## Overview

Maximus Prime is an end-to-end contact-center demo built for Eburon.ai. It couples a modern React/Vite frontend with Eburon-branded AI services for voice, chat, CRM automation, and analytics.

Key components:

- **Web Demo Voice Agent:** Simulates customer calls using Bland.ai telephony alongside Eburon audio assets.
- **Workspace UI:** Manages agents, call logs, voice cloning, CRM entries, and feedback.
- **Chat Assistant:** Powered by the Eburon LLM (via Ollama Cloud) with support for transcript analysis and CRM tools.
- **IndexedDB + Supabase:** Local caching with optional Supabase sync for persistence in production.

All user-facing assets, links, and copy are Eburon-branded per `callcenter/IMPORTANT.md`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm (bundled with Node) or pnpm
- Access to the following services (credentials live in `.env.local`):
  - Supabase project for data sync
  - Bland.ai account (voice/telephony APIs)
  - Eburon LLM (Ollama Cloud) credentials
  - Gmail API (for outbound email actions)

### Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.local.example` (if available) or create `.env.local` in both the repo root and `callcenter/` directory with the required keys. At minimum set:
   ```ini
   SUPABASE_URL=...
   SUPABASE_KEY=...
   BLAND_API_KEY=...
   BLAND_ENCRYPTED_KEY=...
   OLLAMA_API_KEY=...
   OLLAMA_API_URL=...
   OLLAMA_MODEL=gpt-oss:120b-cloud
   OLLAMA_TRANSCRIBE_MODEL=whisper-large-v3
   GEMINI_API_KEY=...        # optional fallback for legacy features
   VITE_GOOGLE_CLIENT_ID=...
   VITE_GOOGLE_CLIENT_SECRET=...
   VITE_GOOGLE_REFRESH_TOKEN=...
   VITE_GOOGLE_SENDER_EMAIL=...
   ```
   > All values should come from your secure secret manager. Never commit real credentials.

3. Boot the Vite dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser. The callcenter interface should load with Eburon branding.

### Running the Callcenter Sub-App Only

If you need just the `callcenter/` workspace:
```bash
cd callcenter
npm install
npm run dev
```

---

## Environment Configuration

| Variable | Location | Description |
|----------|----------|-------------|
| `SUPABASE_URL`, `SUPABASE_KEY` | `.env.local` / CI secrets | Supabase project credentials for syncing agents, voices, call logs. |
| `BLAND_API_KEY`, `BLAND_ENCRYPTED_KEY` | `.env.local` | Bland.ai REST + telephony key pair used for outbound dialers and tool calls. |
| `OLLAMA_API_*` | `.env.local` | Credentials for the Eburon LLM hosted on Ollama Cloud (`OLLAMA_MODEL` powers chat + analysis, `OLLAMA_TRANSCRIBE_MODEL` handles audio transcription). |
| `GEMINI_API_KEY` | optional | Legacy GPT support; still referenced by some components but not required once Ollama is wired. |
| `VITE_GOOGLE_*` | `.env.local` | Gmail OAuth client ID, secret, refresh token, and sender email for the agent’s `sendEmail` tool. |
| `SUPABASE_SERVICE_ROLE` (optional) | server-only | If you add backend APIs that need elevated Supabase privileges. |

**Important:** Vite requires variables exposed to the browser to be prefixed with `VITE_`. The build step maps non-prefixed secrets (e.g., `SUPABASE_URL`) into safe `import.meta.env` keys via `callcenter/vite.config.ts`. Keep raw secrets in deployment secret stores.

---

## Services & Responsibilities

### Frontend

- **React 19 + Vite:** UI, state management, and routing.
- **IndexedDB (idbService):** Offline-first cache for agents, voices, call logs, transcripts, and feedback.
- **Supabase (services/supabaseService):** Optional online sync when credentials are present.
- **Bland.ai (services/blandAiService):** Telephony tooling, voice listing, cloning, call logs, and live agent interactions.
- **Eburon LLM via Ollama Cloud (services/ollamaService):**
  - Chat assistant (ChatbotView)
  - Microphone transcription for chat
  - Call-log transcription + sentiment analysis
- **Google Gmail API (services/emailService):** Sends confirmed emails when the AI invokes `sendEmail`.

### CRM Tools

`callcenter/crm-tools.json` ships ready-made tool definitions for Create/Lookup/Update/Close CRM endpoints. You can POST them to Bland.ai’s `/v1/tools` API or seed your own store.

### Audio Assets

All audio cues (ring, hold, busy) are bundled locally under `callcenter/assets/audio/*` to avoid broken network links.

---

## Deployment

### Build

Generate a production bundle (root or `callcenter/`):
```bash
npm run build
```
Output goes to `dist/`. Static hosts like Vercel, Netlify, or Cloudflare Pages can serve this bundle.

### Environment Variables in Production

1. Mirror your `.env.local` values into your hosting provider’s secret store.
2. Include both `VITE_*` and non-prefixed keys. The build uses the former at runtime, the latter for local dev fallbacks.
3. Ensure your deployment target supports fetch calls to:
   - `https://api.bland.ai`
   - Ollama Cloud API (default `https://ollama.com/api`)
   - Supabase REST endpoints
   - Gmail API (`https://gmail.googleapis.com`)

### Backend / Proxy Considerations

The current setup calls external APIs directly from the browser. For hardened production:
- Introduce a secure proxy (Node/Edge functions) to sign Bland.ai and Gmail requests and shield secrets.
- Move Supabase service-role operations (if added) to server-side.
- Rate-limit and audit outbound calls, especially email actions.

---

## Testing & QA

1. **Local smoke test:** `npm run dev`, open the app, ensure all panels load, preload demo data from `services/demoData.ts`.
2. **Chat agent:** Send a few prompts, confirm responses come from the Eburon LLM. Voice transcription should append text captured from the mic.
3. **Call logs:** Use “Analyze from Audio” to trigger transcription/analysis paths via Ollama Cloud.
4. **CRMs & Tools:** Verify `callcenter/crm-tools.json` definitions work once you register them with Bland.ai. The UI expects endpoints at `https://crm.example.com/...`; swap to your API.
5. **Email tool:** Set the Gmail OAuth env vars and simulate a `sendEmail` action from the Workspace wizard or call logs.

Consider adding automated tests (Vitest/Playwright) once the API surface stabilizes.

---

## Production Checklist

- [ ] Secrets populated in `.env.local` and deployment pipeline.
- [ ] Supabase schema initialized (see `callcenter/supabase_schema.sql`).
- [ ] CRM API endpoints live and secured (match `crm-tools.json` definitions).
- [ ] Bland.ai tools registered (`curl`/UI) using the provided payloads.
- [ ] Google OAuth refresh token stored safely; `sendEmail` verified via audit logs.
- [ ] Ollama Cloud account active; confirm model quotas fit usage.
- [ ] Analytics/monitoring added as needed (e.g., Vercel Analytics, custom logging).
- [ ] Frontend passes branding audit per `IMPORTANT.md`.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Blank page / runtime error | Missing env vars (Supabase/Bland/Ollama) | Check browser console, ensure `.env.local` values have `VITE_` prefixes. |
| Chatbot responses fail | Ollama credentials invalid or model unavailable | Confirm `OLLAMA_API_URL` and `OLLAMA_MODEL` in secrets. Test with cURL. |
| Email tool errors | Gmail OAuth env vars missing/expired | Regenerate refresh token, ensure sender has API access. |
| Audio analysis stuck | Ollama transcription model unsupported | Update `OLLAMA_TRANSCRIBE_MODEL` to a model provisioned in your account. |
| Supabase sync errors | Row-level security/permissions misaligned | Validate Supabase tables and service role policies. |

---

## Licensing & Branding

All UI must adhere to Eburon branding guidelines. See `callcenter/IMPORTANT.md` for enforced rules. Replace placeholder images and copy before public release.

---

## Support

- Issues & requests: open tickets in this repository.
- Credential rotation: coordinate with infrastructure/security teams.
- Product questions: contact the Eburon Solutions squad.

Build boldly—and keep everything Eburon-aligned. 🚀
