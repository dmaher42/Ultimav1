// server.js - Express server that proxies NPC dialogue to OpenAI or a local mock.
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Node 18 exposes fetch globally; keep a tiny fallback for older runtimes.
const fetchFn = global.fetch || ((...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)));

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

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

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

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
