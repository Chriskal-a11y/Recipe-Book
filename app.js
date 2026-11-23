// My Recipe Book app. Data lives in recipes.js; what you plan, buy and time is saved on this device.
const LEVELS=[["basic","Basic"],["intermediate","Intermediate"],["advanced","Advanced"]];
const LEVEL_NAME=Object.fromEntries(LEVELS);
const CAT_COLOR={"Legumes":"--c-legumes","Ladera":"--c-ladera","Pasta":"--c-pasta","Meat":"--c-meat","Chicken":"--c-chicken","Fish & seafood":"--c-fish","Potatoes & vegetables":"--c-veg","Desserts":"--c-dessert"};
const CATEGORIES=[...new Set(RECIPES.map(r=>r.category))];
const MEALS=[...new Set(RECIPES.flatMap(r=>r.meals))];
const TIMES=[["any","Any time",()=>true],["30","Up to 30 min",m=>m<=30],["60","30 min – 1 h",m=>m>30&&m<=60],["60+","Over 1 h",m=>m>60]];
const SLOTS=["Lunch","Dinner"];
const DEFAULT_PORTIONS=2;
const HOB={"low":"3–4","medium-low":"5–6","medium":"7–8","medium-high":"9–10","high":"11–12"};
const ICON={
  dishes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 13h16a8 8 0 0 1-16 0z"/><path d="M9 9c0-2 1.5-2 1.5-4M14 9c0-2 1.5-2 1.5-4"/></svg>',
  schedule:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  shop:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.2 1.2L6.8 5M3.5 12l1.2 1.2 2.1-2.2M3.5 18l1.2 1.2 2.1-2.2"/></svg>',
  basics:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M9 9h6M9 13h6"/></svg>',
  filter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M7 12h10M10 17h4"/></svg>',
  play:'<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M4 2.5v11l9-5.5z"/></svg>',
  clock:'<svg class="clock" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="6.3"/><path d="M8 4.5V8l2.4 1.6"/></svg>'};

// ---------- storage ----------
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
let schedule=load("rb-schedule",{}); let shop=load("rb-shop",[]); let timers=load("rb-timers",[]);
const state={cat:"all",meal:"all",time:"any",q:"",level:"intermediate",portions:BASE,weekOffset:0};

// ---------- helpers ----------
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const byId=id=>RECIPES.find(r=>r.id===id);
function totalMin(v){return v.steps.filter(s=>!s[2]).reduce((a,s)=>a+s[1],0)}
function fmtMin(m){if(m<60)return m+" min";const h=Math.floor(m/60),r=m%60;return h+" h"+(r?" "+r+" min":"")}
function aheadOf(v){return v.steps.find(s=>s[2]==="a")}
function heat(h){if(!h)return "";const [k,v]=h.split(":");
  const t=k==="H"?["hob","Hob",HOB[v]+" ("+v+")"]:k==="AF"?["af","Air fryer",v+"°C"]:["mw","Microwave",v+" W"];
  return `<span class="heat ${t[0]}">${t[1]} · ${t[2]}</span>`}
function photo(r,cls=""){const c=`var(${CAT_COLOR[r.category]||"--accent"})`;
  return `<div class="photo ${cls}" style="background:linear-gradient(135deg,${c},color-mix(in srgb,${c} 60%,#000))"><span class="gr">${esc(r.nameGr)}</span><span class="ph">Photo later</span></div>`}
function fmtQty(q,unit){
  if(q==null)return "";
  if(unit==="g"||unit==="ml"){q=q>=50?Math.round(q/5)*5:Math.round(q);
    if(q>=1000)return (Math.round(q/100)/10)+" "+(unit==="g"?"kg":"L");return q+" "+unit}
  if(unit==="L")return fmtQty(q*1000,"ml");
  let r=Math.round(q*4)/4; if(r===0)r=0.25;
  const w=Math.floor(r),f=r-w,fr={0.25:"¼",0.5:"½",0.75:"¾"}[f]||"";
  const n=(w?w:"")+fr; return unit?`${n} ${unit}`:n}
const fmtK=n=>"≈ "+n.toLocaleString("en")+" kcal";
function isoDate(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function weekDays(off){const d=new Date();d.setHours(12,0,0,0);const dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow+off*7);
  return [...Array(7)].map((_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return x})}
const app=document.getElementById("app");

// ---------- bottom island ----------
function island(active){
  const items=[["dishes","#","Dishes"],["schedule","#schedule","Schedule"],["shop","#shop","Ingredients"],["basics","#basics","Basics"]];
  document.getElementById("island").innerHTML=items.map(([k,h,l])=>`<a href="${h}" ${k===active?'aria-current="page"':""}>${ICON[k]}<span>${l}</span></a>`).join("");
}

// ---------- sheet ----------
function openSheet(html,bind){const s=document.getElementById("sheet"),sc=document.getElementById("scrim");
  s.innerHTML='<div class="grab"></div>'+html;s.hidden=false;sc.hidden=false;sc.onclick=closeSheet;if(bind)bind(s)}
function closeSheet(){document.getElementById("sheet").hidden=true;document.getElementById("scrim").hidden=true}

// ---------- dishes list ----------
function filterLabels(){return [
  [state.cat==="all"?"All categories":state.cat,state.cat!=="all"],
  [state.meal==="all"?"All meals":state.meal,state.meal!=="all"],
  [TIMES.find(t=>t[0]===state.time)[1],state.time!=="any"]]}
function matches(r,f=state){const q=f.q.trim().toLowerCase(),tf=TIMES.find(t=>t[0]===f.time)[2];
  return (f.cat==="all"||r.category===f.cat)&&(f.meal==="all"||r.meals.includes(f.meal))&&tf(totalMin(r.versions.intermediate))&&(!q||(r.name+" "+r.nameGr).toLowerCase().includes(q))}
function list(){
  island("dishes");
  const items=RECIPES.filter(r=>matches(r));
  app.innerHTML=`<header class="top"><h1>My Recipe Book</h1>
    <input class="search" id="search" type="search" placeholder="Search ${RECIPES.length} dishes" value="${esc(state.q)}">
    <div class="filterbar"><button class="btn" id="filters">${ICON.filter}Filters</button>
      <div class="active-filters">${filterLabels().map(([l,on])=>`<span class="tag ${on?"on":""}">${esc(l)}</span>`).join("")}</div></div></header>
    <div class="grid">${items.map(r=>{const v=r.versions.intermediate,a=aheadOf(v);
      return `<button class="card" data-id="${r.id}">${photo(r)}<div class="body"><h3>${esc(r.name)}</h3>
      <div class="meta"><span class="pill">Intermediate</span><span>${ICON.clock}${fmtMin(totalMin(v))}</span></div>
      <div class="meta">${fmtK(kcalPerPortion(v))}${a?" · prep night before":""}</div></div></button>`}).join("")||'<div class="empty">No dishes match these filters.</div>'}</div>`;
  document.getElementById("search").addEventListener("input",e=>{state.q=e.target.value;const pos=e.target.selectionStart;list();const n=document.getElementById("search");n.focus();n.setSelectionRange(pos,pos)});
  document.getElementById("filters").onclick=filterSheet;
  app.querySelectorAll(".card").forEach(b=>b.onclick=()=>{location.hash=b.dataset.id});
}
function filterSheet(){
  const d={cat:state.cat,meal:state.meal,time:state.time,q:state.q};
  const render=s=>{const n=RECIPES.filter(r=>matches(r,d)).length;
    const group=(title,key,opts)=>`<div><div class="label">${title}</div><div class="chips" style="margin-top:8px">${opts.map(([v,l])=>`<button class="chip" data-k="${key}" data-v="${esc(v)}" aria-pressed="${d[key]===v}">${esc(l)}</button>`).join("")}</div></div>`;
    s.innerHTML='<div class="grab"></div><h2>Filters</h2>'+
      group("Category","cat",[["all","All categories"],...CATEGORIES.map(c=>[c,c])])+
      group("Meal","meal",[["all","All meals"],...MEALS.map(c=>[c,c])])+
      group("Time (intermediate version)","time",TIMES.map(t=>[t[0],t[1]]))+
      `<div class="foot"><button class="btn" id="freset">Reset</button><button class="btn primary" id="fapply">Show ${n} dish${n===1?"":"es"}</button></div>`;
    s.querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{d[b.dataset.k]=b.dataset.v;render(s)});
    s.querySelector("#freset").onclick=()=>{d.cat="all";d.meal="all";d.time="any";render(s)};
    s.querySelector("#fapply").onclick=()=>{Object.assign(state,{cat:d.cat,meal:d.meal,time:d.time});closeSheet();list()}};
  openSheet("",render);
}

// ---------- dish page ----------
function dish(r){
  island("dishes");
  const v=r.versions[state.level],a=aheadOf(v),k=state.portions/BASE;
  const main=v.ing.filter(i=>!i[3]),staples=v.ing.filter(i=>i[3]);
  app.innerHTML=`<div class="dish"><button class="back" id="back">← All dishes</button>
    <div class="levels"><div class="seg" role="group" aria-label="Version">${LEVELS.map(([k2,l])=>`<button data-level="${k2}" aria-pressed="${k2===state.level}">${l}</button>`).join("")}</div></div>
    ${photo(r,"hero")}
    <div class="title"><div class="label">${esc(r.category)} · ${r.meals.map(esc).join(", ")}</div><h2>${esc(r.name)}</h2><div class="sub">${esc(r.nameGr)}</div></div>
    <div class="facts"><div class="fact"><span class="label">Total time</span><b>${fmtMin(totalMin(v))}</b></div>
      <div class="fact"><span class="label">Calories</span><b>${fmtK(kcalPerPortion(v))}</b><span class="flag">per portion</span></div>
      <div class="fact"><span class="label">Difficulty</span><b>${v.difficulty}</b></div>
      <div class="fact"><span class="label">Keeps</span><b>${r.keeps} day${r.keeps>1?"s":""}</b></div></div>
    ${a?`<div class="ahead"><b>Start the night before.</b> ${esc(a[0])}</div>`:""}
    <div class="actions"><button class="btn small" id="toshop">Add ingredients to list</button><button class="btn small" id="toplan">Add to schedule</button></div>
    <div class="section"><h3>Ingredients <span class="stepper"><button id="minus" aria-label="Fewer portions">−</button><span>${state.portions} portion${state.portions>1?"s":""}</span><button id="plus" aria-label="More portions">+</button></span></h3>
      <ul class="ing">${main.map(i=>`<li><span class="q">${fmtQty(i[0]*k,i[1])}</span><span>${esc(i[2])}</span></li>`).join("")}</ul>
      ${staples.length?`<div class="staples"><b>From your pantry:</b> ${staples.map(i=>esc((i[0]!=null?fmtQty(i[0]*k,i[1])+" ":"")+i[2])).join(", ")}</div>`:""}</div>
    <div class="section"><h3>Steps</h3><ol class="steps">${v.steps.filter(s=>s[2]!=="a").map((s,i)=>`<li><div>${esc(s[0])}<div class="tags">${heat(s[3])}${s[2]==="p"?'<span class="flag">Runs alongside the other steps</span>':""}</div></div>
      <button class="tbtn" data-step="${i}" aria-label="Start a ${s[1]} minute timer">${ICON.play}${fmtMin(s[1])}</button></li>`).join("")}</ol>
      <p class="flag" style="margin-top:8px">Tap a step's time to start a timer.</p></div>
    <p class="note">Calories are rough estimates per portion.</p></div>`;
  document.getElementById("back").onclick=()=>{location.hash=""};
  app.querySelectorAll("[data-level]").forEach(b=>b.onclick=()=>{state.level=b.dataset.level;dish(r)});
  document.getElementById("minus").onclick=()=>{if(state.portions>1){state.portions--;dish(r)}};
  document.getElementById("plus").onclick=()=>{if(state.portions<20){state.portions++;dish(r)}};
  const steps=v.steps.filter(s=>s[2]!=="a");
  app.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>{const i=+b.dataset.step;startTimer(`${r.name} · step ${i+1}`,steps[i][1])});
  document.getElementById("toshop").onclick=e=>{addRecipeToShop(r.id,state.level,state.portions);e.target.textContent="Added to Ingredients ✓"};
  document.getElementById("toplan").onclick=()=>planSheet(null,null,{id:r.id,level:state.level,portions:DEFAULT_PORTIONS});
}

// ---------- schedule ----------
function scheduleView(){
  island("schedule");
  const days=weekDays(state.weekOffset),today=isoDate(new Date());
  const f=d=>d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
  app.innerHTML=`<header class="top"><h1>Schedule</h1>
    <div class="weeknav"><button class="iconbtn" id="prev" aria-label="Previous week">‹</button><b>${f(days[0])} – ${f(days[6])}</b><button class="iconbtn" id="next" aria-label="Next week">›</button></div>
    <div class="row"><button class="btn small" id="weekshop">Add this week to Ingredients</button>${state.weekOffset?'<button class="btn small" id="thisweek">Back to this week</button>':""}</div></header>
    <div class="days">${days.map(d=>{const key=isoDate(d),day=schedule[key]||{};let kc=0;
      const slots=SLOTS.map(s=>{const p=day[s],r=p&&byId(p.id);if(r)kc+=kcalPerPortion(r.versions[p.level]);
        return `<div class="slot"><span class="label">${s}</span><button class="slotbtn ${r?"filled":""}" data-date="${key}" data-slot="${s}">${r?`${esc(r.name)}<small>${LEVEL_NAME[p.level]} · ${p.portions} portion${p.portions>1?"s":""} · ${fmtMin(totalMin(r.versions[p.level]))}</small>`:"+ Pick a dish"}</button></div>`}).join("");
      return `<div class="day ${key===today?"today":""}"><h3>${d.toLocaleDateString("en-GB",{weekday:"long"})}<small>${f(d)}</small></h3>${slots}${kc?`<div class="daykcal">${fmtK(kc)} for one portion of each</div>`:""}</div>`}).join("")}</div>`;
  document.getElementById("prev").onclick=()=>{state.weekOffset--;scheduleView()};
  document.getElementById("next").onclick=()=>{state.weekOffset++;scheduleView()};
  const tw=document.getElementById("thisweek");if(tw)tw.onclick=()=>{state.weekOffset=0;scheduleView()};
  document.getElementById("weekshop").onclick=e=>{let n=0;for(const d of days){const day=schedule[isoDate(d)]||{};for(const s of SLOTS)if(day[s]){addRecipeToShop(day[s].id,day[s].level,day[s].portions);n++}}
    e.target.textContent=n?`Added ${n} meal${n>1?"s":""} to Ingredients ✓`:"Nothing planned this week yet"};
  app.querySelectorAll(".slotbtn").forEach(b=>b.onclick=()=>planSheet(b.dataset.date,b.dataset.slot,(schedule[b.dataset.date]||{})[b.dataset.slot]));
}
function planSheet(date,slot,current){
  const p=Object.assign({id:null,level:"intermediate",portions:DEFAULT_PORTIONS},current||{});
  const days=weekDays(state.weekOffset);
  if(!date){date=isoDate(new Date());slot=SLOTS[1]}
  let q="";
  const render=s=>{
    const list=RECIPES.filter(r=>!q||(r.name+" "+r.nameGr).toLowerCase().includes(q));
    s.innerHTML=`<div class="grab"></div><h2>Plan a meal</h2>
      <div class="row"><select id="pday" class="search" style="flex:2">${days.map(d=>`<option value="${isoDate(d)}" ${isoDate(d)===date?"selected":""}>${d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}</option>`).join("")}</select>
        <select id="pslot" class="search" style="flex:1">${SLOTS.map(x=>`<option ${x===slot?"selected":""}>${x}</option>`).join("")}</select></div>
      <input class="search" id="pq" type="search" placeholder="Search dishes" value="${esc(q)}">
      <div class="picklist">${list.map(r=>`<button class="pick" data-id="${r.id}" aria-pressed="${r.id===p.id}"><span>${esc(r.name)}<br><small>${esc(r.nameGr)}</small></span><small>${fmtMin(totalMin(r.versions[p.level]))}</small></button>`).join("")}</div>
      <div class="seg">${LEVELS.map(([k,l])=>`<button data-level="${k}" aria-pressed="${k===p.level}">${l}</button>`).join("")}</div>
      <div class="row" style="justify-content:space-between"><span class="label">Portions</span><span class="stepper"><button id="pm">−</button><span>${p.portions}</span><button id="pp">+</button></span></div>
      <div class="foot">${current&&current.id?'<button class="btn" id="premove">Remove</button>':'<button class="btn" id="pcancel">Cancel</button>'}<button class="btn primary" id="psave" ${p.id?"":"disabled"}>Save</button></div>`;
    s.querySelector("#pday").onchange=e=>{date=e.target.value};
    s.querySelector("#pslot").onchange=e=>{slot=e.target.value};
    const pq=s.querySelector("#pq");pq.oninput=e=>{q=e.target.value.trim().toLowerCase();render(s);const n=s.querySelector("#pq");n.focus();n.setSelectionRange(n.value.length,n.value.length)};
    s.querySelectorAll(".pick").forEach(b=>b.onclick=()=>{p.id=b.dataset.id;render(s)});
    s.querySelectorAll("[data-level]").forEach(b=>b.onclick=()=>{p.level=b.dataset.level;render(s)});
    s.querySelector("#pm").onclick=()=>{if(p.portions>1){p.portions--;render(s)}};
    s.querySelector("#pp").onclick=()=>{if(p.portions<20){p.portions++;render(s)}};
    const rm=s.querySelector("#premove");if(rm)rm.onclick=()=>{delete (schedule[date]||{})[slot];save("rb-schedule",schedule);closeSheet();route()};
    const c=s.querySelector("#pcancel");if(c)c.onclick=closeSheet;
    s.querySelector("#psave").onclick=()=>{if(!p.id)return;(schedule[date]=schedule[date]||{})[slot]={id:p.id,level:p.level,portions:p.portions};save("rb-schedule",schedule);closeSheet();
      if(location.hash==="#schedule")scheduleView();else location.hash="schedule"};
  };
  openSheet("",render);
}

// ---------- ingredients (shopping list) ----------
function addRecipeToShop(id,level,portions){
  const r=byId(id),v=r.versions[level],k=portions/BASE;
  for(const [q,u,name,st] of v.ing){
    const key=name+"|"+u;let it=shop.find(x=>x.key===key);
    if(!it){it={key,name,unit:u,qty:null,staple:!!st,checked:false,src:[]};shop.push(it)}
    if(q!=null)it.qty=(it.qty||0)+q*k;
    it.checked=false;if(!it.src.includes(r.name))it.src.push(r.name);
  }
  save("rb-shop",shop);
}
function shopView(){
  island("shop");
  const buy=shop.filter(x=>!x.staple),home=shop.filter(x=>x.staple);
  const left=buy.filter(x=>!x.checked).length;
  const li=x=>`<li class="${x.checked?"done":""}"><label><input type="checkbox" data-key="${esc(x.key)}" ${x.checked?"checked":""}><span><span class="name">${esc(x.name)}</span>${x.src.length?`<span class="src">${esc(x.src.join(", "))}</span>`:""}</span><span class="q">${fmtQty(x.qty,x.unit)}</span></label></li>`;
  app.innerHTML=`<header class="top"><h1>Ingredients</h1>
    <p>${shop.length?`${left} of ${buy.length} item${buy.length===1?"":"s"} left to buy`:"Your shopping list is empty."}</p>
    <div class="row"><button class="btn small" id="addweek">Add this week's meals</button><button class="btn small" id="addrecipe">Add from a recipe</button></div></header>
    ${shop.length?"":`<p class="empty">Plan meals in Schedule and add the week here, or open any dish and tap "Add ingredients to list".</p>`}
    ${buy.length?`<div class="section"><h3>To buy</h3><ul class="shop">${buy.map(li).join("")}</ul></div>`:""}
    <div class="addrow"><input class="search" id="newitem" placeholder="Add something else, e.g. bread"><button class="btn" id="additem">Add</button></div>
    ${home.length?`<div class="section"><h3>Check you have at home</h3><ul class="shop">${home.map(li).join("")}</ul></div>`:""}
    ${shop.length?`<div class="actions" style="margin-top:20px"><button class="btn small" id="clearticked">Remove ticked items</button><button class="btn small" id="clearall">Clear the whole list</button></div>`:""}`;
  app.querySelectorAll("[data-key]").forEach(c=>c.onchange=()=>{const it=shop.find(x=>x.key===c.dataset.key);it.checked=c.checked;save("rb-shop",shop);shopView()});
  document.getElementById("addweek").onclick=e=>{let n=0;for(const d of weekDays(0)){const day=schedule[isoDate(d)]||{};for(const s of SLOTS)if(day[s]){addRecipeToShop(day[s].id,day[s].level,day[s].portions);n++}}
    if(n)shopView();else e.target.textContent="Nothing planned this week yet"};
  document.getElementById("addrecipe").onclick=recipePickSheet;
  const add=()=>{const v=document.getElementById("newitem").value.trim();if(!v)return;shop.push({key:"own|"+Date.now(),name:v,unit:"",qty:null,staple:false,checked:false,src:[]});save("rb-shop",shop);shopView()};
  document.getElementById("additem").onclick=add;document.getElementById("newitem").onkeydown=e=>{if(e.key==="Enter")add()};
  const ct=document.getElementById("clearticked");if(ct)ct.onclick=()=>{shop=shop.filter(x=>!x.checked);save("rb-shop",shop);shopView()};
  const ca=document.getElementById("clearall");if(ca)ca.onclick=e=>{if(e.target.dataset.sure){shop=[];save("rb-shop",shop);shopView()}else{e.target.dataset.sure=1;e.target.textContent="Tap again to clear everything"}};
}
function recipePickSheet(){
  const p={id:null,level:"intermediate",portions:DEFAULT_PORTIONS};
  const render=s=>{s.innerHTML=`<div class="grab"></div><h2>Add from a recipe</h2>
    <div class="picklist">${RECIPES.map(r=>`<button class="pick" data-id="${r.id}" aria-pressed="${r.id===p.id}"><span>${esc(r.name)}<br><small>${esc(r.nameGr)}</small></span></button>`).join("")}</div>
    <div class="seg">${LEVELS.map(([k,l])=>`<button data-level="${k}" aria-pressed="${k===p.level}">${l}</button>`).join("")}</div>
    <div class="row" style="justify-content:space-between"><span class="label">Portions</span><span class="stepper"><button id="pm">−</button><span>${p.portions}</span><button id="pp">+</button></span></div>
    <div class="foot"><button class="btn" id="pc">Cancel</button><button class="btn primary" id="pa" ${p.id?"":"disabled"}>Add ingredients</button></div>`;
    s.querySelectorAll(".pick").forEach(b=>b.onclick=()=>{p.id=b.dataset.id;render(s)});
    s.querySelectorAll("[data-level]").forEach(b=>b.onclick=()=>{p.level=b.dataset.level;render(s)});
    s.querySelector("#pm").onclick=()=>{if(p.portions>1){p.portions--;render(s)}};
    s.querySelector("#pp").onclick=()=>{if(p.portions<20){p.portions++;render(s)}};
    s.querySelector("#pc").onclick=closeSheet;
    s.querySelector("#pa").onclick=()=>{if(!p.id)return;addRecipeToShop(p.id,p.level,p.portions);closeSheet();shopView()}};
  openSheet("",render);
}

// ---------- kitchen basics ----------
function basics(){
  island("basics");
  app.innerHTML=`<header class="top"><h1>Kitchen basics</h1><p>Quick reference for your electric hob, air fryer and microwave. Times are approximate, so check doneness.</p>
  <input class="search" id="bsearch" type="search" placeholder="Search, e.g. broccoli, salmon, eggs"></header>
  ${BASICS.map(b=>`<section class="section bsec"><h3>${esc(b.title)}</h3><p class="bnote">${esc(b.note)}</p>
    <ul class="ing basics">${b.rows.map(r=>`<li data-s="${esc((b.title+" "+r[0]+" "+r[1]).toLowerCase())}"><span>${esc(r[0])}</span><span class="q">${esc(r[1])}</span></li>`).join("")}</ul></section>`).join("")}
  <div class="empty" id="bempty" hidden>Nothing found. Ask me and I'll add it.</div>`;
  document.getElementById("bsearch").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();let any=false;
    app.querySelectorAll(".bsec").forEach(sec=>{let n=0;sec.querySelectorAll("li").forEach(li=>{const ok=!q||li.dataset.s.includes(q);li.hidden=!ok;if(ok)n++});
      sec.querySelector(".bnote").hidden=!!q;sec.hidden=n===0;if(n)any=true});
    document.getElementById("bempty").hidden=any});
}

// ---------- timers ----------
// A timer stores its end time, so it stays correct while the app is in the background.
let audioCtx=null,wakeLock=null,ringLoop=null;
function unlockAudio(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume()}catch(e){}}
function beep(){if(!audioCtx)return;const t=audioCtx.currentTime;
  [0,0.25,0.5].forEach(o=>{const os=audioCtx.createOscillator(),g=audioCtx.createGain();os.type="sine";os.frequency.value=880;
    g.gain.setValueAtTime(0.0001,t+o);g.gain.exponentialRampToValueAtTime(0.5,t+o+0.02);g.gain.exponentialRampToValueAtTime(0.0001,t+o+0.2);
    os.connect(g).connect(audioCtx.destination);os.start(t+o);os.stop(t+o+0.22)})}
function startTimer(label,minutes){
  unlockAudio();
  if("Notification" in window&&Notification.permission==="default"){try{Notification.requestPermission()}catch(e){}}
  timers.push({id:Date.now(),label,dur:minutes*60000,end:Date.now()+minutes*60000,left:null,ring:false});
  save("rb-timers",timers);renderTimers();keepAwake();
}
function timerLeft(t){return t.end?Math.max(0,t.end-Date.now()):t.left}
function fmtClock(ms){const s=Math.ceil(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return (h?h+":"+String(m).padStart(2,"0"):m)+":"+String(x).padStart(2,"0")}
function renderTimers(){
  const box=document.getElementById("timers");document.body.classList.toggle("has-timers",timers.length>0);
  box.innerHTML=timers.map(t=>{const left=timerLeft(t);
    return `<div class="timer ${t.ring?"ring":""}" data-t="${t.id}"><div class="tl">${esc(t.label)}<b>${t.ring?"Done!":fmtClock(left)}</b></div>
      ${t.ring?'<button data-a="stop">Stop</button><span></span><span></span>':`<button data-a="${t.end?"pause":"resume"}">${t.end?"Pause":"Resume"}</button><button data-a="reset">Reset</button><button data-a="close" aria-label="Remove timer">✕</button>`}</div>`}).join("");
  box.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{unlockAudio();const t=timers.find(x=>x.id==b.closest(".timer").dataset.t);
    if(b.dataset.a==="pause"){t.left=timerLeft(t);t.end=null}
    if(b.dataset.a==="resume"){t.end=Date.now()+t.left;t.left=null}
    if(b.dataset.a==="reset"){t.end=null;t.left=t.dur}
    if(b.dataset.a==="close"||b.dataset.a==="stop")timers=timers.filter(x=>x!==t);
    save("rb-timers",timers);renderTimers();keepAwake()});
}
function tick(){let changed=false;
  for(const t of timers)if(t.end&&!t.ring&&Date.now()>=t.end){t.ring=true;t.end=null;t.left=0;changed=true;notify(t)}
  if(changed)save("rb-timers",timers);
  if(timers.some(t=>t.ring)){if(!ringLoop){beep();ringLoop=setInterval(beep,1200);try{navigator.vibrate&&navigator.vibrate([400,200,400,200,400])}catch(e){}}}
  else if(ringLoop){clearInterval(ringLoop);ringLoop=null}
  if(timers.length)renderTimers();
}
function notify(t){try{if("Notification" in window&&Notification.permission==="granted"&&navigator.serviceWorker)
  navigator.serviceWorker.ready.then(reg=>reg.showNotification("Timer done",{body:t.label,tag:"timer-"+t.id,vibrate:[400,200,400],requireInteraction:true}))}catch(e){}}
async function keepAwake(){const running=timers.some(t=>t.end||t.ring);
  try{if(running&&!wakeLock&&navigator.wakeLock){wakeLock=await navigator.wakeLock.request("screen");wakeLock.addEventListener("release",()=>{wakeLock=null})}
    if(!running&&wakeLock){await wakeLock.release();wakeLock=null}}catch(e){}}
document.addEventListener("visibilitychange",()=>{if(!document.hidden){tick();keepAwake()}});
setInterval(tick,500);

// ---------- routing ----------
let lastId=null;
function route(){closeSheet();const id=location.hash.slice(1),r=byId(id);
  if(id==="basics"||id==="schedule"||id==="shop"){lastId=null;({basics,schedule:scheduleView,shop:shopView})[id]();window.scrollTo(0,0);return}
  if(r){if(id!==lastId){state.level="intermediate";state.portions=BASE;window.scrollTo(0,0)}lastId=id;dish(r)}else{lastId=null;list()}}
window.addEventListener("hashchange",route);route();renderTimers();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"))}
