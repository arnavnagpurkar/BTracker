/* ---- replaces the old "Save / Load code" dialog (later declaration wins) ---- */
function openSave(){
  const st = CLOUD.state();
  const text = {synced:"All changes are saved to your account.", pending:"Changes are waiting to save…", saving:"Saving…",
                offline:"Can't reach the server — will keep retrying.", paused:"Saving is paused — a newer copy exists in your account."}[st];
  const when = CLOUD.lastSaved ? " Last saved " + CLOUD.lastSaved.toLocaleTimeString() + "." : "";
  const code = makeCode();
  openModal(`<h3>Cloud save</h3>
    <p>Your progress lives in your account, not in this browser. Sign in on any device and it is all there.</p>
    <div class="msg ${st==="synced"?"good":st==="paused"?"bad":"warn"}" id="csMsg">${esc(text+when)}</div>
    <div class="acts"><button class="btn primary" id="csNow">Save now</button>
      ${st==="paused"?'<button class="btn" id="csResolve">Resolve</button>':""}
      <button class="btn" id="doClose">Close</button></div>
    <details style="margin-top:18px"><summary style="cursor:pointer;font-weight:600">Import or export a code (advanced)</summary>
      <div class="block" style="margin-top:12px"><div class="blabel">Bring in progress from your old file</div>
        <textarea id="inCode" rows="4" placeholder="Paste a code from the old tracker here"></textarea>
        <div class="hwrow" style="margin-top:8px"><button class="btn" id="pickFile">Open a .txt file</button>
          <button class="btn" id="doLoad">Import code</button>
          <input type="file" id="fileIn" accept=".txt,text/plain" style="display:none"></div>
        <div class="msg" id="loadMsg"></div></div>
      <div class="block"><div class="blabel">Optional off-site backup</div>
        <textarea id="outCode" rows="3" readonly>${esc(code)}</textarea>
        <div class="acts" style="margin-top:8px"><button class="btn" id="doFile">Download .txt</button>
          <button class="btn" id="doCopy">Copy code</button></div></div>
    </details>`);
  modal.querySelector("#doClose").onclick = closeModal;
  modal.querySelector("#csNow").onclick = async ()=>{
    CLOUD.pending = true; await CLOUD.flushNow();
    const m = modal.querySelector("#csMsg"); if(!m) return;
    const s2 = CLOUD.state();
    m.className = "msg " + (s2==="synced"?"good":"warn");
    m.textContent = s2==="synced" ? "Saved." : "Not saved yet — will keep retrying.";
  };
  const rs = modal.querySelector("#csResolve"); if(rs) rs.onclick = ()=>{ closeModal(); CLOUD.conflict(); };
  modal.querySelector("#outCode").addEventListener("focus", e=>e.target.select());
  modal.querySelector("#doCopy").onclick = async e=>{
    const ok = await copyText(code); toast(ok ? "Code copied" : "Select the code and copy it manually");
  };
  modal.querySelector("#doFile").onclick = ()=>{
    const d = new Date(), name = "Cataloguer_"+dayKey(d)+"_"+String(d.getHours()).padStart(2,"0")+"-"+String(d.getMinutes()).padStart(2,"0")+".txt";
    downloadText(name, code); toast("Saved as "+name);
  };
  modal.querySelector("#pickFile").onclick = ()=>modal.querySelector("#fileIn").click();
  modal.querySelector("#fileIn").onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ modal.querySelector("#inCode").value = String(rd.result).trim();
      const m = modal.querySelector("#loadMsg"); m.className = "msg good"; m.textContent = "Loaded "+f.name+" — press Import code."; };
    rd.readAsText(f);
  };
  modal.querySelector("#doLoad").onclick = async ()=>{
    const msg = modal.querySelector("#loadMsg");
    let parsed;
    try{ parsed = readCode(modal.querySelector("#inCode").value); }
    catch(err){ msg.className = "msg bad"; msg.textContent = err.message; return; }
    let done = 0; Object.keys(parsed.d).forEach(k=>parsed.d[k].forEach(v=>{ if(isDone(v)) done++; }));
    if(!await ask("Import this code?",
      `It holds ${done} solved questions${parsed.h.length?" and "+parsed.h.length+" homework lists":""}. Importing replaces everything currently in your account's progress.`,
      "Import")) return;
    snapshot("import code");
    adoptCode(parsed); buildTree(); markClean();
    CLOUD.pending = true; CLOUD.flushNow();
    closeModal(); location.hash = "#/"; render(); toastUndo("Imported and saving to your account");
  };
}
