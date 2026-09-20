// Turns original/tracker.html into the version served by the app:
//   cloud-only storage, Clerk profile-button slot, new look.
// Fails loudly if an expected line is missing, so a mismatch can never ship silently.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = path.join(root, process.argv[2] || "original/tracker.html");
const snip = (n) => fs.readFileSync(path.join(root, "scripts/snippets", n), "utf8");

if (!fs.existsSync(input)) {
  console.error(`\n✖ Could not find ${path.relative(root, input)}.\n  Save your original HTML file there, then run again.\n`);
  process.exit(1);
}

let html = fs.readFileSync(input, "utf8").replace(/\r\n/g, "\n");
if (html.includes("CLOUD.touch()")) {
  console.error("✖ That file already contains the patch. Use your un-patched original.");
  process.exit(1);
}

// split/join instead of String.replace so "$" in snippets is never treated as a pattern
function edit(label, find, replace, expected = 1) {
  const n = html.split(find).length - 1;
  if (n !== expected) {
    console.error(`\n✖ Patch step "${label}": expected ${expected} match(es), found ${n}.\n  Looking for: ${find.slice(0, 90)}\n`);
    process.exit(1);
  }
  html = html.split(find).join(replace);
}

// 1. cloud helper, defined before anything calls markDirty()
edit("cloud helper", "let saveTimer=null, lastAuto=null;", snip("cloud.js") + "\nlet saveTimer=null, lastAuto=null;");

// 2. every change schedules a cloud save; the browser-storage autosave is switched off
edit("markDirty hook", "S.dirty = true;", "S.dirty = true; CLOUD.touch();");
edit("no local autosave timer", "saveTimer = setTimeout(autoSave, 700);", "saveTimer = null;");
edit("no local autosave", "function autoSave(){", "function autoSave(){ return; /* cloud-only */");

// 3. start(): wait for the account's saved copy before drawing anything
edit("async start", "(function start(){", "(async function start(){");
edit("boot", "if(backup){ try{ adoptCode(readCode(backup)); }catch(e){} }", "await CLOUD.boot();");

// 3b. the one-time "what's new" notice remembers it was seen in the account, not in this browser
edit("notice check", 'if(LS.get("qlog.update2Seen")) return;', "if(S.x.seenUpdate2) return;");
edit("notice flag", 'LS.set("qlog.update2Seen", "1");', "S.x.seenUpdate2 = 1; markDirty();");

// 4. warn only if there is something not yet in the cloud
edit("beforeunload", 'if(S.dirty && !LS.ok){ e.preventDefault(); e.returnValue=""; }',
  'if(CLOUD.pending || CLOUD.busy){ e.preventDefault(); e.returnValue=""; }');

// 5. top bar: "Sync" button plus an empty slot where the Clerk profile picture is drawn
edit("sync button + profile slot",
  '<button class="tool" id="openSave"><span class="dot" id="dirtyDot"></span>Save</button>',
  '<button class="tool" id="openSave"><span class="dot" id="dirtyDot"></span>Sync</button>\n    <div id="userSlot" aria-hidden="true"></div>');
edit("report slot position",
  'function sizeTopbar(){ document.documentElement.style.setProperty("--topbar-h", document.querySelector(".topbar").offsetHeight+"px"); }',
  'function sizeTopbar(){ document.documentElement.style.setProperty("--topbar-h", document.querySelector(".topbar").offsetHeight+"px"); if(typeof postSlot==="function") postSlot(); }');
edit("home text",
  "Everything is kept in this page and backed up in this browser as you work. Press <strong>Save</strong> to take a code or a text file with you.",
  "Everything is saved to your account as you work — sign in on any device and pick up where you left off.");

// 6. new cloud-save dialog (declared last, so it replaces the old Save dialog)
edit("save dialog", "</script>\n</body>",
  snip("save-modal.js") +
  '\nwindow.addEventListener("load", postSlot);\ntry{ new ResizeObserver(postSlot).observe(document.querySelector(".topbar")); }catch(e){}\nif(document.fonts && document.fonts.ready) document.fonts.ready.then(postSlot);\n</script>\n</body>');

// 7. look and feel
edit("css", "@media (prefers-reduced-motion:reduce){*{transition:none!important}}",
  "@media (prefers-reduced-motion:reduce){*{transition:none!important}}" + snip("theme.css"));
edit("font", '<meta charset="utf-8">',
  '<meta charset="utf-8">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">');
  
fs.mkdirSync(path.join(root, "lib"), { recursive: true });
fs.mkdirSync(path.join(root, "patched"), { recursive: true });
fs.writeFileSync(path.join(root, "lib/tracker.generated.ts"), `// generated — do not edit\nconst html: string = ${JSON.stringify(html)};\nexport default html;\n`);
fs.writeFileSync(path.join(root, "patched/tracker.html"), html);
console.log(`✔ Patched ${path.relative(root, input)} → lib/tracker.generated.ts (${Math.round(html.length / 1024)} KB)`);
