const { exec } = require('child_process');

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 👉 重要：区分运行目录和代码目录
const BASE_DIR = process.cwd();        // exe 所在目录
const APP_DIR = __dirname;             // snapshot / 源码目录

const DATA_DIR = path.join(BASE_DIR, 'data');
const RESULT_DIR = path.join(BASE_DIR, 'result');

// 确保目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(RESULT_DIR)) {
  fs.mkdirSync(RESULT_DIR, { recursive: true });
}

app.use(express.json({ limit: '10mb' }));

// 前端资源（打包进 exe）
app.use(express.static(path.join(APP_DIR, 'public')));

// 图片数据（exe 同级 data 目录）
app.use('/data', express.static(DATA_DIR));

const isImageFile = (file) =>
  /\.(png|jpg|jpeg|bmp|gif)$/i.test(file);

// 获取图片列表
app.get('/api/images', (req, res) => {
  fs.readdir(DATA_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read data directory' });
    }
    const images = files.filter(isImageFile).sort();
    res.json({ images });
  });
});

// 保存标注结果
app.post('/api/save', (req, res) => {
  const { filename, boxes } = req.body || {};

  if (!filename || !Array.isArray(boxes)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const imagePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(imagePath)) {
    return res.status(400).json({ error: 'Image does not exist' });
  }

  const targetPath = path.join(
    RESULT_DIR,
    `${path.parse(filename).name}.json`
  );

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
    res.json({ success: true });
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`LabelStudioX running at ${url}`);

  // Windows 原生方式打开浏览器
  exec(`start "" "${url}"`);
});
