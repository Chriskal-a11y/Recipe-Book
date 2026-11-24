// Your own recipes, added with the + button. Saved on this device and synced (column "myrecipes" in user_data).
// They are added to RECIPES when the app starts, so they show up everywhere like the built-in dishes.
let myRecipes = (() => { try { return JSON.parse(localStorage.getItem("rb-myrecipes")) || []; } catch (e) { return []; } })();
RECIPES.push(...myRecipes);
// Built-in dishes you deleted are only hidden, so they can be brought back.
let hiddenIds = (() => { try { return JSON.parse(localStorage.getItem("rb-hidden")) || []; } catch (e) { return []; } })();
const isHidden = r => hiddenIds.includes(r.id);
function setHidden() { try { localStorage.setItem("rb-hidden", JSON.stringify(hiddenIds)); } catch (e) {} }
// What goes to the cloud: your recipes plus one entry listing the hidden dishes.
const packMine = () => [...myRecipes, { id: "__hidden", ids: hiddenIds }];
function unpackMine(arr) { arr = arr || []; const h = arr.find(x => x.id === "__hidden");
  hiddenIds = h ? h.ids : []; setHidden(); myRecipes = arr.filter(x => x.id !== "__hidden"); setMyRecipes(); }
function deleteDishes(ids) {
  myRecipes = myRecipes.filter(r => !ids.includes(r.id));
  for (const id of ids) if (!id.startsWith("my-") && !hiddenIds.includes(id)) hiddenIds.push(id);
  setHidden(); setMyRecipes(); Sync.touch("myrecipes");
}
function restoreHidden() { hiddenIds = []; setHidden(); Sync.touch("myrecipes"); }

// ---------- sharing ----------
const APP_URL = "https://chriskal-a11y.github.io/Recipe-Book/";
function recipeText(r) {
  const v = r.versions.intermediate, k = (r.portions || BASE) / BASE;
  return `${r.name}${r.nameGr ? " (" + r.nameGr + ")" : ""}\n${fmtMin(totalMin(v))} · ${r.portions || BASE} portions\n\nIngredients:\n` +
    v.ing.map(i => "- " + (i[0] != null ? fmtQty(i[0] * k, i[1]) + " " : "") + i[2]).join("\n") +
    "\n\nSteps:\n" + v.steps.map((s, n) => `${n + 1}. ${s[0]}`).join("\n");
}
async function shareRecipe(r, level) {
  const hello = "Hey check this recipe out!";
  // Built-in dishes have their own page with a preview picture; your own recipes are sent as text.
  const url = r.mine ? APP_URL : APP_URL + "share/" + r.id + ".html";
  const text = r.mine ? hello + "\n\n" + recipeText(r) + "\n\nMade with my recipe app: " : hello + " " + r.name;
  try { if (navigator.share) { await navigator.share({ title: r.name, text, url }); return; } } catch (e) { if (e.name === "AbortError") return; }
  window.open("https://wa.me/?text=" + encodeURIComponent(text + " " + url), "_blank");
}

function setMyRecipes() {
  try { localStorage.setItem("rb-myrecipes", JSON.stringify(myRecipes)); } catch (e) {}
  for (let i = RECIPES.length - 1; i >= 0; i--) if (RECIPES[i].mine) RECIPES.splice(i, 1);
  RECIPES.push(...myRecipes);
}

// ---------- reading pasted text ----------
const MR_UNITS = { g: "g", gr: "g", gram: "g", grams: "g", kg: "kg", kilo: "kg", kilos: "kg", ml: "ml", l: "L", lt: "L", litre: "L", liter: "L", litres: "L", liters: "L",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp", tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp", cup: "cup", cups: "cup",
  clove: "cloves", cloves: "cloves", pinch: "pinch", bunch: "bunch", can: "tin", cans: "tin", tin: "tin", tins: "tin", slice: "slices", slices: "slices" };
const MR_FRAC = { "½": .5, "¼": .25, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3 };
const MR_STAPLE = /^(salt|pepper|salt and pepper|black pepper|olive oil|sunflower oil|oil|water|sugar|oregano|dried oregano)$/i;

function mrNum(t) {
  t = t.replace(",", ".");
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)/); if (m) return [+m[1] + m[2] / m[3], m[0].length];
  m = t.match(/^(\d+)\/(\d+)/); if (m) return [m[1] / m[2], m[0].length];
  m = t.match(/^(\d*\.?\d+)\s*([½¼¾⅓⅔])?/); if (m) return [+m[1] + (MR_FRAC[m[2]] || 0), m[0].length];
  m = t.match(/^([½¼¾⅓⅔])/); if (m) return [MR_FRAC[m[1]], 1];
  return null;
}
function parseIng(line) {
  let t = line.replace(/^[-•*·\s]+/, "").trim(); if (!t) return null;
  let q = null, u = "";
  const n = mrNum(t);
  if (n) {
    q = n[0]; t = t.slice(n[1]).trim();
    const w = t.match(/^([a-zA-Z]+)\.?\b\s*(of\s+)?/);
    if (w && MR_UNITS[w[1].toLowerCase()]) { u = MR_UNITS[w[1].toLowerCase()]; t = t.slice(w[0].length).trim(); }
    if (u === "kg") { q *= 1000; u = "g"; }
  }
  const name = t.replace(/\s+/g, " ").trim(); if (!name) return null;
  return [q == null ? null : Math.round(q * 100) / 100, u, name, MR_STAPLE.test(name) ? 1 : 0];
}
function hobName(n) { return n <= 4 ? "low" : n <= 6 ? "medium-low" : n <= 8 ? "medium" : n <= 10 ? "medium-high" : "high"; }
function parseStep(line) {
  let t = line.replace(/^\s*(step\s*)?\d+[.):]\s*/i, "").replace(/^[-•*·\s]+/, "").trim(); if (!t) return null;
  let min = 0, m;
  if ((m = t.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*(min|minutes|mins)\b/i))) min = +m[2];
  else if ((m = t.match(/(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hour|hours)\b/i))) min = Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  else if ((m = t.match(/(\d+)\s*(min|minutes|mins|')\b/i))) min = +m[1];
  if (!min) min = 2;
  let h = null;
  if ((m = t.match(/\b(?:hob|heat|level|dial)\s*(\d{1,2})\b/i)) && +m[1] >= 1 && +m[1] <= 12) h = "H:" + hobName(+m[1]);
  else if ((m = t.match(/air\s*fr[iy]er[^.]*?(\d{2,3})\s*°?\s*c?/i)) || (m = t.match(/(\d{3})\s*°\s*c/i))) h = "AF:" + m[1];
  else if ((m = t.match(/microwave[^.]*?(\d{3,4})\s*w/i))) h = "MW:" + m[1];
  return [t, min, null, h];
}
// Splits one pasted block into ingredients and steps, using headings like "Ingredients" and "Method".
function splitPasted(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let mode = null, name = "", ing = [], steps = [];
  for (const l of lines) {
    if (/^(ingredients?|υλικά)\s*:?$/i.test(l)) { mode = "i"; continue; }
    if (/^(method|instructions?|directions?|steps?|preparation|εκτέλεση|οδηγίες)\s*:?$/i.test(l)) { mode = "s"; continue; }
    if (!mode) { if (!name) name = l; continue; }
    (mode === "i" ? ing : steps).push(l);
  }
  if (!ing.length && !steps.length) { // no headings: lines that start with a number or unit are ingredients
    for (const l of lines.slice(1)) (mrNum(l.replace(/^[-•*·\s]+/, "")) && l.length < 70 ? ing : steps).push(l);
    name = lines[0] || "";
  }
  return { name, ing: ing.join("\n"), steps: steps.join("\n") };
}

// ---------- the form ----------
function recipeForm(editId) {
  island("new");
  const old = editId && myRecipes.find(r => r.id === editId);
  const ov = old && old.versions.intermediate, k = old ? old.portions / BASE : 1;
  const f = old ? { name: old.name, nameGr: old.nameGr, category: old.category, meals: old.meals, portions: old.portions, keeps: old.keeps,
      ing: ov.ing.map(i => [i[0] == null ? "" : fmtNum(i[0] * k), i[1], i[2]].filter(x => x !== "").join(" ")).join("\n"),
      steps: ov.steps.map(s => s[0]).join("\n") }
    : { name: "", nameGr: "", category: CATEGORIES[0], meals: ["Lunch", "Dinner"], portions: 4, keeps: 2, ing: "", steps: "" };
  const opt = (arr, cur) => arr.map(x => `<option ${x === cur ? "selected" : ""}>${esc(x)}</option>`).join("");
  app.innerHTML = `<div class="dish newrecipe"><button class="back" id="back">← ${old ? "Back to the dish" : "All dishes"}</button>
    <h1>${old ? "Edit your recipe" : "New recipe"}</h1>
    ${old ? "" : `<details class="paste" ${f.ing ? "" : "open"}><summary>Paste a whole recipe</summary>
      <p class="flag">Copy a recipe from a website or a message and paste it here. The app fills in the boxes below, and you can fix anything after.</p>
      <textarea id="pasteall" rows="6" placeholder="Paste here"></textarea><button class="btn small" id="fill">Fill in the boxes</button></details>`}
    <label class="fld">Name<input id="fname" value="${esc(f.name)}" placeholder="e.g. Spinach rice"></label>
    <label class="fld">Greek name (optional)<input id="fgr" value="${esc(f.nameGr)}" placeholder="e.g. Σπανακόρυζο"></label>
    <div class="row"><label class="fld" style="flex:2">Category<select id="fcat">${opt(CATEGORIES, f.category)}</select></label>
      <label class="fld" style="flex:1">Portions<input id="fport" type="number" inputmode="numeric" min="1" max="20" value="${f.portions}"></label>
      <label class="fld" style="flex:1">Keeps (days)<input id="fkeep" type="number" inputmode="numeric" min="1" max="14" value="${f.keeps}"></label></div>
    <div class="fld">Meals<div class="chips">${MEALS.map(m => `<label class="chip"><input type="checkbox" value="${esc(m)}" ${f.meals.includes(m) ? "checked" : ""}> ${esc(m)}</label>`).join("")}</div></div>
    <label class="fld">Ingredients, one per line<textarea id="fing" rows="8" placeholder="500 g chickpeas&#10;1 onion&#10;2 cloves garlic&#10;3 tbsp olive oil">${esc(f.ing)}</textarea></label>
    <label class="fld">Steps, one per line<textarea id="fsteps" rows="8" placeholder="Soften the onion on hob 7 for 8 min&#10;Add the chickpeas and water, simmer 40 min">${esc(f.steps)}</textarea></label>
    <p class="flag">Tip: write the time in a step (like "10 min") and the heat (like "hob 7", "air fryer 180°C" or "microwave 800 W") and the app shows them, with a timer.</p>
    <p class="flag" id="ferr" hidden></p>
    <div class="actions"><button class="btn primary" id="fsave">${old ? "Save changes" : "Save recipe"}</button>${old ? '<button class="btn" id="fdel">Delete recipe</button>' : ""}</div></div>`;
  window.scrollTo(0, 0);
  const $ = id => document.getElementById(id);
  $("back").onclick = () => { location.hash = old ? old.id : ""; };
  if ($("fill")) $("fill").onclick = () => { const p = splitPasted($("pasteall").value);
    if (p.name && !$("fname").value) $("fname").value = p.name; $("fing").value = p.ing; $("fsteps").value = p.steps; $("fing").scrollIntoView({ block: "center" }); };
  $("fsave").onclick = () => {
    const name = $("fname").value.trim(), ing = $("fing").value.split("\n").map(parseIng).filter(Boolean), steps = $("fsteps").value.split("\n").map(parseStep).filter(Boolean);
    const err = $("ferr"); err.hidden = true;
    if (!name || !ing.length || !steps.length) { err.hidden = false; err.textContent = "Add a name, at least one ingredient and at least one step."; return; }
    const portions = Math.min(20, Math.max(1, parseInt($("fport").value) || 4)), s = BASE / portions;
    const v = { difficulty: "Easy", ing: ing.map(i => [i[0] == null ? null : i[0] * s, i[1], i[2], i[3]]), steps };
    const meals = [...app.querySelectorAll(".chips input:checked")].map(x => x.value);
    const r = { id: old ? old.id : "my-" + Date.now().toString(36), mine: true, name, nameGr: $("fgr").value.trim(), category: $("fcat").value, meals: meals.length ? meals : ["Lunch"],
      keeps: Math.max(1, parseInt($("fkeep").value) || 2), portions, versions: { basic: v, intermediate: v, advanced: v } };
    if (old) myRecipes[myRecipes.findIndex(x => x.id === old.id)] = r; else myRecipes.push(r);
    setMyRecipes(); Sync.touch("myrecipes");
    location.hash = r.id;
  };
  if ($("fdel")) $("fdel").onclick = e => { if (!e.target.dataset.sure) { e.target.dataset.sure = 1; e.target.textContent = "Tap again to delete"; return; }
    deleteDishes([old.id]); location.hash = ""; };
}
function fmtNum(n) { return String(Math.round(n * 100) / 100); }
