/* ---- cloud-only storage (added by scripts/patch-tracker.mjs) ---------------
   The account's cloud copy is the single source of truth: nothing is kept in
   localStorage or a file. The app waits for the cloud copy before it starts,
   sends changes back a few seconds after you stop (and when the tab is hidden
   or closed), and every write carries the version it last saw, so a second
   device can never be silently overwritten. */
const UKEY = String(window.__USER__ || "anon");
const CLOUD = {
  version:0, serverVersion:0, pending:false, blocked:false, busy:false, failing:false, booted:false,
  timer:null, nag:null, lastSaved:null,
  state(){ return this.blocked ? "paused" : this.failing ? "offline" : this.busy ? "saving" : this.pending ? "pending" : "synced"; },
  paint(){
    const d = document.getElementById("dirtyDot"); if(!d) return;
    const st = this.state();
    d.classList.toggle("ok", st === "synced");
    d.classList.toggle("on", st === "pending" || st === "saving" || st === "offline");
    d.classList.toggle("err", st === "paused");
    d.title = {synced:"Saved to your account", pending:"Changes waiting to save", saving:"Saving…",
               offline:"Offline — will retry", paused:"Sync paused — a newer copy exists"}[st];
  },
  cleanup(){
    ["qlog.backup."+UKEY, "qlog.at."+UKEY, "qlog.ver."+UKEY, "qlog.backup", "qlog.at"].forEach(k=>{
      try{ window.localStorage.removeItem(k); }catch(e){} });
  },
  async load(){
    const ctl = new AbortController(), t = setTimeout(()=>ctl.abort(), 8000);
    try{
      const r = await fetch("/api/state", {cache:"no-store", signal:ctl.signal});
      return r.ok ? await r.json() : null;
    }catch(e){ return null; }
    finally{ clearTimeout(t); }
  },
  touch(){ this.pending = true; this.paint(); this.arm(); },
  arm(ms){
    if(!this.booted) return;
    if(this.blocked){
      if(!this.nag) this.nag = setTimeout(()=>{ this.nag = null; if(this.blocked && veil.hidden) this.conflict(); }, 60000);
      return;
    }
    if(this.timer) return;
    this.timer = setTimeout(()=>{ this.timer = null; this.flushNow(); }, ms || 8000);
  },
  pause(v){ this.serverVersion = v; this.blocked = true; this.paint(); this.conflict(); },
  async flushNow(){
    if(!this.booted || !this.pending || this.blocked || this.busy) return;
    clearTimeout(this.timer); this.timer = null;
    this.busy = true; this.pending = false; this.paint();
    try{
      const code = makeCode();
      const r = await fetch("/api/state", {method:"PUT", headers:{"content-type":"application/json"},
        body:JSON.stringify({code, baseVersion:this.version}), keepalive: code.length < 60000});
      if(r.ok){ this.version = (await r.json()).version; this.failing = false; this.lastSaved = new Date(); this.cleanup(); }
      else if(r.status === 409){
        const j = await r.json().catch(()=>({version:0}));
        this.pending = true;
        if(!j.version) this.version = 0; else this.pause(j.version);
      }
      else if(r.status === 401){ this.pending = true; this.failing = true; toast("Signed out — sign in again to keep saving"); }
      else { this.pending = true; this.failing = true; }
    }catch(e){ this.pending = true; this.failing = true; }
    finally{ this.busy = false; this.paint(); if(this.pending && !this.blocked && !this.timer) this.arm(this.failing ? 15000 : 1000); }
  },
  retryScreen(){
    return new Promise(res=>{
      const a = document.getElementById("app");
      a.innerHTML = `<div class="panel" style="margin-top:40px;text-align:center">
        <h2>Can't reach your saved progress</h2>
        <p class="sub">Check your connection. Nothing has been changed, and nothing will be saved until it loads.</p>
        <button class="btn primary" id="cbRetry">Try again</button></div>`;
      document.getElementById("cbRetry").onclick = ()=>res();
    });
  },
  /* runs once at start: the app does not draw until the cloud copy is in */
  async boot(){
    let cloud;
    for(;;){ cloud = await this.load(); if(cloud) break; await this.retryScreen(); }
    this.version = cloud.version | 0;
    let src = cloud.code, migrate = false;
    if(!src){                                   /* first sign-in: rescue anything an earlier build kept in this browser */
      const old = LS.get("qlog.backup."+UKEY);
      if(old){ src = old; migrate = true; }
    }
    let unreadable = false;
    if(src){ try{ adoptCode(readCode(src)); }catch(e){ unreadable = true; } }
    this.booted = true;
    if(unreadable){ this.serverVersion = this.version; this.blocked = true; toast("Your saved copy could not be read — saving is paused"); }
    else if(migrate || this.pending){ this.pending = true; this.arm(1500); }   /* pending: a repair ran while loading */
    else this.cleanup();
    this.paint();
  },
  conflict(){
    if(!veil.hidden) return;
    onEsc = ()=>{ CLOUD.arm(); };
    openModal(`<h3>A newer copy is in your account</h3>
      <p>Your progress was saved from another device or tab after this screen loaded. Nothing has been overwritten yet — choose which copy to keep.</p>
      <div class="acts" style="flex-direction:column;align-items:stretch">
        <button class="btn primary" id="cvTake">Use the saved copy (replaces what is on this screen)</button>
        <button class="btn danger" id="cvKeep">Keep this screen and overwrite the saved copy</button>
        <button class="btn" id="cvLater">Decide later (saving stays paused)</button></div>`);
    modal.querySelector("#cvTake").onclick = async ()=>{
      const cur = await CLOUD.load();
      if(!cur || !cur.code){ toast("Could not reach the saved copy — try again"); return; }
      let p; try{ p = readCode(cur.code); }catch(e){ toast("The saved copy could not be read"); return; }
      snapshot("use saved copy");
      adoptCode(p); buildTree();
      CLOUD.version = cur.version | 0; CLOUD.blocked = false; CLOUD.pending = false; CLOUD.paint();
      closeModal(); location.hash = "#/"; render(); toastUndo("Loaded the saved copy");
    };
    modal.querySelector("#cvKeep").onclick = ()=>{
      CLOUD.version = CLOUD.serverVersion; CLOUD.blocked = false; CLOUD.pending = true;
      closeModal(); CLOUD.flushNow(); toast("Overwriting the saved copy with this screen");
    };
    modal.querySelector("#cvLater").onclick = ()=>{ closeModal(); CLOUD.arm(); };
  }
};
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState === "hidden") CLOUD.flushNow(); });
window.addEventListener("pagehide", ()=>CLOUD.flushNow());
window.addEventListener("online", ()=>CLOUD.flushNow());
/* tell the page around us where to draw the Clerk profile button */
function postSlot(){
  const el = document.getElementById("userSlot");
  if(!el || window.parent === window) return;
  const r = el.getBoundingClientRect();
  window.parent.postMessage({type:"slot", x:Math.round(r.left), y:Math.round(r.top)}, window.location.origin);
}
