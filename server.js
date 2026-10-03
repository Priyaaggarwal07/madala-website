const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

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
function removeUploadedFile(filePath) {
  fs.unlink(filePath, error => {
    if (error && error.code !== 'ENOENT') {
      console.error('Could not remove uploaded image:', error.message);
    }
  });
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
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

// ---------- API ----------

// List every painting
app.get('/api/paintings', (req, res) => {
  res.json(readPaintings());
});

// Add a new painting (admin only — passcode + image required)
app.post('/api/paintings', upload.single('image'), (req, res) => {
  const { title, desc, price, size, passcode } = req.body;

  if (passcode !== ADMIN_PASSCODE) {
    if (req.file) removeUploadedFile(req.file.path);
    return res.status(401).json({ error: 'Wrong passcode.' });
  }
  if (!title || !String(title).trim() || price === undefined || String(price).trim() === '' || !req.file) {
    if (req.file) removeUploadedFile(req.file.path);
    return res.status(400).json({ error: 'Title, price, and a photo are all required.' });
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0) {
    removeUploadedFile(req.file.path);
    return res.status(400).json({ error: 'Price must be a valid number.' });
  }
  if (String(title).trim().length > 120 || String(desc || '').length > 1000 || String(size || '').length > 80) {
    removeUploadedFile(req.file.path);
    return res.status(400).json({ error: 'Title, description, or size is too long.' });
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

// Update painting details and optionally replace its photo (admin only)
app.put('/api/paintings/:id', upload.single('image'), (req, res) => {
  const { title, desc, price, size, passcode } = req.body;

  if (passcode !== ADMIN_PASSCODE) {
    if (req.file) removeUploadedFile(req.file.path);
    return res.status(401).json({ error: 'Wrong passcode.' });
  }
  if (!title || !String(title).trim() || price === undefined || String(price).trim() === '') {
    if (req.file) removeUploadedFile(req.file.path);
    return res.status(400).json({ error: 'Title and price are required.' });
  }
  if (!Number.isFinite(Number(price)) || Number(price) < 0) {
    if (req.file) removeUploadedFile(req.file.path);
    return res.status(400).json({ error: 'Price must be a valid number.' });
  }
  if (String(title).trim().length > 120 || String(desc || '').length > 1000 || String(size || '').length > 80) {
    if (req.file) removeUploadedFile(req.file.path);
    return res.status(400).json({ error: 'Title, description, or size is too long.' });
  }

  const paintings = readPaintings();
  const index = paintings.findIndex(painting => painting.id === req.params.id);
  if (index === -1) {
    if (req.file) removeUploadedFile(req.file.path);
    return res.status(404).json({ error: 'Painting not found.' });
  }

  const current = paintings[index];
  const updatedPainting = {
    ...current,
    title: String(title).trim(),
    desc: String(desc || '').trim(),
    price: Number(price),
    size: String(size || '').trim()
  };
  if (req.file) updatedPainting.image = '/uploads/' + req.file.filename;
  paintings[index] = updatedPainting;
  writePaintings(paintings);

  if (req.file && current.image && current.image.startsWith('/uploads/')) {
    removeUploadedFile(path.join(UPLOADS_DIR, path.basename(current.image)));
  }
  res.json(updatedPainting);
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
    removeUploadedFile(path.join(UPLOADS_DIR, path.basename(target.image)));
  }
  res.json({ ok: true });
});

// Check a passcode without adding/deleting anything (used to unlock the upload form)
app.post('/api/admin/login', (req, res) => {
  const { passcode } = req.body || {};
  if (passcode === ADMIN_PASSCODE) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: 'Wrong passcode.' });
});

// Friendly error messages for upload problems (file too big, wrong type, etc.)
app.use((err, req, res, next) => {
  const status = err.status || (err instanceof multer.MulterError || err.message === 'Only image files are allowed' ? 400 : 500);
  if (status >= 500) console.error('Request failed:', err);
  res.status(status).json({
    error: status >= 500 ? 'The server could not complete the request.' : err.message || 'Upload failed.'
  });
});

app.listen(PORT, () => {
  console.log(`Mandala Kala server running at http://localhost:${PORT}`);
  console.log(`Admin passcode: ${ADMIN_PASSCODE}`);
});
