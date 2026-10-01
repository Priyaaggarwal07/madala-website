const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_COOKIE_NAME = 'mandala_admin_session';
const ADMIN_SESSIONS = new Map();

function getLocalIpAddress() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const DATA_FILE = path.join(__dirname, 'data', 'paintings.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Change this, then restart the server. This is a simple shared
// passcode, not a real login system — fine for one shop owner,
// not meant to protect anything sensitive.
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'mandala123';

// ---------- make sure folders/files exist ----------
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function readPaintings() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Could not read paintings.json, starting empty:', e.message);
    return [];
  }
}
function writePaintings(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

function parseCookies(header = '') {
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function createAdminSession() {
  const token = crypto.randomBytes(24).toString('hex');
  ADMIN_SESSIONS.set(token, Date.now() + 60 * 60 * 1000);
  return token;
}

function isValidAdminSession(token) {
  if (!token || !ADMIN_SESSIONS.has(token)) return false;
  const expiresAt = ADMIN_SESSIONS.get(token);
  if (Date.now() > expiresAt) {
    ADMIN_SESSIONS.delete(token);
    return false;
  }
  return true;
}

function clearAdminSession(token) {
  if (token) ADMIN_SESSIONS.delete(token);
}

// ---------- image upload handling ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeExt = /^\.(jpe?g|png|webp|gif)$/i.test(ext) ? ext : '.jpg';
    cb(null, `p_${Date.now()}_${Math.round(Math.random() * 1e6)}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per image
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  }
});

app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/customer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- API ----------

// List every painting
app.get('/api/paintings', (req, res) => {
  res.json(readPaintings());
});

// Add a new painting (admin only — passcode + image required)
app.post('/api/paintings', upload.single('image'), (req, res) => {
  const { title, desc, price, size, passcode } = req.body;

  if (passcode !== ADMIN_PASSCODE) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(401).json({ error: 'Wrong passcode.' });
  }
  if (!title || !price || !req.file) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Title, price, and a photo are all required.' });
  }
  if (isNaN(Number(price)) || Number(price) < 0) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Price must be a valid number.' });
  }

  const paintings = readPaintings();
  const newPainting = {
    id: 'p_' + Date.now(),
    title: String(title).trim(),
    desc: String(desc || '').trim(),
    price: Number(price),
    size: String(size || '').trim(),
    image: '/uploads/' + req.file.filename,
    createdAt: Date.now()
  };
  paintings.push(newPainting);
  writePaintings(paintings);
  res.status(201).json(newPainting);
});

// Remove a painting (admin only)
app.delete('/api/paintings/:id', (req, res) => {
  const { passcode } = req.body || {};
  if (passcode !== ADMIN_PASSCODE) {
    return res.status(401).json({ error: 'Wrong passcode.' });
  }

  const paintings = readPaintings();
  const target = paintings.find(p => p.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: 'Painting not found.' });
  }

  writePaintings(paintings.filter(p => p.id !== req.params.id));

  // Clean up the stored image file too, if it's one we saved (not a sample data-URI image)
  if (target.image && target.image.startsWith('/uploads/')) {
    fs.unlink(path.join(__dirname, target.image), () => {});
  }
  res.json({ ok: true });
});

// Check a passcode without adding/deleting anything (used to unlock the upload form)
app.post('/api/admin/login', (req, res) => {
  const { passcode } = req.body || {};
  if (passcode !== ADMIN_PASSCODE) {
    return res.status(401).json({ ok: false });
  }

  const token = createAdminSession();
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
  return res.json({ ok: true, expiresIn: 3600 });
});

app.post('/api/admin/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[ADMIN_COOKIE_NAME];
  clearAdminSession(token);
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res.json({ ok: true });
});

app.get('/api/admin/verify', (req, res) => {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[ADMIN_COOKIE_NAME];
  return res.json({ ok: isValidAdminSession(token) });
});

// Friendly error messages for upload problems (file too big, wrong type, etc.)
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  }
  next();
});

app.listen(PORT, HOST, () => {
  const localIp = getLocalIpAddress();
  console.log(`Mandala Kala server running at http://localhost:${PORT}`);
  console.log(`Network access: http://${localIp}:${PORT}`);
  console.log(`Admin URL: http://${localIp}:${PORT}/admin`);
  console.log(`Admin passcode: ${ADMIN_PASSCODE}`);
});
