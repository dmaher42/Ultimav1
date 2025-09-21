// server.js - Express server that proxies NPC dialogue to OpenAI or a local mock.
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');

// Node 18 exposes fetch globally; keep a tiny fallback for older runtimes.
const fetchFn = global.fetch || ((...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)));

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const fsPromises = fs.promises;

const SPRITE_UPLOAD_DIR = path.join(__dirname, 'assets', 'sprites');
const SPRITE_PATHS = [
  { dir: SPRITE_UPLOAD_DIR, urlBase: '/assets/sprites' },
  { dir: path.join(__dirname, 'assets'), urlBase: '/assets' },
  { dir: path.join(__dirname, 'public', 'assets', 'sprites'), urlBase: '/assets/sprites' },
  { dir: path.join(__dirname, 'public', 'assets'), urlBase: '/assets' }
];
const ALLOWED_SPRITE_EXTS = new Set(['.png', '.jpg', '.jpeg']);
const MAX_SPRITE_SIZE = 5 * 1024 * 1024;

fs.mkdirSync(SPRITE_UPLOAD_DIR, { recursive: true });

const ITEM_CATALOG = [
  { id: 'flour', name: 'Bag of Flour' },
  { id: 'water', name: 'Bucket of Water' },
  { id: 'flourPile', name: 'Pile of Flour' },
  { id: 'dough', name: 'Bread Dough' },
  { id: 'loaf', name: 'Fresh Loaf' }
];

const QUEST_CATALOG = [
  {
    id: 'bakers_helper',
    name: "Baker's Helper",
    stages: ['Ask the baker about work.', 'Bake a loaf together.', 'Deliver the bread.']
  },
  {
    id: 'morning_customers',
    name: 'Morning Customers',
    stages: ['Prepare stock for the stall.', 'Sell a loaf to the first guest.']
  }
];

const ALLOWED_ACTIONS = ['set_flag', 'give_item', 'start_quest', 'advance_quest', 'set_waypoint'];

function sanitizeSpriteBasename(raw) {
  if (!raw) return 'sprite';
  const normalized = String(raw)
    .replace(/[^a-z0-9_\-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  const truncated = normalized.slice(0, 64);
  return truncated || 'sprite';
}

function determineSpriteExtension(file) {
  if (!file) return '.png';
  const originalExt = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_SPRITE_EXTS.has(originalExt)) {
    return originalExt;
  }
  const mime = (file.mimetype || '').toLowerCase();
  if (mime === 'image/png') return '.png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  return originalExt;
}

function buildSpriteUrl(base, name) {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${name}`.replace(/\\/g, '/');
}

async function listSprites() {
  const seen = new Map();
  for (const entry of SPRITE_PATHS) {
    let dirEntries;
    try {
      dirEntries = await fsPromises.readdir(entry.dir, { withFileTypes: true });
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn(`Failed to read sprite directory ${entry.dir}:`, err.message);
      }
      continue;
    }
    for (const dirent of dirEntries) {
      if (!dirent.isFile()) continue;
      const ext = path.extname(dirent.name).toLowerCase();
      if (!ALLOWED_SPRITE_EXTS.has(ext)) continue;
      if (!seen.has(dirent.name)) {
        seen.set(dirent.name, {
          name: dirent.name,
          url: buildSpriteUrl(entry.urlBase, dirent.name)
        });
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

const spriteStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SPRITE_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = file._spriteExt || determineSpriteExtension(file) || '.png';
    const safeExt = ALLOWED_SPRITE_EXTS.has(ext) ? ext : '.png';
    const originalBase = path.basename(file.originalname || 'sprite', path.extname(file.originalname || ''));
    const base = sanitizeSpriteBasename(originalBase);
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${base}-${uniqueSuffix}${safeExt}`);
  }
});

const upload = multer({
  storage: spriteStorage,
  limits: { fileSize: MAX_SPRITE_SIZE },
  fileFilter: (req, file, cb) => {
    const ext = determineSpriteExtension(file);
    if (!ALLOWED_SPRITE_EXTS.has(ext)) {
      cb(new Error('Only PNG or JPG sprite sheets are supported.'));
      return;
    }
    file._spriteExt = ext;
    cb(null, true);
  }
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use('/public', express.static(PUBLIC_DIR));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(PUBLIC_DIR));

app.get('/api/sprites', async (req, res) => {
  try {
    const sprites = await listSprites();
    res.json({ sprites });
  } catch (err) {
    console.error('Failed to list sprites:', err);
    res.status(500).json({ error: 'Failed to list sprites.' });
  }
});

app.post('/api/upload-sprite', (req, res) => {
  upload.single('sprite')(req, res, async (err) => {
    if (err) {
      console.error('Sprite upload failed:', err);
      const status = err instanceof multer.MulterError ? 400 : 500;
      return res.status(status).json({ error: err.message || 'Failed to upload sprite.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No sprite file uploaded.' });
    }

    try {
      const sprites = await listSprites();
      res.json({
        ok: true,
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: buildSpriteUrl('/assets/sprites', req.file.filename),
        sprites
      });
    } catch (listErr) {
      console.error('Sprite list refresh failed:', listErr);
      res.json({
        ok: true,
        filename: req.file.filename,
        originalName: req.file.originalname,
        url: buildSpriteUrl('/assets/sprites', req.file.filename)
      });
    }
  });
});

app.post('/npc', async (req, res) => {
  const snapshot = req.body;
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.npc_id) {
    return res.status(400).json({ error: 'Invalid snapshot payload.' });
  }

  try {
    let payload;
    if (!process.env.OPENAI_API_KEY) {
      payload = buildMockResponse(snapshot);
    } else {
      payload = await callOpenAI(snapshot);
    }

    if (!isValidPayload(payload)) {
      throw new Error('Model returned an unexpected structure.');
    }

    res.json(payload);
  } catch (err) {
    console.error('Dialogue error:', err.message);
    res.status(500).json({ error: 'Failed to prepare dialogue.' });
  }
});

function isValidPayload(payload) {
  if (!payload || typeof payload.dialogue !== 'string' || !Array.isArray(payload.actions)) {
    return false;
  }
  return payload.actions.every((action) => action && ALLOWED_ACTIONS.includes(action.type));
}

function buildSystemPrompt(snapshot) {
  return [
    'You are Mera the village baker in a cozy Ultima-like town.',
    'Stay in character, be kind, and keep answers short (<=70 words).',
    'Never invent new mechanics, items, or quests.',
    'Known items: ' + JSON.stringify(ITEM_CATALOG) + '.',
    'Known quests: ' + JSON.stringify(QUEST_CATALOG) + '.',
    'Allowed actions: ' + ALLOWED_ACTIONS.join(', ') + '.',
    'Only respond with JSON shaped like the provided schema. No prose.'
  ].join(' ');
}

function buildSchema() {
  return {
    name: 'npc_dialogue_turn',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        dialogue: { type: 'string' },
        actions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: true,
            properties: {
              type: { type: 'string', enum: ALLOWED_ACTIONS }
            },
            required: ['type']
          }
        }
      },
      required: ['dialogue', 'actions']
    }
  };
}

async function callOpenAI(snapshot) {
  const response = await fetchFn('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [{ type: 'text', text: buildSystemPrompt(snapshot) }]
        },
        {
          role: 'user',
          content: [{ type: 'text', text: JSON.stringify(snapshot) }]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: buildSchema()
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.output?.[0]?.content?.[0]?.text || data?.output_text;
  if (!content) {
    throw new Error('Missing JSON content in OpenAI response.');
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error('OpenAI returned invalid JSON.');
  }
}

function buildMockResponse(snapshot) {
  const inv = Array.isArray(snapshot.player_state?.inventory)
    ? snapshot.player_state.inventory
    : [];
  const hasDough = inv.includes('dough');
  const hasLoaf = inv.includes('loaf');
  const awaitingBake = snapshot?.location?.oven_status === 'baking';

  let dialogue = 'Smells like a fine morning for baking.';
  const actions = [];

  if (!inv.includes('flour')) {
    dialogue = 'Grab some flour from the pantry and work it on the table.';
  } else if (!hasDough) {
    dialogue = 'Mix that flour with water on the table until you get dough.';
  } else if (!awaitingBake) {
    dialogue = 'Pop the dough into the oven—watch for the crust to brown!';
  } else if (!hasLoaf) {
    dialogue = 'The loaf should be ready soon; keep an eye on the oven window.';
  } else {
    dialogue = 'Lovely loaf! Someone in town will pay well for it.';
  }

  if (hasLoaf) {
    actions.push({ type: 'start_quest', quest_id: 'morning_customers', stage: 1 });
  }

  return { dialogue, actions };
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
