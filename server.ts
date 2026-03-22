import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("diary.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    content TEXT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    mood TEXT,
    mood_emoji TEXT,
    weather TEXT,
    image_data TEXT
  )
`);

// Migration for existing databases
try {
  db.prepare("ALTER TABLE entries ADD COLUMN mood_emoji TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE entries ADD COLUMN weather TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE entries ADD COLUMN image_data TEXT").run();
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images

  // API Routes
  app.get("/api/weather", async (req, res) => {
    try {
      const response = await fetch('https://wttr.in?format=%c+%t');
      const text = await response.text();
      res.send(text);
    } catch (error) {
      res.status(500).send("Error fetching weather");
    }
  });

  app.get("/api/entries", (req, res) => {
    const entries = db.prepare("SELECT * FROM entries ORDER BY date DESC").all();
    res.json(entries);
  });

  app.post("/api/entries", (req, res) => {
    const { title, content, mood, mood_emoji, weather, image_data } = req.body;
    const info = db.prepare("INSERT INTO entries (title, content, mood, mood_emoji, weather, image_data) VALUES (?, ?, ?, ?, ?, ?)").run(title, content, mood, mood_emoji, weather, image_data);
    const newEntry = db.prepare("SELECT * FROM entries WHERE id = ?").get(info.lastInsertRowid);
    res.json(newEntry);
  });

  app.put("/api/entries/:id", (req, res) => {
    const { id } = req.params;
    const { title, content, mood, mood_emoji, weather, image_data } = req.body;
    db.prepare("UPDATE entries SET title = ?, content = ?, mood = ?, mood_emoji = ?, weather = ?, image_data = ? WHERE id = ?").run(title, content, mood, mood_emoji, weather, image_data, id);
    const updatedEntry = db.prepare("SELECT * FROM entries WHERE id = ?").get(id);
    res.json(updatedEntry);
  });

  app.delete("/api/entries/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM entries WHERE id = ?").run(id);
    res.sendStatus(204);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
