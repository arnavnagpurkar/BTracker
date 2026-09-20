// Runs your whole patched app in a stubbed browser and checks cloud save/load.
// Usage: npm test   (after every change to original/tracker.html)
import fs from "node:fs"; import vm from "node:vm";
const html = fs.readFileSync(new URL("../patched/tracker.html", import.meta.url), "utf8");
const code = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
const U = new Proxy(function(){}, {
  get:(t,k)=> k===Symbol.toPrimitive ? ()=>"" : k==="length" ? 0 : k==="then" ? undefined : U,
  apply:()=>U, construct:()=>U, set:()=>true, has:()=>true });
async function run({row, ls={}}){
  const store={...ls}, puts=[], errors=[]; let srv={code:row?.code??null, version:row?.version??0};
  const timers=[];
  const win = new Proxy({__USER__:"u_test", addEventListener(){}, removeEventListener(){}, scrollTo(){}, innerHeight:800,
      localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v},removeItem:k=>{delete store[k]}}, location:{hash:"",origin:"http://x"}, parent:null}, {
    get:(t,k)=> k in t ? t[k] : U, set:(t,k,v)=>{t[k]=v;return true}});
  win.parent = win;
  const ctx = { window:win, document:new Proxy({fonts:{ready:Promise.resolve()}},{get:(t,k)=>k in t?t[k]:U,set:()=>true}), navigator:U, location:win.location, history:U, Blob:U, URL:U, FileReader:U,
    requestAnimationFrame:()=>1, cancelAnimationFrame(){}, getComputedStyle:()=>U, ResizeObserver:class{observe(){}}, AbortController,
    setTimeout:(f,ms)=>{timers.push([f,ms]);return timers.length}, clearTimeout(){}, setInterval:()=>1, clearInterval(){},
    console, Date, JSON, Math, Object, Array, Set, Map, Number, String, Promise, RegExp, Error, parseInt, parseFloat, isFinite, isNaN,
    btoa:s=>Buffer.from(s,"binary").toString("base64"), atob:s=>Buffer.from(s,"base64").toString("binary"),
    encodeURIComponent, decodeURIComponent, Intl, Symbol, structuredClone,
    fetch: async (u,o={})=>{ if(!o.method) return {ok:true,status:200,json:async()=>({...srv})};
      const b=JSON.parse(o.body); puts.push(b);
      if(b.baseVersion!==srv.version) return {ok:false,status:409,json:async()=>({version:srv.version})};
      srv={code:b.code,version:srv.version+1}; return {ok:true,status:200,json:async()=>({version:srv.version})}; } };
  vm.createContext(ctx);
  vm.runInContext(code + "\n;this.__x={S,CLOUD,makeCode,readCode,markDirty,metaObject,maybeShowUpdateNotice};", ctx, {filename:"tracker.js"});
  for(let i=0;i<30;i++) await new Promise(r=>setImmediate(r));   // let async start() finish
  return {ctx, x:ctx.__x, store, puts, timers, get srv(){return srv}};
}
const ok=(c,m)=>{ console.log((c?"PASS":"FAIL")+"  "+m); if(!c) process.exitCode=1; };

// A: brand-new account -> app starts (no throw), boots cleanly
let r = await run({row:null});
ok(r.x.CLOUD.booted && r.x.CLOUD.version===0, "whole patched app boots for a new account (no runtime errors)");

// B: edit -> real markDirty -> real makeCode -> upload
r.x.S.d["P1A"]=[1,1,3]; r.x.markDirty();
ok(r.x.CLOUD.pending && r.timers.some(([,ms])=>ms===8000), "a real edit schedules a cloud save");
await r.x.CLOUD.flushNow();
ok(r.puts.length===1 && r.srv.version===1 && r.x.CLOUD.state()==="synced", "real save code uploaded, version 0 -> 1");

// C: round-trip through the REAL readCode: everything saved comes back
const back = r.x.readCode(r.srv.code);
ok(JSON.stringify(back.d["P1A"])===JSON.stringify([1,1,3]), "ticks survive save -> load");

// D: full-state round trip with data in every saved field
r.x.S.notes.push({id:"n1",t:"$x^2$",c:[],at:1}); r.x.S.bm["P1A.0"]=["k1"]; r.x.S.col.push({id:"k1",n:"C"});
r.x.S.h.push({id:"h1",kind:"task",title:"T",done:false}); r.x.S.log.push([100,30,"P"]); r.x.S.stat["2026-01-01"]={P:3};
r.x.S.x.refAdded={hcv:7}; r.x.S.x.seenUpdate2=1; r.x.S.theme="light"; r.x.S.goals.day.q=77;
const code2 = r.x.makeCode(); const b2 = r.x.readCode(code2);
ok(b2.notes.length===1 && b2.bm["P1A.0"][0]==="k1" && b2.col.length===1 && b2.h.length===1 && b2.log.length===1 &&
   b2.stat["2026-01-01"].P===3 && b2.x.refAdded.hcv===7 && b2.x.seenUpdate2===1 && b2.theme==="light" && b2.goals.day.q===77,
   "notes, bookmarks, collections, homework, sessions, stats, reference books, notice flag, theme, goals all round-trip");

// E: second device loads the saved copy
const r2 = await run({row:{code:code2,version:5}});
ok(r2.x.S.notes.length===1 && r2.x.S.theme==="light" && r2.x.CLOUD.version===5, "a second device starts with the same data");

// F: notice flag is per-account, not per-browser
ok(!("qlog.update2Seen" in r2.store), "'what's new' flag no longer written to localStorage");
ok(Object.keys(r2.store).filter(k=>k.startsWith("qlog.")).length===0, "no qlog.* keys in localStorage after boot");
