import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "2mb" }));

const port = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const APP_VERSION = "dashboard-v1";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function stripMarkdownEmphasis(text) {
  if (!text) return "";
  return String(text)
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/\*(.*?)\*/gs, "$1")
    .replace(/__(.*?)__/gs, "$1")
    .replace(/_(.*?)_/gs, "$1")
    .replace(/`{1,3}([\s\S]*?)`{1,3}/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "") // bullet markers
    .replace(/^\s*\d+\.\s+/gm, ""); // numbered list markers
}

function truncate(str, maxChars) {
  const s = String(str || "");
  return s.length > maxChars ? s.slice(0, maxChars) + "…" : s;
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>School Dashboard + AI (${APP_VERSION})</title>

    <style>
      :root{
        --bg: #f4f6f8;
        --card: #ffffff;
        --text: #1f2a37;
        --muted: #6b7280;
        --border: #e5e7eb;
        --nav: #1f2937;
        --nav2: #111827;
        --accent: #2563eb;
        --shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 20px rgba(0,0,0,.06);
        --radius: 14px;
        --font: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }

      *{ box-sizing: border-box; }
      body{
        margin: 0;
        font-family: var(--font);
        color: var(--text);
        background: var(--bg);
      }

      /* Layout */
      .app{
        min-height: 100vh;
        display: grid;
        grid-template-columns: 84px 1fr 340px;
      }

      /* Left sidebar */
      .sidebar{
        background: linear-gradient(180deg, var(--nav), var(--nav2));
        color: #fff;
        padding: 14px 10px;
        position: sticky;
        top: 0;
        height: 100vh;
      }
      .sideTop{
        display:flex;
        align-items:center;
        justify-content:center;
        gap: 10px;
        margin-bottom: 14px;
      }
      .avatar{
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: rgba(255,255,255,.16);
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight: 700;
      }
      .sideNav{
        display:flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 10px;
      }
      .navItem{
        display:flex;
        flex-direction: column;
        align-items:center;
        gap: 6px;
        padding: 10px 6px;
        border-radius: 14px;
        cursor: default;
        user-select: none;
        opacity: .92;
      }
      .navItem.active{
        background: rgba(255,255,255,.12);
        opacity: 1;
      }
      .navIcon{
        width: 34px;
        height: 34px;
        border-radius: 12px;
        background: rgba(255,255,255,.10);
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 16px;
      }
      .navLabel{
        font-size: 11px;
        line-height: 1.1;
        text-align:center;
        color: rgba(255,255,255,.9);
      }

      /* Main */
      .main{
        padding: 20px 22px 28px;
      }
      .topbar{
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 14px;
      }
      .titleWrap h1{
        margin: 0;
        font-size: 30px;
        letter-spacing: -0.02em;
      }
      .titleWrap .sub{
        margin-top: 6px;
        color: var(--muted);
        font-size: 13px;
      }

      .search{
        display:flex;
        gap: 10px;
        align-items:center;
      }
      .search input{
        width: min(440px, 42vw);
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: #fff;
        outline: none;
        font-size: 14px;
      }
      .pill{
        border: 1px solid var(--border);
        background: #fff;
        border-radius: 999px;
        padding: 8px 10px;
        font-size: 12px;
        color: var(--muted);
      }

      /* Course grid */
      .grid{
        display:grid;
        grid-template-columns: repeat(3, minmax(240px, 1fr));
        gap: 16px;
        align-items: start;
      }

      @media (max-width: 1200px){
        .app{ grid-template-columns: 84px 1fr; }
        .right{ display:none; }
      }
      @media (max-width: 860px){
        .grid{ grid-template-columns: repeat(2, minmax(220px, 1fr)); }
      }
      @media (max-width: 560px){
        .app{ grid-template-columns: 70px 1fr; }
        .main{ padding: 16px 14px 24px; }
        .grid{ grid-template-columns: 1fr; }
        .search input{ width: 60vw; }
      }

      .courseCard{
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        box-shadow: var(--shadow);
      }
      .courseBanner{
        height: 108px;
        position: relative;
        background: linear-gradient(135deg, rgba(37,99,235,.85), rgba(16,185,129,.70));
      }
      .courseBanner.alt1{ background: linear-gradient(135deg, rgba(99,102,241,.85), rgba(236,72,153,.65)); }
      .courseBanner.alt2{ background: linear-gradient(135deg, rgba(245,158,11,.85), rgba(244,63,94,.65)); }
      .courseBanner.alt3{ background: linear-gradient(135deg, rgba(20,184,166,.85), rgba(59,130,246,.65)); }
      .courseBanner.alt4{ background: linear-gradient(135deg, rgba(168,85,247,.85), rgba(34,197,94,.65)); }

      .courseBadge{
        position:absolute;
        right: 12px;
        top: 12px;
        background: rgba(255,255,255,.18);
        border: 1px solid rgba(255,255,255,.22);
        color: #fff;
        border-radius: 999px;
        font-size: 12px;
        padding: 6px 10px;
        backdrop-filter: blur(6px);
      }

      .courseBody{
        padding: 12px 14px 14px;
      }
      .courseTitle{
        font-weight: 700;
        margin: 0;
        font-size: 14.5px;
      }
      .courseMeta{
        margin-top: 6px;
        font-size: 12.5px;
        color: var(--muted);
      }
      .courseRow{
        display:flex;
        justify-content: space-between;
        align-items:center;
        margin-top: 12px;
        gap: 10px;
      }
      .miniIcons{
        display:flex;
        gap: 8px;
        color: var(--muted);
        font-size: 12px;
      }
      .miniIcons span{
        width: 28px;
        height: 28px;
        border-radius: 10px;
        border: 1px solid var(--border);
        display:flex;
        align-items:center;
        justify-content:center;
        background: #fff;
      }
      .notif{
        font-size: 12px;
        color: #fff;
        background: var(--accent);
        border-radius: 999px;
        padding: 4px 8px;
        font-weight: 600;
      }

      /* Right panel */
      .right{
        border-left: 1px solid var(--border);
        background: #fff;
        padding: 18px 16px;
        position: sticky;
        top: 0;
        height: 100vh;
        overflow:auto;
      }
      .panelTitle{
        font-size: 14px;
        font-weight: 800;
        margin: 0 0 10px;
      }
      .todoItem{
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px 10px;
        margin-bottom: 10px;
        background: #fff;
      }
      .todoTop{
        display:flex;
        align-items:flex-start;
        justify-content: space-between;
        gap: 10px;
      }
      .todoName{
        font-size: 13px;
        font-weight: 700;
        margin: 0;
      }
      .todoMeta{
        margin-top: 6px;
        font-size: 12px;
        color: var(--muted);
      }
      .x{
        color: #9ca3af;
        font-weight: 800;
        user-select:none;
      }
      .showAll{
        margin-top: 10px;
        color: var(--accent);
        font-size: 13px;
        font-weight: 700;
      }

      /* Bottom "do everything" section */
      .aiSection{
        grid-column: 1 / -1;
        margin-top: 16px;
        background: #fff;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        overflow: hidden;
      }
      .aiHeader{
        padding: 12px 14px;
        border-bottom: 1px solid var(--border);
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
      }
      .aiHeader h2{
        margin: 0;
        font-size: 16px;
      }
      .aiHeader .hint{
        color: var(--muted);
        font-size: 12px;
      }
      .aiBody{
        padding: 12px 14px 14px;
      }

      .chat{
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 12px;
        background: #fafafa;
        height: 240px;
        overflow:auto;
      }
      .msg{
        white-space: pre-wrap;
        line-height: 1.35;
        padding: 10px 12px;
        border-radius: 14px;
        border: 1px solid var(--border);
        margin: 8px 0;
        background: #fff;
      }
      .msg.user{ border-left: 4px solid #9ca3af; }
      .msg.ai{ border-left: 4px solid var(--accent); }

      .controls{
        margin-top: 10px;
      }
      textarea{
        width: 100%;
        padding: 10px 12px;
        font-size: 15px;
        line-height: 1.35;
        border-radius: 12px;
        border: 1px solid var(--border);
        resize: none;
        overflow:hidden;
        min-height: 44px;
        background: #fff;
        outline: none;
      }
      .row{
        display:flex;
        gap: 10px;
        margin-top: 10px;
        flex-wrap: wrap;
      }
      button{
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: #fff;
        cursor: pointer;
        font-weight: 700;
        font-size: 13px;
      }
      button.primary{
        background: var(--accent);
        color: #fff;
        border-color: rgba(0,0,0,0);
      }
      button:disabled{ opacity: .6; cursor: not-allowed; }

      details{
        margin-top: 10px;
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 10px 12px;
        background: #fff;
      }
      summary{ cursor: pointer; font-weight: 800; }
      .small{ color: var(--muted); font-size: 12px; margin: 6px 0 8px; }

      .footerNote{
        margin-top: 10px;
        color: var(--muted);
        font-size: 12px;
      }
    </style>
  </head>

  <body>
    <div class="app">
      <!-- LEFT SIDEBAR -->
      <aside class="sidebar">
        <div class="sideTop">
          <div class="avatar">A</div>
        </div>

        <div class="sideNav">
          <div class="navItem active">
            <div class="navIcon">🏠</div>
            <div class="navLabel">Dashboard</div>
          </div>
          <div class="navItem">
            <div class="navIcon">📚</div>
            <div class="navLabel">Courses</div>
          </div>
          <div class="navItem">
            <div class="navIcon">👥</div>
            <div class="navLabel">Groups</div>
          </div>
          <div class="navItem">
            <div class="navIcon">🗓️</div>
            <div class="navLabel">Calendar</div>
          </div>
          <div class="navItem">
            <div class="navIcon">📥</div>
            <div class="navLabel">Inbox</div>
          </div>
          <div class="navItem">
            <div class="navIcon">⏱️</div>
            <div class="navLabel">History</div>
          </div>
          <div class="navItem">
            <div class="navIcon">❓</div>
            <div class="navLabel">Help</div>
          </div>
        </div>
      </aside>

      <!-- MAIN -->
      <main class="main">
        <div class="topbar">
          <div class="titleWrap">
            <h1>Dashboard</h1>
            <div class="sub">Course cards + To Do • Your AI section is at the bottom</div>
          </div>

          <div class="search">
            <input id="search" placeholder="Search courses..." />
            <div class="pill">v: ${APP_VERSION}</div>
          </div>
        </div>

        <section class="grid" id="courseGrid"></section>

        <!-- BOTTOM "DO EVERYTHING" SECTION -->
        <section class="aiSection">
          <div class="aiHeader">
            <h2>School AI</h2>
            <div class="hint">Remembers chat only while this tab is open • Enter = send</div>
          </div>

          <div class="aiBody">
            <div class="chat" id="chat"></div>

            <div class="controls">
              <textarea id="q" placeholder="Type here… (Enter = send, Shift+Enter = new line)"></textarea>
              <div class="row">
                <button class="primary" id="send">Send</button>
                <button id="clearChat">Clear chat</button>
              </div>

              <details>
                <summary>Optional: Writing sample (paste a previous essay)</summary>
                <div class="small">
                  The AI will match your tone and sentence style, but it should NOT copy your sentences.
                  This stays only in this tab (sessionStorage).
                </div>
                <textarea id="style" placeholder="Paste writing sample here (optional)…"></textarea>
                <div class="row">
                  <button id="saveStyle">Save sample</button>
                  <button id="clearStyle">Clear sample</button>
                </div>
              </details>

              <div class="footerNote">
                Tip: If you want this to look MORE like your screenshot, change the course list and To Do list in the JS arrays.
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- RIGHT PANEL -->
      <aside class="right">
        <div class="panelTitle">To Do</div>
        <div id="todo"></div>
        <div class="showAll">Show All</div>
      </aside>
    </div>

    <script>
      // ====== Edit these to match your classes / assignments ======
      const courses = [
        { title: "Personal Finance - Gale - S2", sub: "Waynesville High School • 25-26/S2", banner: "alt3", badge: "S2", notif: 0 },
        { title: "Music Appreciation 1 - Tiefenbrun", sub: "Waynesville High School • 25-26/S2", banner: "alt1", badge: "S2", notif: 0 },
        { title: "Lifetime Sports - Sabala - S2", sub: "Waynesville High School • 25-26/S2", banner: "alt4", badge: "S2", notif: 0 },
        { title: "Language Arts 12 - FEIGHERY - S2", sub: "Waynesville High School • 25-26/S2", banner: "alt2", badge: "S2", notif: 0 },
        { title: "CIT 2025-2026 Spring", sub: "Waynesville Career Center • 25-26/S2", banner: "", badge: "CIT", notif: 5 },
        { title: "Math IV - CIT - Wessel - S2", sub: "Waynesville Career Center • 25-26/S2", banner: "alt1", badge: "Math", notif: 0 },
        { title: "WHS Student Resources 25-26", sub: "WHS • 25-26", banner: "alt3", badge: "WHS", notif: 15 },
        { title: "WHS Tigers Esports", sub: "ESP-101", banner: "alt4", badge: "ESP", notif: 0 },
      ];

      const todoItems = [
        { name: "CD - Global Spy Analysis (Phase II)", meta: "CIT 2025-2026 Spring • due Feb 20 at 11:59pm" },
        { name: "Characterization Juors", meta: "Language Arts 12 • due Feb 20 at 11:59pm" },
        { name: "Ella Fitzgerald", meta: "Music Appreciation 1 • due Feb 20 at 11:59pm" },
        { name: "Week #7 (Feb 17 - Feb 20)", meta: "Lifetime Sports • due Feb 20 at 11:59pm" },
      ];

      // ====== Render courses + todo ======
      const grid = document.getElementById("courseGrid");
      const todo = document.getElementById("todo");
      const search = document.getElementById("search");

      function courseCard(c, i){
        const bannerClass = c.banner ? "courseBanner " + c.banner : "courseBanner";
        return \`
          <article class="courseCard" data-title="\${c.title.toLowerCase()}">
            <div class="\${bannerClass}">
              <div class="courseBadge">\${c.badge}</div>
            </div>
            <div class="courseBody">
              <p class="courseTitle">\${c.title}</p>
              <div class="courseMeta">\${c.sub}</div>
              <div class="courseRow">
                <div class="miniIcons" aria-hidden="true">
                  <span>📄</span><span>💬</span><span>📌</span>
                </div>
                \${c.notif ? \`<div class="notif">\${c.notif}</div>\` : "<div></div>"}
              </div>
            </div>
          </article>
        \`;
      }

      function renderCourses(filter=""){
        grid.innerHTML = "";
        const f = filter.trim().toLowerCase();
        for (let i=0;i<courses.length;i++){
          const c = courses[i];
          if (f && !c.title.toLowerCase().includes(f)) continue;
          grid.insertAdjacentHTML("beforeend", courseCard(c, i));
        }
      }

      function renderTodo(){
        todo.innerHTML = "";
        for (const t of todoItems){
          todo.insertAdjacentHTML("beforeend", \`
            <div class="todoItem">
              <div class="todoTop">
                <div>
                  <div class="todoName">\${t.name}</div>
                  <div class="todoMeta">\${t.meta}</div>
                </div>
                <div class="x">×</div>
              </div>
            </div>
          \`);
        }
      }

      renderCourses();
      renderTodo();

      search.addEventListener("input", () => renderCourses(search.value));

      // ====== AI Section: session-only memory + writing sample ======
      const chatEl = document.getElementById("chat");
      const qEl = document.getElementById("q");
      const styleEl = document.getElementById("style");
      const sendBtn = document.getElementById("send");
      const clearChatBtn = document.getElementById("clearChat");
      const saveStyleBtn = document.getElementById("saveStyle");
      const clearStyleBtn = document.getElementById("clearStyle");

      const KEY_MSGS = "msgs";
      const KEY_STYLE = "styleSample";

      function loadMsgs(){
        try { return JSON.parse(sessionStorage.getItem(KEY_MSGS) || "[]"); }
        catch { return []; }
      }
      function saveMsgs(msgs){
        sessionStorage.setItem(KEY_MSGS, JSON.stringify(msgs));
      }
      function loadStyle(){
        return sessionStorage.getItem(KEY_STYLE) || "";
      }
      function saveStyle(s){
        sessionStorage.setItem(KEY_STYLE, s || "");
      }

      function autoGrow(el){
        el.style.height = "auto";
        const max = 220;
        el.style.height = Math.min(el.scrollHeight, max) + "px";
      }

      function addBubble(role, content){
        const div = document.createElement("div");
        div.className = "msg " + (role === "user" ? "user" : "ai");
        div.textContent = content;
        chatEl.appendChild(div);
        chatEl.scrollTop = chatEl.scrollHeight;
      }

      function renderChat(){
        chatEl.innerHTML = "";
        const msgs = loadMsgs();
        for (const m of msgs) addBubble(m.role, m.content);
      }

      async function send(){
        const text = qEl.value.trim();
        if (!text) return;

        const msgs = loadMsgs();
        msgs.push({ role: "user", content: text });
        saveMsgs(msgs);
        addBubble("user", text);

        qEl.value = "";
        autoGrow(qEl);
        sendBtn.disabled = true;

        try{
          const styleSample = loadStyle();

          const r = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ messages: msgs, styleSample })
          });

          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "Request failed");

          const answer = data.answer || "(no answer)";
          const msgs2 = loadMsgs();
          msgs2.push({ role: "assistant", content: answer });
          saveMsgs(msgs2);
          addBubble("assistant", answer);
        }catch(e){
          addBubble("assistant", "Error: " + e.message);
        }finally{
          sendBtn.disabled = false;
          qEl.focus();
        }
      }

      sendBtn.onclick = send;
      qEl.addEventListener("input", () => autoGrow(qEl));
      qEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey){
          e.preventDefault();
          send();
        }
      });

      clearChatBtn.onclick = () => {
        sessionStorage.removeItem(KEY_MSGS);
        renderChat();
        qEl.focus();
      };

      function syncStyleUI(){
        styleEl.value = loadStyle();
        autoGrow(styleEl);
      }
      styleEl.addEventListener("input", () => autoGrow(styleEl));

      saveStyleBtn.onclick = () => {
        saveStyle(styleEl.value || "");
        addBubble("assistant", "Saved writing sample for this tab session.");
      };

      clearStyleBtn.onclick = () => {
        saveStyle("");
        styleEl.value = "";
        autoGrow(styleEl);
        addBubble("assistant", "Cleared writing sample.");
      };

      renderChat();
      syncStyleUI();
      autoGrow(qEl);
      qEl.focus();
    </script>
  </body>
</html>`;

app.get("/", (req, res) => res.type("html").send(html));

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Missing OPENAI_API_KEY on the server (Render → Environment Variables)."
      });
    }

    let messages = req.body?.messages;
    if (!Array.isArray(messages)) messages = [];

    // keep it lightweight
    const MAX_TURNS = 30;
    if (messages.length > MAX_TURNS) messages = messages.slice(messages.length - MAX_TURNS);

    messages = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: truncate(m.content, 4000) }));

    const rawStyle = typeof req.body?.styleSample === "string" ? req.body.styleSample : "";
    const styleSample = truncate(rawStyle, 8000);

    const instructions = [
      "Reply in plain text only. Do not use Markdown. Do not use **bold**, *italics*, headings, or special formatting.",
      "Be clear and helpful for a student. Explain steps and reasoning.",
      styleSample
        ? "Mimic the user's writing style based on the provided sample: match tone, vocabulary level, and sentence length. Do NOT copy sentences or phrases from the sample."
        : ""
    ].filter(Boolean).join("\n");

    const input = messages.map((m) => ({ role: m.role, content: m.content }));

    if (styleSample) {
      input.unshift({
        role: "user",
        content: `WRITING STYLE SAMPLE (tone only, do not copy):\n${styleSample}`
      });
    }

    const response = await client.responses.create({
      model: MODEL,
      instructions,
      input
    });

    const clean = stripMarkdownEmphasis(response.output_text || "");
    res.json({ answer: clean });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.listen(port, () => console.log("Running on port " + port));
