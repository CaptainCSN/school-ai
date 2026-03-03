import "dotenv/config";
import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const MODEL = "gpt-5-mini";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>My School AI</title>
    <style>
      body{font-family:system-ui,Arial;margin:20px;max-width:800px}
      input{width:100%;padding:10px;font-size:16px}
      button{margin-top:10px;padding:10px 14px;font-size:16px}
      pre{white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:8px}
      .row{display:flex;gap:10px}
    </style>
  </head>
  <body>
    <h2>My School AI</h2>
    <input id="q" placeholder="Type a question and press Enter..." />
    <div class="row">
      <button id="ask">Ask</button>
      <button id="clear">Clear</button>
    </div>
    <h3>Answer</h3>
    <pre id="a">...</pre>

    <script>
      const q = document.getElementById("q");
      const a = document.getElementById("a");
      const askBtn = document.getElementById("ask");
      const clearBtn = document.getElementById("clear");

      async function ask() {
        const text = q.value.trim();
        if (!text) return;
        a.textContent = "Thinking...";

        try {
          const r = await fetch("/api/ask", {
            method: "POST",
            headers: {"Content-Type":"application/json"},
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
      clearBtn.onclick = () => { q.value = ""; a.textContent = "..."; q.focus(); };
      q.addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });

      q.focus();
    </script>
  </body>
</html>`;

app.get("/", (req, res) => res.type("html").send(html));

app.post("/api/ask", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on the server." });
    }

    const q = req.body?.q;
    if (typeof q !== "string" || !q.trim()) {
      return res.status(400).json({ error: "Send { q: \"your question\" }" });
    }

    const response = await client.responses.create({
      model: MODEL,
      input: q.trim()
    });

    res.json({ answer: response.output_text || "" });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

app.listen(port, () => console.log("Running on http://localhost:" + port));