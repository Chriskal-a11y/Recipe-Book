// Your own dish photos. Saved on this device (IndexedDB) and synced through Supabase Storage (bucket "photos").
const Photos = (() => {
  const urls = {};          // dishId -> object URL for display
  let db = null;
  function open() {
    return new Promise((res, rej) => {
      if (db) return res(db);
      const r = indexedDB.open("rb-photos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("photos");
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }
  async function tx(mode, fn) { const d = await open(); return new Promise((res, rej) => { const t = d.transaction("photos", mode); const s = t.objectStore("photos"); const out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); }
  const getRec = id => tx("readonly", s => s.get(id));
  const putRec = (id, rec) => tx("readwrite", s => s.put(rec, id));
  const delRec = id => tx("readwrite", s => s.delete(id));
  const allKeys = () => tx("readonly", s => s.getAllKeys());

  function setUrl(id, blob) { if (urls[id]) URL.revokeObjectURL(urls[id]); if (blob) urls[id] = URL.createObjectURL(blob); else delete urls[id]; }
  async function loadAll() { try { for (const id of await allKeys()) { const rec = await getRec(id); if (rec && !rec.deleted) setUrl(id, rec.blob); } } catch (e) {} }

  // Shrink to at most 1200 px on the long side, as JPEG, so photos stay small.
  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, 1200 / Math.max(img.width, img.height)); const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); c.toBlob(b => b ? res(b) : rej(new Error("Could not read the photo")), "image/jpeg", 0.82); };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("That file isn't a photo the app can read")); };
      img.src = u;
    });
  }
  async function add(id, file) { const blob = await shrink(file); const rec = { blob, at: Date.now(), synced: false }; await putRec(id, rec); setUrl(id, blob); Sync.photoChanged(); }
  async function remove(id) { await putRec(id, { deleted: true, at: Date.now(), synced: false }); setUrl(id, null); Sync.photoChanged(); }

  // Called by Sync with the signed-in Supabase client and user.
  async function sync(client, user) {
    const store = client.storage.from("photos");
    const { data: remote, error } = await store.list(user.id, { limit: 1000 });
    if (error) return false;
    const remoteMap = Object.fromEntries((remote || []).map(o => [o.name.replace(/\.jpg$/, ""), Date.parse(o.updated_at || o.created_at || 0)]));
    const local = await allKeys();
    let changed = false;
    for (const id of local) {
      const rec = await getRec(id);
      if (rec.synced) { if (!(id in remoteMap) && !rec.deleted) { await delRec(id); setUrl(id, null); changed = true; } continue; }
      if (rec.deleted) { await store.remove([`${user.id}/${id}.jpg`]); await delRec(id); }
      else { const { error: e } = await store.upload(`${user.id}/${id}.jpg`, rec.blob, { upsert: true, contentType: "image/jpeg" }); if (!e) await putRec(id, { ...rec, synced: true }); }
    }
    for (const [id, at] of Object.entries(remoteMap)) {
      const rec = await getRec(id);
      if (rec && (!rec.synced || rec.at >= at)) continue;
      const { data: blob, error: e } = await store.download(`${user.id}/${id}.jpg`);
      if (!e && blob) { await putRec(id, { blob, at, synced: true }); setUrl(id, blob); changed = true; }
    }
    return changed;
  }
  return { loadAll, add, remove, sync, url: id => urls[id] };
})();
