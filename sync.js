// Syncs the schedule and shopping list between devices through Supabase.
// Everything works offline first; changes upload when there is internet. The newest change wins.
const Sync = (() => {
  const cfg = window.SYNC_CONFIG || {};
  let client = null, user = null, timer = null, pending = false, status = "off";
  let meta = null; // loaded on first use, after the app has started
  const M = () => meta || (meta = load("rb-meta", { scheduleAt: 0, shopAt: 0 }));
  const listeners = [];
  const setStatus = s => { status = s; listeners.forEach(f => f(s)); };

  function enabled() { return !!(cfg.url && cfg.key && window.supabase); }
  async function init() {
    if (!enabled()) return;
    client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await client.auth.getSession();
    user = data.session ? data.session.user : null;
    client.auth.onAuthStateChange((_e, session) => { user = session ? session.user : null; setStatus(user ? "idle" : "signedout"); if (user) pull(); });
    setStatus(user ? "idle" : "signedout");
    if (user) pull();
    window.addEventListener("online", () => { if (pending) push(); else pull(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) pull(); });
    setInterval(() => { if (!document.hidden) pull(); }, 60000);
  }
  function touch(kind) { M(); meta[kind + "At"] = Date.now(); save("rb-meta", meta); pending = true; clearTimeout(timer); timer = setTimeout(push, 800); }
  async function push() {
    if (!client || !user) return; M();
    setStatus("syncing");
    const { error } = await client.from("user_data").upsert({ user_id: user.id, schedule, schedule_at: meta.scheduleAt, shop, shop_at: meta.shopAt, updated_at: new Date().toISOString() });
    if (error) { pending = true; setStatus("offline"); } else { pending = false; setStatus("synced"); }
  }
  async function pull() {
    if (!client || !user) return; M();
    setStatus("syncing");
    const { data, error } = await client.from("user_data").select("*").eq("user_id", user.id).maybeSingle();
    if (error) { setStatus("offline"); return; }
    let changed = false, needPush = !data;
    if (data) {
      if (data.schedule_at > meta.scheduleAt) { schedule = data.schedule || {}; meta.scheduleAt = data.schedule_at; save("rb-schedule", schedule); changed = true; }
      else if (meta.scheduleAt > data.schedule_at) needPush = true;
      if (data.shop_at > meta.shopAt) { shop = data.shop || []; meta.shopAt = data.shop_at; save("rb-shop", shop); changed = true; }
      else if (meta.shopAt > data.shop_at) needPush = true;
      save("rb-meta", meta);
    }
    if (needPush || pending) await push(); else setStatus("synced");
    if (changed) { if (document.getElementById("sheet").hidden) route(); else window.__rerender = true; }
  }
  async function signIn(email, password) { const { error } = await client.auth.signInWithPassword({ email, password }); return error && error.message; }
  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return error.message;
    return data.session ? null : "CHECK_EMAIL";
  }
  async function signOut() { await client.auth.signOut(); user = null; setStatus("signedout"); }
  return { init, touch, push, pull, signIn, signUp, signOut, enabled, onStatus: f => listeners.push(f),
    get status() { return status; }, get email() { return user && user.email; } };
})();
