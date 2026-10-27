/**
 * Browser-side Meta WhatsApp Embedded Signup for the customer dashboard.
 * Returns the auth code (+ chosen WABA/phone) for completeWhatsappConnect.
 * The popup fallback returns through /admin, the redirect URI registered in Meta.
 */
type FB = {
  init: (o: Record<string, unknown>) => void;
  login: (cb: (r: { authResponse?: { code?: string } | null }) => void, o: Record<string, unknown>) => void;
};

let sdk: Promise<FB> | null = null;
function loadSdk(appId: string, version: string): Promise<FB> {
  const w = window as unknown as { FB?: FB; fbAsyncInit?: () => void };
  if (w.FB) return Promise.resolve(w.FB);
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    w.fbAsyncInit = () => {
      w.FB!.init({ appId, cookie: false, xfbml: false, version });
      resolve(w.FB!);
    };
    if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.onerror = () => reject(new Error("fb_sdk_failed"));
      document.body.appendChild(s);
    }
  });
  return sdk;
}

export type SignupResult = { code?: string | undefined; redirectUri?: string | undefined; wabaId?: string | undefined; phoneNumberId?: string | undefined };

export function runEmbeddedSignup(appId: string, configId: string, version: string): Promise<SignupResult> {
  const session: { wabaId?: string; phoneNumberId?: string } = {};
  const onSession = (e: MessageEvent) => {
    try {
      if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
      const m = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      if (m?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (m.data?.waba_id) session.wabaId = String(m.data.waba_id);
      if (m.data?.phone_number_id) session.phoneNumberId = String(m.data.phone_number_id);
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("message", onSession);
  const extras = { setup: {}, featureType: "", sessionInfoVersion: "3" };

  const done = async (code?: string, redirectUri?: string): Promise<SignupResult> => {
    await new Promise((r) => setTimeout(r, 400));
    window.removeEventListener("message", onSession);
    return { code, redirectUri, ...session };
  };

  const popup = (): Promise<SignupResult> =>
    new Promise((resolve) => {
      const redirectUri = window.location.hostname.endsWith("sawti-ai.com")
        ? "https://www.sawti-ai.com/admin"
        : `${window.location.origin}/admin`;
      const state = `meta_${crypto.randomUUID()}`;
      const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
      url.searchParams.set("client_id", appId);
      url.searchParams.set("config_id", configId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("override_default_response_type", "true");
      url.searchParams.set("state", state);
      url.searchParams.set("extras", JSON.stringify(extras));
      const win = window.open(url.toString(), "meta_signup", "width=620,height=760");
      if (!win) return resolve(done(undefined));
      let finished = false;
      const onMsg = (e: MessageEvent) => {
        if (e.origin !== window.location.origin || e.data?.type !== "meta_oauth" || e.data.state !== state) return;
        finished = true;
        cleanup();
        resolve(done(e.data.code ?? undefined, redirectUri));
      };
      const timer = window.setInterval(() => {
        if (win.closed && !finished) {
          cleanup();
          resolve(done(undefined));
        }
      }, 800);
      const cleanup = () => {
        window.removeEventListener("message", onMsg);
        window.clearInterval(timer);
      };
      window.addEventListener("message", onMsg);
    });

  const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000));
  return Promise.race([loadSdk(appId, version), timeout]).then(
    (FB) =>
      new Promise<SignupResult>((resolve) => {
        FB.login(
          (r) => {
            const code = r?.authResponse?.code;
            resolve(code ? done(code) : popup());
          },
          { config_id: configId, response_type: "code", override_default_response_type: true, extras },
        );
      }),
    () => popup(),
  );
}
