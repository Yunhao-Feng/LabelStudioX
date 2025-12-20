const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const RESULT_DIR = path.join(__dirname, 'result');

if (!fs.existsSync(RESULT_DIR)) {
  fs.mkdirSync(RESULT_DIR, { recursive: true });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(DATA_DIR));

const isImageFile = (file) => /\.(png|jpg|jpeg|bmp|gif)$/i.test(file);

app.get('/api/images', (req, res) => {
  fs.readdir(DATA_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read data directory' });
    }

    const images = files.filter(isImageFile).sort();
    res.json({ images });
  });
});

app.post('/api/save', (req, res) => {
  const { filename, boxes } = req.body || {};

  if (!filename || !Array.isArray(boxes)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const imagePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(imagePath)) {
    return res.status(400).json({ error: 'Image does not exist' });
  }

  const targetPath = path.join(RESULT_DIR, `${path.parse(filename).name}.json`);
  const payload = {
    image: filename,
    annotations: boxes.map((box) => ({
      label: box.label,
      center: { x: box.cx, y: box.cy },
      size: { width: box.w, height: box.h },
    })),
  };

  fs.writeFile(targetPath, JSON.stringify(payload, null, 2), (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to save annotations' });
    }
    res.json({ success: true, path: targetPath });
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LabelStudioX server running on http://localhost:${PORT}`);
});
