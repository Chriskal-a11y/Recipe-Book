// Syncs the schedule and shopping list between devices through Supabase.
// Everything works offline first; changes upload when there is internet. The newest change wins.
const Sync = (() => {
  const cfg = window.SYNC_CONFIG || {};
  let client = null, user = null, timer = null, pending = false, status = "off";
  let meta = null; // loaded on first use, after the app has started
  const M = () => meta || (meta = Object.assign({ scheduleAt: 0, shopAt: 0, pantryAt: 0 }, load("rb-meta", {})));
  let hasPantryCol = true; // false if the database has no pantry column yet
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
    const row = { user_id: user.id, schedule, schedule_at: meta.scheduleAt, shop, shop_at: meta.shopAt, updated_at: new Date().toISOString() };
    if (hasPantryCol) Object.assign(row, { pantry, pantry_at: meta.pantryAt });
    let { error } = await client.from("user_data").upsert(row);
    if (error && hasPantryCol && /pantry/.test(error.message || "")) { hasPantryCol = false; delete row.pantry; delete row.pantry_at; ({ error } = await client.from("user_data").upsert(row)); }
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
      if ("pantry" in data) {
        if (data.pantry_at > meta.pantryAt) { pantry = data.pantry || []; meta.pantryAt = data.pantry_at; save("rb-pantry", pantry); changed = true; }
        else if (meta.pantryAt > data.pantry_at) needPush = true;
      } else hasPantryCol = false;
      save("rb-meta", meta);
    }
    if (needPush || pending) await push(); else setStatus("synced");
    try { if (await Photos.sync(client, user)) changed = true; } catch (e) {}
    if (changed) { if (document.getElementById("sheet").hidden) route(); else window.__rerender = true; }
  }
  let photoTimer = null;
  function photoChanged() { clearTimeout(photoTimer); photoTimer = setTimeout(async () => { if (client && user) { try { await Photos.sync(client, user); } catch (e) {} } }, 1000); }
  async function signIn(email, password) { const { error } = await client.auth.signInWithPassword({ email, password }); return error && error.message; }
  async function signUp(email, password) {
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return error.message;
    return data.session ? null : "CHECK_EMAIL";
  }
  async function signOut() { await client.auth.signOut(); user = null; setStatus("signedout"); }
  return { init, touch, photoChanged, push, pull, signIn, signUp, signOut, enabled, onStatus: f => listeners.push(f),
    get status() { return status; }, get email() { return user && user.email; } };
})();
