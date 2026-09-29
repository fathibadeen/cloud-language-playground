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
- Voice provider is Nabrah: agents are created in the Nabrah dashboard and linked by direct link/id; calls arrive via /api/public/webhooks/nabrah with a per-agent HMAC token, because Nabrah publishes no REST reference or webhook signature.
