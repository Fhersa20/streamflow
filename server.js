const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));
app.use("/media", express.static("media"));

const apiFile = path.join(__dirname, "apikeys.json");

// ===== Fungsi API Key =====
function loadApiKeys() {
  if (!fs.existsSync(apiFile)) return [];
  return JSON.parse(fs.readFileSync(apiFile));
}

function saveApiKeys(keys) {
  fs.writeFileSync(apiFile, JSON.stringify(keys, null, 2));
}

function authenticateApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  const apiKeys = loadApiKeys();
  const user = apiKeys.find((k) => k.key === key);

  if (!user) return res.status(403).json({ error: "Unauthorized" });

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Hanya admin yang bisa melakukan ini" });
  }
  next();
}

// ===== Upload Media =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "media/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ===== Endpoint =====

// Login pakai API Key
app.post("/login", (req, res) => {
  const { apiKey } = req.body;
  const apiKeys = loadApiKeys();
  const user = apiKeys.find((k) => k.key === apiKey);

  if (!user) return res.status(403).json({ error: "API Key tidak valid" });

  res.json({ message: "Login berhasil", role: user.role });
});

// List media
app.get("/media", authenticateApiKey, (req, res) => {
  const files = fs.readdirSync("media/");
  res.json(files);
});

// Upload media
app.post("/media/upload", authenticateApiKey, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ message: "File uploaded", file: req.file.filename });
});

// Delete media
app.delete("/media/delete/:filename", authenticateApiKey, requireAdmin, (req, res) => {
  const filePath = path.join(__dirname, "media", req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File tidak ditemukan" });

  fs.unlinkSync(filePath);
  res.json({ message: "File berhasil dihapus" });
});

// Manajemen API Key (Admin Only)
app.get("/apikeys", authenticateApiKey, requireAdmin, (req, res) => {
  res.json(loadApiKeys());
});

app.post("/apikeys/add", authenticateApiKey, requireAdmin, (req, res) => {
  const { newKey, role } = req.body;
  if (!newKey || !role) return res.status(400).json({ error: "Key & role wajib diisi" });

  const apiKeys = loadApiKeys();
  if (apiKeys.find((k) => k.key === newKey)) return res.status(400).json({ error: "Key sudah ada" });

  apiKeys.push({ key: newKey, role });
  saveApiKeys(apiKeys);
  res.json({ message: "API Key ditambahkan", keys: apiKeys });
});

app.delete("/apikeys/delete/:key", authenticateApiKey, requireAdmin, (req, res) => {
  let apiKeys = loadApiKeys();
  if (!apiKeys.find((k) => k.key === req.params.key)) return res.status(404).json({ error: "Key tidak ditemukan" });

  apiKeys = apiKeys.filter((k) => k.key !== req.params.key);
  saveApiKeys(apiKeys);
  res.json({ message: "API Key dihapus", keys: apiKeys });
});

// ===== Jalankan Server =====
if (!fs.existsSync("media")) fs.mkdirSync("media");

app.listen(PORT, () => {
  console.log(`✅ StreamFlow running on http://localhost:${PORT}`);
});
