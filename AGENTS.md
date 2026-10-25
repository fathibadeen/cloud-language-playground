<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Brand and partner artwork is stored as Lovable Asset pointer JSON and imported by UI components, keeping uploaded binaries out of source control.
- Voice provider is Nabrah via its External API (`https://api.nabrah.ai/api/ext`, `X-API-Key: NABRAH_API_KEY`, server-only client in `src/lib/nabrah.server.ts`): agents are listed/linked and their post-call callbacks are set programmatically to `/api/public/webhooks/nabrah` with a per-agent HMAC token, and calls are also pulled with `/call/search` + `/call/{id}` so transcripts/recordings survive missed webhooks.
- Agent sandbox chat (`src/lib/preview.functions.ts` + `AgentTester`) answers through the Lovable AI Gateway with the agent's instructions and the company's knowledge chunks, never through the live voice/WhatsApp provider, so customers can test without sending real traffic.
- A user may belong to several companies; the active one is stored in `localStorage` (`sawti.active-company`) and read by `useMembership` in `src/lib/tenant.ts`, so every company-scoped query stays a single source of truth.
- Dashboard subscription access is defined in `dashboard-access.ts`: expired subscriptions may reach billing and payment confirmation, but suspension overrides those exceptions, so renewal remains possible without reopening service access.
- Clinic suite: pure rules (reminder timing, emergency detection, show-rate math) live in `src/lib/clinic.ts` with tests; the agent prompt section comes from `clinic.server.ts` and is enabled only when a company has a `clinic_settings` row, so non-clinic companies are unaffected. Reminders run every 15 min via `/api/public/jobs/clinic-reminders`.
- Notifications are written only through the `push_notification` / `push_admin_notification` DB functions (called by table triggers and server jobs) so preferences and per-event dedupe keys apply everywhere; categories live in `src/lib/notification-types.ts`.
