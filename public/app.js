const state = {
  labels: [],
  images: [],
  currentIndex: -1,
  boxes: [],
  drawing: false,
  startDisplay: null,
  imageLabel: '',
  imageDescription: '',
};

const imageEl = document.getElementById('annotated-image');
const canvas = document.getElementById('draw-layer');
const ctx = canvas.getContext('2d');
const imageWrapper = document.getElementById('image-wrapper');
const imageStage = document.getElementById('image-stage');
const imageLabelSelect = document.getElementById('image-label-select');
const imageDescriptionInput = document.getElementById('image-description');
const labelInput = document.getElementById('label-input');
const inlineLabelInput = document.getElementById('inline-label-input');
const labelList = document.getElementById('label-list');
const boxStats = document.getElementById('box-stats');
const boxesList = document.getElementById('boxes-list');
const imageCounter = document.getElementById('image-counter');
const currentImageLabel = document.getElementById('current-image');
const statusEl = document.getElementById('status');

const startButton = document.getElementById('start-annotation');
const addLabelButton = document.getElementById('add-label');
const inlineAddLabelButton = document.getElementById('inline-add-label');
const prevButton = document.getElementById('prev-image');
const nextButton = document.getElementById('next-image');
const saveButton = document.getElementById('save-annotations');

function setStatus(message, tone = 'muted') {
  statusEl.textContent = message;
  statusEl.className = `status-${tone}`;
}

function toDisplay(n) {
  if (!imageEl.naturalWidth || !canvas.width) return 0;
  return (n * canvas.width) / imageEl.naturalWidth;
}

function toNatural(n) {
  if (!imageEl.naturalWidth || !canvas.width) return 0;
  return (n * imageEl.naturalWidth) / canvas.width;
}

function resizeCanvas() {
  if (!imageEl.complete || !imageEl.naturalWidth) return;
  const displayWidth = imageEl.naturalWidth;
  const displayHeight = imageEl.naturalHeight;

  imageStage.style.width = `${displayWidth}px`;
  imageStage.style.height = `${displayHeight}px`;
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;
  renderBoxes();
}

function addLabel(label) {
  const value = label.trim();
  if (!value || state.labels.includes(value)) {
    return;
  }
  state.labels.push(value);
  renderLabelList();
  renderBoxes();
  renderImageLabelSelect();
}

function renderLabelList() {
  labelList.innerHTML = '';
  state.labels.forEach((label) => {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = label;
    labelList.appendChild(pill);
  });
}

function loadImages() {
  fetch('/api/images')
    .then((res) => res.json())
    .then((data) => {
      state.images = data.images || [];
      imageCounter.textContent = `Images: ${state.images.length}`;
      if (!state.images.length) {
        setStatus('No images found in data folder.', 'warning');
      }
    })
    .catch(() => setStatus('Failed to load images from server.', 'warning'));
}

function startAnnotating() {
  if (!state.labels.length) {
    setStatus('Please add at least one label before starting.', 'warning');
    return;
  }
  if (!state.images.length) {
    setStatus('No images to annotate.', 'warning');
    return;
  }
  state.currentIndex = 0;
  loadImage();
}

function loadImage() {
  const filename = state.images[state.currentIndex];
  if (!filename) return;

  state.boxes = [];
  state.imageLabel = '';
  state.imageDescription = '';
  renderBoxes();
  renderImageLabelSelect();
  imageDescriptionInput.value = '';
  updateBoxStats(null);
  setStatus('Loading image...');

  imageEl.src = `/data/${filename}`;
  imageEl.onload = () => {
    resizeCanvas();
    setStatus('Click and drag on the image to draw a box.');
    currentImageLabel.textContent = `Current: ${filename}`;
  };
}

function renderBoxes() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const scaleX = canvas.width / imageEl.naturalWidth;
  const scaleY = canvas.height / imageEl.naturalHeight;
  state.boxes.forEach((box) => {
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
    ctx.fillRect(box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY);
  });
  renderBoxesList();
}

function renderBoxesList() {
  boxesList.innerHTML = '';
  if (!state.boxes.length) {
    boxesList.innerHTML = '<p class="hint">Draw boxes to see them listed here.</p>';
    updateBoxStats(null);
    return;
  }

  state.boxes.forEach((box) => {
    const card = document.createElement('div');
    card.className = 'box-card';

    const header = document.createElement('div');
    header.className = 'box-card-header';
    const title = document.createElement('h4');
    title.textContent = `Box #${box.id}`;
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'delete-btn';
    del.onclick = () => deleteBox(box.id);
    header.appendChild(title);
    header.appendChild(del);

    const coords = document.createElement('p');
    coords.textContent = `Center: (${box.cx.toFixed(1)}, ${box.cy.toFixed(1)}), Size: ${box.w.toFixed(1)} x ${box.h.toFixed(1)}`;

    const labelWrap = document.createElement('div');
    const select = document.createElement('select');
    state.labels.forEach((label) => {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = box.label || state.labels[0];
    select.onchange = (e) => {
      box.label = e.target.value;
      updateBoxStats(box);
    };
    labelWrap.appendChild(select);

    const descriptionInput = document.createElement('textarea');
    descriptionInput.rows = 2;
    descriptionInput.placeholder = 'Optional description for this box';
    descriptionInput.value = box.description || '';
    descriptionInput.oninput = (e) => {
      box.description = e.target.value;
    };

    card.onmouseenter = () => updateBoxStats(box);

    card.appendChild(header);
    card.appendChild(coords);
    card.appendChild(labelWrap);
    card.appendChild(descriptionInput);
    boxesList.appendChild(card);
  });

  updateBoxStats(state.boxes[state.boxes.length - 1]);
}

function updateBoxStats(box) {
  boxStats.innerHTML = '';
  if (!box) {
    boxStats.innerHTML = '<p>No box selected</p>';
    return;
  }
  const lines = [
    `Center: (${box.cx.toFixed(1)}, ${box.cy.toFixed(1)})`,
    `Width: ${box.w.toFixed(1)}`,
    `Height: ${box.h.toFixed(1)}`,
    `Label: ${box.label || 'Unassigned'}`,
    `Description: ${box.description ? box.description : 'None'}`,
  ];
  lines.forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    boxStats.appendChild(p);
  });
}

function deleteBox(id) {
  state.boxes = state.boxes.filter((b) => b.id !== id);
  renderBoxes();
}

function handleMouseDown(e) {
  if (!imageEl.naturalWidth) return;
  state.drawing = true;
  const rect = canvas.getBoundingClientRect();
  state.startDisplay = { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function handleMouseMove(e) {
  if (!state.drawing) return;
  const rect = canvas.getBoundingClientRect();
  const current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const width = current.x - state.startDisplay.x;
  const height = current.y - state.startDisplay.y;

  renderBoxes();
  ctx.setLineDash([6]);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(state.startDisplay.x, state.startDisplay.y, width, height);
  ctx.setLineDash([]);
}

function handleMouseUp(e) {
  if (!state.drawing) return;
  state.drawing = false;
  const rect = canvas.getBoundingClientRect();
  const end = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  const startX = Math.min(state.startDisplay.x, end.x);
  const startY = Math.min(state.startDisplay.y, end.y);
  const widthDisplay = Math.abs(end.x - state.startDisplay.x);
  const heightDisplay = Math.abs(end.y - state.startDisplay.y);

  if (widthDisplay < 2 || heightDisplay < 2) {
    renderBoxes();
    return;
  }

  const x = toNatural(startX);
  const y = toNatural(startY);
  const w = toNatural(widthDisplay);
  const h = toNatural(heightDisplay);
  const cx = x + w / 2;
  const cy = y + h / 2;

  const newBox = {
    id: Date.now(),
    x,
    y,
    w,
    h,
    cx,
    cy,
    label: state.labels[0] || '',
    description: '',
  };

  state.boxes.push(newBox);
  renderBoxes();
  updateBoxStats(newBox);
}

function saveAnnotations(onComplete) {
  if (state.currentIndex < 0) return;
  const filename = state.images[state.currentIndex];
  if (!filename) return;

  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename,
      boxes: state.boxes,
      imageLabel: state.imageLabel,
      imageDescription: state.imageDescription,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        setStatus(data.error, 'warning');
        return;
      }
      setStatus(`Saved annotations for ${filename}.`, 'success');
      if (onComplete) onComplete();
    })
    .catch(() => setStatus('Failed to save annotations.', 'warning'));
}

function goToImage(index) {
  if (index < 0 || index >= state.images.length) return;
  state.currentIndex = index;
  loadImage();
}

function setupListeners() {
  window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
  canvas.addEventListener('mouseleave', handleMouseUp);

  addLabelButton.addEventListener('click', () => {
    addLabel(labelInput.value);
    labelInput.value = '';
  });

  inlineAddLabelButton.addEventListener('click', () => {
    addLabel(inlineLabelInput.value);
    inlineLabelInput.value = '';
  });

  labelInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addLabelButton.click();
  });

  inlineLabelInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') inlineAddLabelButton.click();
  });

  imageLabelSelect.addEventListener('change', (e) => {
    state.imageLabel = e.target.value;
  });

  imageDescriptionInput.addEventListener('input', (e) => {
    state.imageDescription = e.target.value;
  });

  startButton.addEventListener('click', startAnnotating);

  prevButton.addEventListener('click', () => {
    saveAnnotations(() => goToImage(state.currentIndex - 1));
  });

  nextButton.addEventListener('click', () => {
    saveAnnotations(() => goToImage(state.currentIndex + 1));
  });

  saveButton.addEventListener('click', () => saveAnnotations());
}

function renderImageLabelSelect() {
  const currentValue = state.imageLabel;
  imageLabelSelect.innerHTML = '';

  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Unlabeled';
  imageLabelSelect.appendChild(defaultOption);

  state.labels.forEach((label) => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    imageLabelSelect.appendChild(option);
  });

  imageLabelSelect.value = currentValue || '';
}

function init() {
  setupListeners();
  loadImages();
  setStatus('Add labels to begin.');
  renderImageLabelSelect();
}

init();
