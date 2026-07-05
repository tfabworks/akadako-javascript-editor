// AkaDako JavaScript Editor
// - CodeMirror で 1 つの HTML ページ（CSS / JavaScript 含む）を編集する
// - 「実行 ▶」で iframe (WebMIDI 許可) に描画し、HTMLページ画面へ切り替える
// - 「ボードに接続」でエディタ自身が akadako.js でボードへ接続し、
//   接続されているセンサーを走査して見つかったものを全てグラフ表示する

const STARTER_CODE = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>AkaDako のページ</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; background: #f5f7fa; }
    h1 { color: #1565c0; }
    .value { font-size: 2.5rem; font-weight: bold; color: #0b6e4f; }
  </style>
</head>
<body>
  <h1>AkaDako プログラム</h1>
  <p>温度: <span id="temp" class="value">-</span> ℃</p>

  <script src="akadako.js"></script>
  <script>
    // AkaDako に接続して、1秒ごとに温度を表示します
    async function main() {
      const board = await AkaDako.connect();
      console.log("接続しました");
      setInterval(async () => {
        const t = await board.fetchTemperature();
        document.getElementById("temp").textContent = t;
      }, 1000);
    }
    main().catch((e) => console.error("エラー:", e));
  </script>
</body>
</html>
`;

// --- DOM --------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const consoleEl = $("console");
const statusEl = $("status");
const runBtn = $("run");
const stopBtn = $("stop");
const connectBtn = $("connect");
const clearBtn = $("clear");
const watchlist = $("watchlist");
const preview = $("preview");
const monitorNote = $("monitor-note");

function log(text, cls) {
  const span = document.createElement("span");
  if (cls) span.className = cls;
  span.textContent = text;
  consoleEl.appendChild(span);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function setStatus(text, ok) {
  statusEl.textContent = text;
  statusEl.className = ok ? "ok" : "warn";
}

// エラーの取りこぼしを防ぐ: エディタ自身のエラーもコンソール欄に出す
window.addEventListener("error", (e) => {
  console.error("[editor] error:", e.error || e.message);
  log("JSエラー: " + (e.message || e.error) + "\n", "err");
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("[editor] unhandled rejection:", e.reason);
  log("Promiseエラー: " + e.reason + "\n", "err");
});

// --- editor (CodeMirror 5, htmlmixed) ----------------------------------------
const cm = CodeMirror.fromTextArea($("editor"), {
  mode: "htmlmixed",
  lineNumbers: true,
  indentUnit: 2,
  tabSize: 2,
  matchBrackets: true,
  autoCloseBrackets: true,
  extraKeys: {
    "Ctrl-Enter": runCode,
    "Cmd-Enter": runCode,
    "Ctrl-Space": (cmi) => cmi.showHint({ hint: jsHint, completeSingle: false }),
  },
});
cm.setValue(STARTER_CODE);

// ユーザーが手で編集したかどうか。未編集の間だけ「サンプル」で黙って置き換える。
let editorPristine = true;
let draftTimer = null;
cm.on("change", (_cmi, change) => {
  if (change.origin !== "setValue") {
    editorPristine = false;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }
});
window.addEventListener("beforeunload", saveDraft);

// --- 補完 --------------------------------------------------------------------
const JS_KEYWORDS = [
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "default", "delete", "do", "else", "false", "finally", "for", "function",
  "if", "in", "instanceof", "let", "new", "null", "of", "return", "switch",
  "this", "throw", "true", "try", "typeof", "undefined", "var", "while",
];
const JS_BUILTINS = [
  "console", "document", "window", "alert", "setInterval", "setTimeout",
  "clearInterval", "clearTimeout", "getElementById", "querySelector",
  "addEventListener", "textContent", "innerHTML", "Math", "JSON", "String",
  "Number", "Array", "Promise", "parseInt", "parseFloat", "AkaDako",
];

function collectWords(cmi) {
  const words = new Set();
  const re = /[A-Za-z_$][\w$]+/g;
  let m;
  const text = cmi.getValue();
  while ((m = re.exec(text))) words.add(m[0]);
  return words;
}

// board.xxx / AkaDako.xxx は API カタログから、それ以外は JS キーワード・
// ビルトイン・文書中の単語から補完する。
function jsHint(cmi) {
  const cur = cmi.getCursor();
  const line = cmi.getLine(cur.line).slice(0, cur.ch);

  const mem = line.match(/([A-Za-z_$][\w$.]*)\.(\w*)$/);
  if (mem) {
    const obj = mem[1], prefix = mem[2];
    let pool = null;
    if (obj === "AkaDako") pool = window.AKADAKO_STATICS;
    else if (obj === "board" || obj.endsWith("board") || obj.endsWith("Board")) pool = window.AKADAKO_BOARD_API;
    if (pool) {
      const list = pool
        .filter((c) => c.name.toLowerCase().startsWith(prefix.toLowerCase()))
        .map((c) => ({
          text: c.insert,
          displayText: c.sig,
          render(el) {
            el.innerHTML =
              '<span style="color:#6f42c1">' + c.sig + "</span>" +
              '<span style="color:#888; margin-left:.6em">' + c.doc + "</span>";
          },
        }));
      return list.length
        ? { list, from: CodeMirror.Pos(cur.line, cur.ch - prefix.length), to: cur }
        : null;
    }
  }

  const wm = line.match(/[A-Za-z_$][\w$]*$/);
  const word = wm ? wm[0] : "";
  const lower = word.toLowerCase();
  const seen = new Set();
  const list = [];
  const add = (text, color) => {
    if (text === word || seen.has(text)) return;
    if (word && !text.toLowerCase().startsWith(lower)) return;
    seen.add(text);
    list.push(color
      ? { text, render(el) { el.innerHTML = '<span style="color:' + color + '">' + text + "</span>"; } }
      : { text });
  };
  JS_KEYWORDS.forEach((k) => add(k, "#c026d3"));
  JS_BUILTINS.forEach((b) => add(b, "#0550ae"));
  collectWords(cmi).forEach((w) => add(w));
  if (!list.length) return null;
  return {
    list: list.slice(0, 60),
    from: CodeMirror.Pos(cur.line, cur.ch - word.length),
    to: cur,
  };
}

// 入力中に自動で補完候補を出す（文字列・コメントの中では出さない）
cm.on("inputRead", (cmi, change) => {
  const t = change.text[0];
  if (!t) return;
  const cur = cmi.getCursor();
  const tok = cmi.getTokenAt(cur);
  if (tok.type && /string|comment/.test(tok.type)) return;
  const line = cmi.getLine(cur.line).slice(0, cur.ch);
  if (t === ".") {
    if (/([A-Za-z_$][\w$.]*)\.$/.test(line)) cmi.showHint({ hint: jsHint, completeSingle: false });
    return;
  }
  if (/[A-Za-z_$]/.test(t)) {
    const memberCtx = /([A-Za-z_$][\w$.]*)\.(\w*)$/.test(line);
    const wm = line.match(/[A-Za-z_$][\w$]*$/);
    if (memberCtx || (wm && wm[0].length >= 2)) {
      cmi.showHint({ hint: jsHint, completeSingle: false });
    }
  }
});

// --- 編集 / ページ 切り替え ---------------------------------------------------
const editorwrap = $("editorwrap");
const pagewrap = $("pagewrap");
const viewEditBtn = $("view-edit");
const viewPageBtn = $("view-page");

function showView(which) {
  const page = which === "page";
  editorwrap.hidden = page;
  pagewrap.hidden = !page;
  viewEditBtn.classList.toggle("active", !page);
  viewPageBtn.classList.toggle("active", page);
  if (!page) cm.refresh();
}
viewEditBtn.addEventListener("click", () => showView("edit"));
viewPageBtn.addEventListener("click", () => showView("page"));

// --- 実行 / 停止 ---------------------------------------------------------------
// ページ内の console.log / エラーを親のコンソール欄へ転送するブリッジを
// ユーザーの HTML の先頭 (head) に差し込む。
const CONSOLE_BRIDGE = '<script>(function(){' +
  'function fmt(a){if(typeof a==="object"&&a!==null){try{return JSON.stringify(a);}catch(e){return String(a);}}return String(a);}' +
  'function send(kind,text){try{parent.postMessage({__adkConsole:true,kind:kind,text:text},"*");}catch(e){}}' +
  '["log","info","warn","error"].forEach(function(k){var o=console[k]?console[k].bind(console):function(){};' +
  'console[k]=function(){var a=[].slice.call(arguments);send(k,a.map(fmt).join(" "));o.apply(null,a);};});' +
  'window.addEventListener("error",function(e){send("error",String(e.message||e.error)+(e.lineno?" (行 "+e.lineno+")":""));});' +
  'window.addEventListener("unhandledrejection",function(e){send("error","Promiseエラー: "+fmt(e.reason));});' +
  '})();<\/script>';

function injectConsoleBridge(html) {
  const head = html.match(/<head[^>]*>/i);
  if (head) return html.replace(head[0], head[0] + CONSOLE_BRIDGE);
  const doctype = html.match(/<!doctype[^>]*>/i);
  if (doctype) return html.replace(doctype[0], doctype[0] + CONSOLE_BRIDGE);
  return CONSOLE_BRIDGE + html;
}

window.addEventListener("message", (e) => {
  const m = e.data;
  if (!m || !m.__adkConsole) return;
  const cls = m.kind === "error" || m.kind === "warn" ? "err" : undefined;
  log("[ページ] " + m.text + "\n", cls);
});

let pageRunning = false;

function runCode() {
  // ページ側がボードを使うので、エディタのモニターは一時停止する
  setMonitorPaused(true);
  preview.srcdoc = injectConsoleBridge(cm.getValue());
  pageRunning = true;
  stopBtn.disabled = false;
  showView("page");
  log("\n▶ 実行開始（HTMLページ画面に切り替えました）\n", "muted");
}

function stopCode() {
  preview.srcdoc = "";
  pageRunning = false;
  stopBtn.disabled = true;
  setMonitorPaused(false);
  // Pageモードのまま停止する（自動でEditへは切り替えない）
  log("◼ 停止しました\n", "muted");
}

runBtn.addEventListener("click", runCode);
stopBtn.addEventListener("click", stopCode);
clearBtn.addEventListener("click", () => (consoleEl.textContent = ""));

// --- センサーモニタ ------------------------------------------------------------
const watches = new Map(); // key -> {values, valEl, ctx, canvas}
const SENSOR_DEFS = window.AKADAKO_SENSOR_DEFS;
const defByKey = new Map(SENSOR_DEFS.map((d) => [d.key, d]));

function clearWatches() {
  watches.clear();
  watchlist.innerHTML = "";
}

function fmtVal(v) {
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === "boolean") return v ? "ON" : "OFF";
  return String(v);
}

function ensureWatch(key) {
  let w = watches.get(key);
  if (w) return w;
  const def = defByKey.get(key);
  const row = document.createElement("div");
  row.className = "watch";
  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = def ? def.label + (def.unit ? " (" + def.unit + ")" : "") : key;
  nameEl.title = "board." + key + "()";
  const valEl = document.createElement("span");
  valEl.className = "val";
  valEl.textContent = "-";
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 26;
  row.append(nameEl, valEl, canvas);
  watchlist.append(row);
  w = { values: [], valEl, canvas, ctx: canvas.getContext("2d") };
  watches.set(key, w);
  return w;
}

function drawSpark(w) {
  const { ctx, canvas, values } = w;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (values.length < 2) return;
  let min = Math.min(...values), max = Math.max(...values);
  if (max === min) { max += 1; min -= 1; }
  ctx.strokeStyle = "#1565c0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * (W - 2) + 1;
    const y = H - 2 - ((v - min) / (max - min)) * (H - 4);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

function onValue(key, value) {
  const w = ensureWatch(key);
  w.valEl.textContent = fmtVal(value);
  let num = null;
  if (typeof value === "number") num = value;
  else if (typeof value === "boolean") num = value ? 1 : 0;
  if (num !== null) {
    w.values.push(num);
    if (w.values.length > 80) w.values.shift();
    drawSpark(w);
  }
}

// --- ボード接続とセンサー走査 ---------------------------------------------------
let board = null;
let availableKeys = [];   // 見つかったセンサー（SENSOR_DEFS の key）
let pollTimer = null;
let pollBusy = false;
let monitorPaused = false;

function setMonitorPaused(paused) {
  monitorPaused = paused;
  monitorNote.hidden = !paused || !board;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

async function tryRead(methodName, ms) {
  try {
    await withTimeout(Promise.resolve(board[methodName]()), ms);
    return true;
  } catch (e) {
    return false;
  }
}

// 各センサーの代表メソッドを 1 回ずつ試し、応答したグループを「見つかった」とする。
// I2C バスが混ざらないよう順番に実行する。
async function probeSensors() {
  const found = new Set(["always"]);
  for (const [group, rep] of Object.entries(window.AKADAKO_PROBE_REPS)) {
    setStatus("センサーを調べています… (" + rep + ")", false);
    if (await tryRead(rep, 3000)) found.add(group);
  }
  return SENSOR_DEFS.filter((d) => found.has(d.probeGroup)).map((d) => d.key);
}

async function pollOnce() {
  if (pollBusy || monitorPaused || !board || !board.isConnected) return;
  pollBusy = true;
  try {
    for (const key of availableKeys) {
      if (monitorPaused || !board || !board.isConnected) break;
      const def = defByKey.get(key);
      try {
        const v = def.async
          ? await withTimeout(board[key](), 2500)
          : board[key]();
        onValue(key, v);
      } catch (e) { /* 一時的な読み取り失敗は無視 */ }
    }
  } finally {
    pollBusy = false;
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollOnce, 1000);
  pollOnce();
}

async function connectBoard() {
  if (!navigator.requestMIDIAccess) {
    setStatus("このブラウザは WebMIDI 非対応です（Chrome / Edge を使ってください）", false);
    log("WebMIDI が利用できません（navigator.requestMIDIAccess が未定義）\n", "err");
    return;
  }
  connectBtn.disabled = true;
  try {
    if (!board || !board.isConnected) {
      setStatus("接続中…", false);
      log("接続中…（WebMIDI の使用許可を要求しています）\n", "muted");
      board = await AkaDako.connect();
      board.onDisconnected(() => {
        setStatus("ボードが切断されました", false);
        log("ボードが切断されました\n", "err");
        board = null;
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        connectBtn.textContent = "Connect";
        connectBtn.title = "ボードに接続";
      });
      log("接続しました\n", "muted");
    }
    // 接続した瞬間にセンサーを走査し、見つかったセンサーを全てグラフ表示する
    availableKeys = await probeSensors();
    clearWatches();
    availableKeys.forEach(ensureWatch);
    const labels = availableKeys.map((k) => defByKey.get(k).label);
    log("センサー検出: " + (labels.join(", ") || "なし") + "\n", "muted");
    setStatus("接続済み", true);
    connectBtn.textContent = "Rescan";
    connectBtn.title = "センサーを再スキャン";
    setMonitorPaused(pageRunning);
    startPolling();
  } catch (e) {
    setStatus("接続できませんでした: " + (e && e.message ? e.message : e), false);
    log("接続できませんでした: " + e + "\n", "err");
  } finally {
    connectBtn.disabled = false;
  }
}
connectBtn.addEventListener("click", connectBoard);

// --- サンプル生成 ---------------------------------------------------------------
// 接続されている全てのセンサーの値を表示する HTML ページを作ってエディタに入れる。
function generateSampleHTML(keys) {
  const defs = SENSOR_DEFS.filter((d) => keys.includes(d.key));
  const cards = defs.map((d) =>
    '    <div class="card">\n' +
    '      <div class="label">' + d.label + '</div>\n' +
    '      <div class="value"><span id="' + d.key + '">-</span><small> ' + d.unit + '</small></div>\n' +
    '    </div>'
  ).join("\n");
  const reads = defs.map((d) => d.async
    ? '        try { setText("' + d.key + '", await board.' + d.key + '()); } catch (e) {}'
    : '        try { setText("' + d.key + '", board.' + d.key + '()); } catch (e) {}'
  ).join("\n");

  return '<!DOCTYPE html>\n' +
'<html lang="ja">\n' +
'<head>\n' +
'  <meta charset="utf-8">\n' +
'  <title>AkaDako センサー一覧</title>\n' +
'  <style>\n' +
'    body { font-family: sans-serif; margin: 1.5rem; background: #f5f7fa; color: #24292f; }\n' +
'    h1 { color: #1565c0; font-size: 1.4rem; }\n' +
'    #cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .75rem; }\n' +
'    .card { background: #fff; border: 1px solid #d9dee5; border-radius: 10px; padding: .8rem 1rem; }\n' +
'    .card .label { font-size: .9rem; color: #6b7280; }\n' +
'    .card .value { font-size: 1.8rem; font-weight: bold; color: #0b6e4f; }\n' +
'    .card .value small { font-size: .9rem; color: #6b7280; font-weight: normal; }\n' +
'    #msg { color: #b26a00; }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <h1>AkaDako センサー一覧</h1>\n' +
'  <p id="msg">接続中…</p>\n' +
'  <div id="cards">\n' +
cards + '\n' +
'  </div>\n' +
'\n' +
'  <script src="akadako.js"></script>\n' +
'  <script>\n' +
'    function setText(id, v) {\n' +
'      if (typeof v === "boolean") v = v ? "ON" : "OFF";\n' +
'      document.getElementById(id).textContent = v;\n' +
'    }\n' +
'    async function main() {\n' +
'      const board = await AkaDako.connect();\n' +
'      document.getElementById("msg").textContent = "接続しました（1秒ごとに更新）";\n' +
'      async function update() {\n' +
reads + '\n' +
'        setTimeout(update, 1000);\n' +
'      }\n' +
'      update();\n' +
'    }\n' +
'    main().catch((e) => {\n' +
'      document.getElementById("msg").textContent = "接続できませんでした: " + ((e && e.message) || e);\n' +
'    });\n' +
'  <\/script>\n' +
'</body>\n' +
'</html>\n';
}

function applySample() {
  cm.setValue(generateSampleHTML(availableKeys));
  editorPristine = true;   // 生成直後は未編集あつかい
  currentName = "";
  const labels = availableKeys.map((k) => defByKey.get(k).label);
  log("サンプルを作成しました（センサー: " + labels.join(", ") + "）\n", "muted");
  setStatus("サンプルを作成しました —「Run ▶」で表示できます", true);
  showView("edit");
}

function onSampleClick() {
  if (!board || !board.isConnected || !availableKeys.length) {
    setStatus("先に「Connect」でボードに接続してください", false);
    log("「Sample」はボードに接続してから使えます。\n", "err");
    return;
  }
  if (!editorPristine) {
    const msg = document.createElement("div");
    msg.textContent = "今のコードをサンプルに置き換えます。よろしいですか？（保存していない変更は消えます）";
    showModal("確認", msg, [
      { label: "置き換える", primary: true, onClick: () => { closeModal(); applySample(); } },
      { label: "やめる", onClick: closeModal },
    ]);
    return;
  }
  applySample();
}
$("sample").addEventListener("click", onSampleClick);

// --- 保存 / 開く (localStorage) --------------------------------------------------
const STORE_KEY = "akadako_js_programs";
let currentName = "";

const modal = $("modal");
const modalTitle = $("modal-title");
const modalBody = $("modal-body");
const modalActions = $("modal-actions");

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(obj) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return true; }
  catch (e) { setStatus("保存できませんでした: " + e, false); return false; }
}
function defaultName() {
  const s = loadStore();
  let i = 1;
  while (s["プログラム" + i]) i++;
  return "プログラム" + i;
}

// ドラフト自動保存（うっかり閉じても続きから再開できるように）
const DRAFT_KEY = "akadako_js_draft";
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      code: cm.getValue(),
      name: currentName,
      edited: !editorPristine,
      ts: Date.now(),
    }));
  } catch {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); }
  catch { return null; }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }

function showModal(title, contentNode, actions) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.append(contentNode);
  modalActions.innerHTML = "";
  for (const a of actions) {
    const b = document.createElement("button");
    b.textContent = a.label;
    if (a.primary) b.classList.add("primary");
    b.addEventListener("click", a.onClick);
    modalActions.append(b);
  }
  modal.hidden = false;
}
function closeModal() { modal.hidden = true; }
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.hidden) closeModal();
});

function openSaveDialog() {
  const wrap = document.createElement("div");
  const label = document.createElement("div");
  label.textContent = "プログラムの名前:";
  label.style.marginBottom = ".4rem";
  const input = document.createElement("input");
  input.value = currentName || defaultName();
  wrap.append(label, input);

  const doSave = () => {
    const n = input.value.trim();
    if (!n) { input.focus(); return; }
    const s = loadStore();
    s[n] = cm.getValue();
    if (!saveStore(s)) return;
    currentName = n;
    editorPristine = false;
    saveDraft();
    closeModal();
    setStatus("保存しました: " + n, true);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); doSave(); }
  });
  showModal("プログラムを保存", wrap, [
    { label: "保存", primary: true, onClick: doSave },
    { label: "キャンセル", onClick: closeModal },
  ]);
  setTimeout(() => { input.focus(); input.select(); }, 0);
}

function openOpenDialog() {
  const names = Object.keys(loadStore()).sort();
  const list = document.createElement("div");
  if (!names.length) {
    list.textContent = "保存されたプログラムはありません。";
    showModal("開く", list, [{ label: "閉じる", onClick: closeModal }]);
    return;
  }
  for (const name of names) {
    const row = document.createElement("div");
    row.className = "prog-row";
    const nm = document.createElement("span");
    nm.className = "pname";
    nm.textContent = name;
    const openB = document.createElement("button");
    openB.textContent = "開く";
    openB.addEventListener("click", () => {
      const code = loadStore()[name];
      if (code === undefined) return;
      cm.setValue(code);
      currentName = name;
      editorPristine = false;
      closeModal();
      showView("edit");
      setStatus("読み込みました: " + name, true);
    });
    const delB = document.createElement("button");
    delB.textContent = "削除";
    delB.addEventListener("click", () => confirmDelete(name));
    row.append(nm, openB, delB);
    list.append(row);
  }
  showModal("開く", list, [{ label: "閉じる", onClick: closeModal }]);
}

function confirmDelete(name) {
  const msg = document.createElement("div");
  msg.textContent = "「" + name + "」を削除しますか？";
  showModal("削除の確認", msg, [
    { label: "削除する", primary: true, onClick: () => {
        const s = loadStore();
        delete s[name];
        saveStore(s);
        openOpenDialog();
      } },
    { label: "やめる", onClick: openOpenDialog },
  ]);
}

$("save").addEventListener("click", openSaveDialog);
$("open").addEventListener("click", openOpenDialog);

// --- バイブコーディング（生成AIでHTMLページを作る） ---------------------------------
// xcx-g2s の「生成AI」ブロックと同じエンドポイントを使う。
// 認証は 699.jp のアクセスコード Cookie（credentials: include で送信）。
// js.699.jp と xcratch.699.jp は同一サイトなのでサードパーティ Cookie の制約を受けない。
const GENERATIVE_AI_URL = "https://xcratch.699.jp/agai/ai";

let lastVibePrompt = "";

// 生成AIに渡す指示文。ユーザーの要望を「1つの完結したHTMLページ」に仕立てさせる。
// currentCode を渡すと「今のコードを修正」、null なら「ゼロから作成」のプロンプトになる。
function buildVibePrompt(userRequest, currentCode) {
  const api = (window.AKADAKO_BOARD_API || [])
    .map((a) => "  board." + a.sig + " — " + a.doc)
    .join("\n");
  const head = currentCode
    ? [
        "あなたは AkaDako JavaScript Editor のためのコード生成アシスタントです。",
        "下記の「現在のHTMLコード」を、ユーザーの要望に沿って修正した「1つの完結したHTMLページ」を返してください。",
        "既存の構造やデザインはできるだけ活かし、要望に関係する部分だけを変更してください。",
      ]
    : [
        "あなたは AkaDako JavaScript Editor のためのコード生成アシスタントです。",
        "ユーザーの要望に合う「1つの完結したHTMLページ」を新しく作成してください。",
      ];
  const lines = [
    ...head,
    "",
    "# 制約",
    "- HTML・CSS・JavaScript をすべて1つのHTMLファイルにまとめる。",
    "- AkaDako（センサーやLED等）を使う場合は <script src=\"akadako.js\"></script> を読み込み、",
    "  `const board = await AkaDako.connect();` で接続してから使う。",
    "- fetch〜 と run〜 のメソッドは await を付けて async 関数の中で呼ぶ。",
    "- 画面は日本語で、初学者にも分かりやすい簡潔なものにする。",
    "- 出力は完成したHTMLコードのみ。説明文やマークダウンのコードフェンス(```)は付けない。",
    "",
    "# 使える主なAPI（AkaDako.connect() が返す board のメソッド）",
    api,
    "AkaDako.Color.Red などの色定数、AkaDako.ColorLed.OnBoard などの接続先定数も使える。",
  ];
  if (currentCode) {
    lines.push("", "# 現在のHTMLコード", "```html", currentCode, "```");
  }
  lines.push("", "# ユーザーの要望", userRequest);
  return lines.join("\n");
}

// 応答テキストからコード本体を取り出す（マークダウンのコードフェンスがあれば剥がす）。
function extractCode(text) {
  if (!text) return "";
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : text).trim();
}

async function callGenerativeAI(promptText) {
  // ボード接続中ならその版を、未接続なら既定値を送る（エンドポイントは board.version を要求する）
  let version = "2.0.0";
  try {
    if (board && board.isConnected) version = await board.fetchVersion();
  } catch (e) { /* 取得できなければ既定値のまま */ }

  const res = await fetch(GENERATIVE_AI_URL, {
    mode: "cors",
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: [{ text: promptText }],
      board: { version },
      locale: "ja",
    }),
  });
  return res.json(); // { content: string|null, error?: string|object }
}

function openVibeDialog() {
  const wrap = document.createElement("div");

  // モード切り替え（今のコードを修正 / ゼロから作る）。
  // 初期値は編集状態から自動選択: 未編集(スターター/生成直後)ならゼロから、手を加えていれば修正。
  let mode = editorPristine ? "new" : "modify";
  const seg = document.createElement("div");
  seg.className = "seg";
  const btnModify = document.createElement("button");
  btnModify.textContent = "今のコードを修正";
  const btnNew = document.createElement("button");
  btnNew.textContent = "ゼロから作る";
  seg.append(btnModify, btnNew);

  const label = document.createElement("div");
  label.style.marginBottom = ".4rem";
  const ta = document.createElement("textarea");
  ta.rows = 5;
  ta.value = lastVibePrompt;
  const hint = document.createElement("div");
  hint.style.cssText = "font-size:.85rem;color:var(--muted);margin-top:.5rem;line-height:1.6;";

  function renderMode() {
    btnModify.classList.toggle("active", mode === "modify");
    btnNew.classList.toggle("active", mode === "new");
    if (mode === "modify") {
      label.textContent = "今のコードをどう直したいか、日本語で説明してください:";
      ta.placeholder = "例: 明るさセンサーの値も大きな文字で表示して";
      hint.textContent = "エディタの現在のコードを送り、要望に沿って修正します。コードが大きいと送信できないことがあります。Ctrl/⌘+Enter でも実行できます。";
    } else {
      label.textContent = "作りたいものを日本語で説明してください:";
      ta.placeholder = "例: 距離センサーの値が近いほど画面が赤くなるページ";
      hint.textContent = "ゼロから新しいHTMLページを作ります（今の内容は置き換わります）。Ctrl/⌘+Enter でも実行できます。";
    }
  }
  btnModify.addEventListener("click", () => { mode = "modify"; renderMode(); ta.focus(); });
  btnNew.addEventListener("click", () => { mode = "new"; renderMode(); ta.focus(); });
  renderMode();

  wrap.append(seg, label, ta, hint);

  const doGen = () => {
    const p = ta.value.trim();
    if (!p) { ta.focus(); return; }
    lastVibePrompt = p;
    runVibeGeneration(p, mode);
  };
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doGen(); }
  });
  showModal("バイブコーディング ✨", wrap, [
    { label: "生成 ✨", primary: true, onClick: doGen },
    { label: "キャンセル", onClick: closeModal },
  ]);
  setTimeout(() => ta.focus(), 0);
}

async function runVibeGeneration(promptText, mode) {
  const currentCode = mode === "modify" ? cm.getValue() : null;
  const node = document.createElement("div");
  node.style.cssText = "display:flex;align-items:center;gap:.7rem;";
  const spin = document.createElement("span");
  spin.className = "vibe-spinner";
  const txt = document.createElement("span");
  txt.textContent = "生成中です…（10〜30秒ほどかかります）";
  node.append(spin, txt);
  showModal("バイブコーディング ✨", node, []); // 生成中はボタンなし

  try {
    const data = await callGenerativeAI(buildVibePrompt(promptText, currentCode));
    if (data && typeof data.content === "string" && data.content.trim() !== "") {
      const code = extractCode(data.content);
      closeModal();
      applyVibeResult(code, mode);
      return;
    }
    // エラー処理（xcx-g2s の生成AIブロックと同じ分岐）
    let errHtml = null, errText = null;
    if (data && data.error) {
      if (typeof data.error === "string") {
        errText = data.error;
      } else if (typeof data.error === "object") {
        if (data.error.type === "text/html") errHtml = data.error.content;
        else if (typeof data.error.content === "string") errText = data.error.content;
      }
    }
    if (!errHtml && !errText) {
      errText = "空の応答が返りました。要望を具体的にして、もう一度お試しください。";
    }
    showVibeError(errHtml, errText);
  } catch (e) {
    showVibeError(null, "生成AIに接続できませんでした: " + ((e && e.message) || e));
  }
}

function showVibeError(html, text) {
  const node = document.createElement("div");
  node.className = "vibe-errbox";
  if (html) node.innerHTML = html;          // 699.jp のエラー（アクセスコード案内リンク等）
  else node.textContent = text || "生成に失敗しました。";
  showModal("バイブコーディング ✨", node, [
    { label: "入力に戻る", primary: true, onClick: openVibeDialog },
    { label: "閉じる", onClick: closeModal },
  ]);
}

// 生成結果をエディタへ。
// - modify: 現在コードを直した版なので確認なしで反映（ユーザーが修正を明示）。
// - new: 未保存の編集があるときだけ置き換え確認する（サンプルと同じ作法）。
function applyVibeResult(code, mode) {
  const put = () => {
    cm.setValue(code);
    editorPristine = true;   // 生成直後は未編集あつかい
    currentName = "";
    // 表示中のビュー（Edit/Page）はそのまま維持する（自動でEditへは切り替えない）
    setStatus("バイブコーディングでコードを生成しました —「Run ▶」で表示できます", true);
    log("バイブコーディングでコードを生成しました。\n", "muted");
  };
  if (mode === "new" && !editorPristine) {
    const msg = document.createElement("div");
    msg.textContent = "生成したコードで今の内容を置き換えます。よろしいですか？（保存していない変更は消えます）";
    showModal("確認", msg, [
      { label: "置き換える", primary: true, onClick: () => { closeModal(); put(); } },
      { label: "やめる", onClick: closeModal },
    ]);
    return;
  }
  put();
}

$("vibe").addEventListener("click", openVibeDialog);

// --- 右パネルのタブ（センサー / リファレンス） -------------------------------------
const refview = $("refview");
const tabSensor = $("tab-sensor");
const tabRef = $("tab-ref");
let refBuilt = false;

function refItem(sig, doc) {
  const d = document.createElement("div");
  d.className = "ritem";
  const s = document.createElement("code");
  s.className = "rsig";
  s.textContent = sig;
  const p = document.createElement("span");
  p.className = "rdoc";
  p.textContent = doc;
  d.append(s, p);
  return d;
}

function buildReference() {
  const api = window.AKADAKO_BOARD_API || [];
  const statics = window.AKADAKO_STATICS || [];
  const findS = (n) => statics.find((a) => a.name === n);
  const findB = (n) => api.find((a) => a.name === n);

  // "await fetchTemperature()" に "board." を付けるとき、await が先頭に来るようにする
  const withPrefix = (prefix, sig) =>
    sig.startsWith("await ") ? "await " + prefix + sig.slice(6) : prefix + sig;

  const frag = document.createDocumentFragment();
  const note = document.createElement("div");
  note.className = "rnote";
  note.textContent =
    "fetch〜 と run〜 は await を付けて呼びます（async 関数の中で使います）。" +
    "エディタで board. / AkaDako. のあとに入力すると候補が出ます。";
  frag.append(note);

  function section(title, rows) {
    const valid = rows.filter(Boolean);
    if (!valid.length) return;
    const h = document.createElement("h4");
    h.textContent = title;
    frag.append(h);
    for (const [sig, doc] of valid) frag.append(refItem(sig, doc));
  }

  const connect = findS("connect");
  const disc = findB("disconnect");
  const isc = findB("isConnected");
  const ond = findB("onDisconnected");
  section("接続", [
    connect && [withPrefix("AkaDako.", connect.sig), connect.doc + "（最初に必ず実行）"],
    disc && [withPrefix("board.", disc.sig), disc.doc],
    isc && [withPrefix("board.", isc.sig), isc.doc],
    ond && [withPrefix("board.", ond.sig), ond.doc],
  ]);

  const used = new Set(["disconnect", "isConnected", "onDisconnected"]);
  const groups = [
    ["センサー（取得）", (a) => a.name.startsWith("fetch") &&
      !["fetchVersion", "fetchUid", "fetchI2cRead"].includes(a.name)],
    ["入力", (a) => a.name.startsWith("analog") || a.name.startsWith("digital") || a.name === "motionSensor"],
    ["カラーLED", (a) => a.name.startsWith("runColorLed")],
    ["通信（共有）", (a) => a.name.startsWith("runShare") || a.name === "sharedData" || a.name === "isShareServerConnected"],
    ["出力・動作", (a) => a.name.startsWith("run")],
    ["その他", () => true],
  ];
  for (const [title, pred] of groups) {
    const items = api.filter((a) => !used.has(a.name) && pred(a));
    items.forEach((a) => used.add(a.name));
    section(title, items.map((a) => [withPrefix("board.", a.sig), a.doc]));
  }

  section("定数・クラス (AkaDako.◯◯)",
    statics.filter((a) => a.name !== "connect").map((a) => [withPrefix("AkaDako.", a.sig), a.doc]));

  refview.innerHTML = "";
  refview.append(frag);
}

function showTab(which) {
  const ref = which === "ref";
  if (ref && !refBuilt) { buildReference(); refBuilt = true; }
  watchlist.hidden = ref;
  refview.hidden = !ref;
  monitorNote.hidden = ref || !monitorPaused || !board;
  tabSensor.classList.toggle("active", !ref);
  tabRef.classList.toggle("active", ref);
}
tabSensor.addEventListener("click", () => showTab("sensor"));
tabRef.addEventListener("click", () => showTab("ref"));

// --- 再アクセス時のドラフト復元 -----------------------------------------------------
(function maybeRestoreDraft() {
  const d = loadDraft();
  if (!d || !d.edited || !d.code || !d.code.trim()) return;
  const msg = document.createElement("div");
  msg.textContent =
    "前回編集していたコード" + (d.name ? "「" + d.name + "」" : "") +
    "が残っています。続きから編集しますか？";
  showModal("おかえりなさい", msg, [
    {
      label: "続きから", primary: true, onClick: () => {
        cm.setValue(d.code);
        currentName = d.name || "";
        editorPristine = false;
        closeModal();
        setStatus("前回のコードを復元しました", true);
      },
    },
    {
      label: "新規で始める", onClick: () => {
        clearDraft();
        editorPristine = true;
        closeModal();
      },
    },
  ]);
})();

log("準備完了。「Connect」でセンサーをグラフ表示、「Run ▶」でHTMLページを表示します。\n", "muted");
