import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

// Render provides PORT automatically
const port = process.env.PORT || 3000;

// Change this anytime to visually confirm your deploy updated
const APP_VERSION = "v2";

// Pick a default model that works with the Responses API.
// You can override in Render Environment Variables with OPENAI_MODEL.
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple 1-page website (textarea wraps + auto-grows, nicer font)
const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Canvas ${APP_VERSION}</title>

    <!-- Optional font (falls back to system if blocked) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">

    <style>
      :root{
        --font: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      body{
        font-family: var(--font);
        margin: 24px;
        max-width: 900px;
      }
      h2{ margin: 0 0 12px; }
      .muted{ color:#666; font-size: 12px; margin-top: 6px; }
      .box{
        border: 1px solid #ddd;
        padding: 16px;
        border-radius: 12px;
      }
      textarea{
        width: 100%;
        padding: 10px 12px;
        font-size: 16px;
        line-height: 1.35;
        border-radius: 10px;
        border: 1px solid #ccc;
        resize: none;     /* auto-grow handles height */
        overflow: hidden; /* no scrollbar while growing */
        min-height: 44px;
      }
      button{
        padding: 10px 14px;
        font-size: 16px;
        border-radius: 10px;
        border: 1px solid #ccc;
        cursor: pointer;
        background: #f7f7f7;
      }
      .row{
        display:flex;
        gap:10px;
        margin-top:10px;
        align-items:center;
      }
      pre{
        white-space: pre-wrap;
        background: #f4f4f4;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid #e5e5e5;
      }
      .tip{
        color:#666;
        font-size: 13px;
        margin-top: 8px;
      }
    </style>
  </head>

  <body>
    <h2>My School AI <span class="muted">(${APP_VERSION})</span></h2>

    <div class="box">
      <textarea id="q" placeholder="Type your question… (Enter = send, Shift+Enter = new line)"></textarea>
      <div class="row">
        <button id="ask">Ask</button>
        <button id="clear">Clear</button>
      </div>
      <div class="tip">Enter to send • Shift+Enter for a new line</div>
    </div>

    <h3>Answer</h3>
    <pre id="a">...</pre>

    <script>
      const q = document.getElementById("q");
      const a = document.getElementById("a");
      const askBtn = document.getElementById("ask");
      const clearBtn = document.getElementById("clear");

      function autoGrow(el) {
        el.style.height = "auto";
        const max = 240; // cap so it doesn't take over the page
        el.style.height = Math.min(el.scrollHeight, max) + "px";
      }

      async function ask() {
        const text = q.value.trim();
        if (!text) return;

        a.textContent = "Thinking...";

        try {
          const r = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: text })
          });

          const data = await r.json();
          if (!r.ok) throw new Error(data.error || "Request failed");
          a.textContent = data.answer || "(no answer)";
        } catch (e) {
          a.textContent = "Error: " + e.message;
        }
      }

      askBtn.onclick = ask;

      clearBtn.onclick = () => {
        q.value = "";
        a.textContent = "...";
        autoGrow(q);
        q.focus();
      };

      q.addEventListener("input", () => autoGrow(q));

      q.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          ask();
        }
      });

      autoGrow(q);
      q.focus();
    </script>
  </body>
</html>`;

app.get("/", (req, res) => res.type("html").send(html));

// Tiny API endpoint
app.post("/api/ask", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on the server (Render Environment Variables)." });
    }

    const q = req.body?.q;
    if (typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "Send { q: \"your question\" }" });
    }

    const response = await client.responses.create({
      model: MODEL,
      // Keep it simple (you can customize instructions later)
      instructions: "Answer clearly and helpfully for a student. If asked to do a graded assignment, help with explanation and steps rather than a final submission.",
      input: q.trim()
    });

    res.json({ answer: response.output_text || "" });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.listen(port, () => console.log(`Running on port ${port}`));
