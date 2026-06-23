const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const ORIGINAL_ENV_KEYS = new Set(Object.keys(process.env));

function stripWrappingQuotes(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (!key) {
      continue;
    }

    if (ORIGINAL_ENV_KEYS.has(key)) {
      continue;
    }

    if (!override && process.env[key] !== undefined) {
      continue;
    }

    const value = stripWrappingQuotes(line.slice(equalsIndex + 1).trim());
    process.env[key] = value;
  }
}

loadEnvFile(path.join(PROJECT_ROOT, '.env'));
loadEnvFile(path.join(PROJECT_ROOT, '.env.local'), { override: true });

const app = express();
const port = Number(process.env.AI_SERVER_PORT || 3001);
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY?.trim() ||
  '';
const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  'gemini-2.5-flash-lite';
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY?.trim() ||
  process.env.CHATGPT_API_KEY?.trim() ||
  '';
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1';
const XAI_API_KEY = process.env.XAI_API_KEY?.trim() || '';
const XAI_MODEL = process.env.XAI_MODEL?.trim() || 'grok-3-mini';
const XAI_BASE_URL = process.env.XAI_BASE_URL?.trim() || 'https://api.x.ai/v1';
const SUPABASE_URL = process.env.SUPABASE_URL?.trim().replace(/\/$/, '') || '';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim() || '';
const SUPABASE_AI_CACHE_TABLE =
  process.env.SUPABASE_AI_CACHE_TABLE?.trim() || 'ai_cache';
const THEMEALDB_API_KEY = process.env.THEMEALDB_API_KEY?.trim() || '1';
const THEMEALDB_BASE_URL = `https://www.themealdb.com/api/json/v1/${THEMEALDB_API_KEY}`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@mobiluygulama.local')
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 24 * 60 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 30);
const AI_RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 80);
const USER_DATA_RATE_LIMIT_MAX = Number(process.env.USER_DATA_RATE_LIMIT_MAX || 120);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 30000);
const PROFILE_PHOTO_DATA_URI_LIMIT = Number(
  process.env.PROFILE_PHOTO_DATA_URI_LIMIT || 700000
);
const APP_HELP_CACHE_LIMIT = 500;
const AI_CACHE_LIMIT = Number(process.env.AI_CACHE_LIMIT || 700);
const AUDIT_LOG_LIMIT = 800;
const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';
const NUTRITION_RESET_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = process.env.APP_DATA_FILE
  ? path.resolve(process.env.APP_DATA_FILE)
  : path.join(DEFAULT_DATA_DIR, 'users.secure.db');
const DATA_DIR = path.dirname(DATA_FILE);
const configuredDataSecret = process.env.APP_DATA_SECRET?.trim();
if (!configuredDataSecret && IS_PRODUCTION) {
  throw new Error('APP_DATA_SECRET must be configured in production.');
}
if (!configuredDataSecret && process.env.NODE_ENV !== 'test') {
  console.warn(
    'APP_DATA_SECRET is not set. Using a machine-local development key; do not use this for production data.'
  );
}
const DATA_SECRET = crypto
  .createHash('sha256')
  .update(configuredDataSecret || `dev:${os.hostname()}:${PROJECT_ROOT}`)
  .digest();
const sessions = new Map();
const SUPPORTED_LANGUAGES = new Set(['tr', 'en', 'de', 'es']);
const VALID_THEMES = new Set([
  'sunset',
  'ocean',
  'forest',
  'rose',
  'obsidian',
  'ivory',
]);
const VALID_AVATAR_COLORS = new Set(['mint', 'sky', 'rose', 'amber', 'violet']);
const VALID_DURATIONS = new Set(['daily', 'weekly', 'monthly']);
const VALID_REGIONS = new Set([
  'forearm',
  'triceps',
  'legs',
  'chest',
  'back',
  'shoulders',
  'core',
]);
const VALID_MOTION_STYLES = new Set([
  'curl',
  'press',
  'hinge',
  'squat',
  'pull',
  'twist',
  'plank',
]);
const ONLINE_RECIPE_TEXT = {
  tr: {
    matched: 'Tarif, cevrim ici yemek arsivinden malzemelerine gore eslestirildi.',
    closest:
      'Tam birebir eslesme bulunamadi, bu nedenle cevrim ici arsivden en yakin tarif secildi.',
    random: 'Cevrim ici arsivden taze bir tarif secildi.',
    fallback:
      'Cevrim ici servis gecici olarak ulasilamaz oldugu icin guvenli bir yedek tarif hazirlandi.',
    recommended: 'Onerilen tarif',
  },
  en: {
    matched: 'Matched from the online recipe library using your ingredients.',
    closest: 'No exact online match was found, so a close online recipe was selected.',
    random: 'A fresh recipe was selected from the online recipe library.',
    fallback:
      'The online recipe service was temporarily unreachable, so a safe fallback recipe was prepared.',
    recommended: 'Recommended recipe',
  },
  de: {
    matched: 'Das Rezept wurde anhand deiner Zutaten aus der Online-Rezeptbibliothek gefunden.',
    closest:
      'Es wurde keine exakte Ubereinstimmung gefunden, daher wurde ein ahnliches Online-Rezept ausgewahlt.',
    random: 'Ein frisches Rezept wurde aus der Online-Rezeptbibliothek ausgewahlt.',
    fallback:
      'Der Online-Rezeptdienst war vorubergehend nicht erreichbar, daher wurde ein sicheres Ersatzrezept vorbereitet.',
    recommended: 'Empfohlenes Rezept',
  },
  es: {
    matched: 'La receta se encontro en la biblioteca en linea segun tus ingredientes.',
    closest:
      'No se encontro una coincidencia exacta, por eso se eligio una receta en linea parecida.',
    random: 'Se eligio una receta nueva de la biblioteca en linea.',
    fallback:
      'El servicio de recetas en linea no estaba disponible temporalmente, por eso se preparo una receta alternativa segura.',
    recommended: 'Receta recomendada',
  },
};
const APP_CREATED_AT = '2026-04-05T00:00:00.000Z';
const APP_AUTHOR = 'Emirhan "Broskosss" Durmus';
const WORKOUT_FALLBACK_TEXT = {
  tr: {
    title: 'AI destekli yedek spor plani',
    summary: 'AI cevabi alinamadigi icin guvenli yedek spor plani olusturuldu.',
    today: 'Bugun',
    focusSuffix: 'odakli akilli blok',
    rest: '45-60 sn dinlen',
    reps: '10-14 tekrar',
    plankReps: '35-45 sn',
    setUnit: 'set',
    instruction1: 'Baslangic pozisyonunu kur.',
    instruction2: 'Ana hareketi kontrollu uygula.',
    instruction3: 'Tepe noktada durup yavasca don.',
  },
  en: {
    title: 'AI-assisted fallback workout plan',
    summary: 'AI could not respond, so a fallback workout plan was created.',
    today: 'Today',
    focusSuffix: 'focused smart block',
    rest: 'Rest 45-60 sec',
    reps: '10-14 reps',
    plankReps: '35-45 sec',
    setUnit: 'sets',
    instruction1: 'Set your start position.',
    instruction2: 'Move through the main action with control.',
    instruction3: 'Pause at the top and return slowly.',
  },
  de: {
    title: 'AI fallback trainingsplan',
    summary: 'Die AI war nicht verfuegbar, daher wurde ein fallback Plan erstellt.',
    today: 'Heute',
    focusSuffix: 'fokussierter trainingsblock',
    rest: 'Pause 45-60 sec',
    reps: '10-14 reps',
    plankReps: '35-45 sec',
    setUnit: 'sets',
    instruction1: 'Startposition aufbauen.',
    instruction2: 'Bewegung kontrolliert ausfuehren.',
    instruction3: 'Oben kurz halten und langsam zurueck.',
  },
  es: {
    title: 'Plan de entrenamiento fallback',
    summary: 'La AI no respondio, por eso se creo un plan fallback seguro.',
    today: 'Hoy',
    focusSuffix: 'bloque enfocado',
    rest: 'Descanso 45-60 sec',
    reps: '10-14 reps',
    plankReps: '35-45 sec',
    setUnit: 'series',
    instruction1: 'Define la posicion inicial.',
    instruction2: 'Haz el movimiento con control.',
    instruction3: 'Pausa arriba y vuelve lento.',
  },
};
const APP_HELP_FALLBACK_TEXT = {
  tr: {
    appOnly: 'Bu sohbet uygulama, tarif, besin takibi ve spor konularinda yardim eder.',
    ai: 'Tarif AI, spor plani AI ve sohbet AI birlikte calisir. Ayni soru tekrar gelirse cevap veritabanindan gelir ve ekstra AI kullanilmaz.',
    theme:
      'Tema alani siyah derinlik ve beyaz derinlik secenekleri ile guncellendi. Kartlar ve arka plan katmanlari bu iki tema icin optimize edildi.',
    workout:
      'Spor plan detayinda yerel GIF yerine internetten gelen YouTube egzersiz videolari gosterilir.',
    favorites:
      'Favori ve gecmis tarifler gorsel kart duzeniyle saklanir. Tarif detayinda not, paylasim ve yaptim aksiyonlari korunur.',
    nutrition:
      'Gunluk Besin Takibi 24 saatte bir yeni gune gecer; eski gunler kullanici hesabinda besin gecmisi olarak saklanir.',
    about: 'Uygulama tarihi 5 Nisan 2026 olarak gosterilir ve yapimci Emirhan "Broskosss" Durmus olarak listelenir.',
  },
  en: {
    appOnly: 'This chat helps with the app, recipes, nutrition tracking, and sports topics.',
    ai: 'Recipe AI, workout-plan AI, and chat AI work together. Repeated questions are answered from the database without another AI call.',
    theme:
      'The theme area includes black-depth and white-depth options. Cards and layered backgrounds are tuned for both themes.',
    workout:
      'Workout detail cards use real YouTube exercise videos instead of bundled local GIF files.',
    favorites:
      'Favorites and recipe history are stored as visual cards. Recipe detail actions keep notes, sharing, and cooked tracking.',
    nutrition:
      'Daily Nutrition Tracker starts a fresh day every 24 hours; previous days are stored per user in nutrition history.',
    about:
      'The app shows April 5, 2026 as the creation date and lists Emirhan "Broskosss" Durmus as the developer.',
  },
  de: {
    appOnly: 'Ich beantworte nur Fragen zu dieser App.',
    ai: 'Rezept AI, Trainingsplan AI und App Guide AI arbeiten zusammen. Wenn der lokale Server nicht erreichbar ist, bleibt der Ablauf mit einem sicheren Fallback stabil.',
    theme:
      'Im Theme Bereich gibt es black-depth und white-depth Optionen mit angepassten Karten und Hintergrundebenen.',
    workout:
      'Workout Details nutzen echte YouTube Uebungsvideos statt lokaler GIF Dateien.',
    favorites:
      'Favoriten und Verlauf werden als visuelle Karten gespeichert. Notiz, Teilen und Cooked Aktionen bleiben erhalten.',
    nutrition:
      'Daily Nutrition Tracker startet alle 24 Stunden einen neuen Tag; alte Tage bleiben pro Nutzer gespeichert.',
    about:
      'Die App zeigt den 5. April 2026 als Erstellungsdatum und nennt Emirhan "Broskosss" Durmus als Entwickler.',
  },
  es: {
    appOnly: 'Solo respondo preguntas sobre esta app.',
    ai: 'Recipe AI, workout AI y app guide AI trabajan juntas. Si el servidor local no esta disponible, el flujo sigue con un fallback seguro.',
    theme:
      'La seccion de tema incluye opciones black-depth y white-depth con tarjetas y capas de fondo optimizadas.',
    workout:
      'Los detalles de entrenamiento usan videos reales de YouTube en lugar de GIF locales.',
    favorites:
      'Favoritos e historial se guardan como tarjetas visuales. Notas, compartir y accion de completado se mantienen.',
    nutrition:
      'Daily Nutrition Tracker crea un dia nuevo cada 24 horas y guarda los dias anteriores por usuario.',
    about:
      'La app muestra 5 de abril de 2026 como fecha de creacion y a Emirhan "Broskosss" Durmus como desarrollador.',
  },
};
const MAX_RECIPE_INGREDIENTS = 4;
const INGREDIENT_ALIASES = {
  tavuk: 'Chicken',
  'tavuk gogsu': 'Chicken Breast',
  'tavuk but': 'Chicken Thigh',
  yogurt: 'Yogurt',
  domates: 'Tomato',
  'domates salcasi': 'Tomato Puree',
  sogan: 'Onion',
  'kuru sogan': 'Onion',
  sarimsak: 'Garlic',
  biber: 'Pepper',
  'kirmizi biber': 'Red Pepper',
  'yesil biber': 'Green Pepper',
  patates: 'Potatoes',
  makarna: 'Pasta',
  spagetti: 'Spaghetti',
  peynir: 'Cheese',
  'kas ar': 'Cheese',
  kasar: 'Cheese',
  yumurta: 'Egg',
  sut: 'Milk',
  un: 'Flour',
  seker: 'Sugar',
  tereyagi: 'Butter',
  pirinc: 'Rice',
  pilav: 'Rice',
  et: 'Beef',
  dana: 'Beef',
  kiyma: 'Beef',
  balik: 'Fish',
  somon: 'Salmon',
  ton: 'Tuna',
  'ton baligi': 'Tuna',
  mantar: 'Mushrooms',
  salatalik: 'Cucumber',
  limon: 'Lemon',
  maydanoz: 'Parsley',
  nane: 'Mint',
  fasulye: 'Green Beans',
  nohut: 'Chickpeas',
  mercimek: 'Lentils',
  ispanak: 'Spinach',
  brokoli: 'Broccoli',
  kabak: 'Courgettes',
  patlican: 'Aubergine',
  havuc: 'Carrot',
  zeytinyagi: 'Olive Oil',
  'olive oil': 'Olive Oil',
  chicken: 'Chicken',
  'chicken breast': 'Chicken Breast',
  yogurt: 'Yogurt',
  tomato: 'Tomato',
  onion: 'Onion',
  garlic: 'Garlic',
  pepper: 'Pepper',
  potato: 'Potatoes',
  pasta: 'Pasta',
  cheese: 'Cheese',
  egg: 'Egg',
  rice: 'Rice',
  beef: 'Beef',
  salmon: 'Salmon',
  tuna: 'Tuna',
  mushroom: 'Mushrooms',
  mushrooms: 'Mushrooms',
  cucumber: 'Cucumber',
  lemon: 'Lemon',
  parsley: 'Parsley',
  spinach: 'Spinach',
  broccoli: 'Broccoli',
  carrot: 'Carrot',
  huhn: 'Chicken',
  zwiebel: 'Onion',
  knoblauch: 'Garlic',
  tomate: 'Tomato',
  pfeffer: 'Pepper',
  kartoffel: 'Potatoes',
  reis: 'Rice',
  nudeln: 'Pasta',
  kase: 'Cheese',
  ei: 'Egg',
  lachs: 'Salmon',
  champignon: 'Mushrooms',
  gurke: 'Cucumber',
  zitrone: 'Lemon',
  petersilie: 'Parsley',
  espinaca: 'Spinach',
  brokkoli: 'Broccoli',
  pollo: 'Chicken',
  cebolla: 'Onion',
  ajo: 'Garlic',
  tomate: 'Tomato',
  pimienta: 'Pepper',
  patata: 'Potatoes',
  arroz: 'Rice',
  pasta: 'Pasta',
  queso: 'Cheese',
  huevo: 'Egg',
  salmon: 'Salmon',
  atun: 'Tuna',
  pepino: 'Cucumber',
  limon: 'Lemon',
  perejil: 'Parsley',
};
const INGREDIENT_NOISE_WORDS = new Set([
  'adet',
  'adetlik',
  'gram',
  'gr',
  'kg',
  'kilo',
  'kilogram',
  'cup',
  'cups',
  'su',
  'bardagi',
  'bardak',
  'tbsp',
  'tsp',
  'kasik',
  'kasigi',
  'tatli',
  'yemek',
  'cay',
  'teaspoon',
  'tablespoon',
  'pieces',
  'piece',
  'pcs',
  'large',
  'small',
  'medium',
  'fresh',
  'toz',
  'ince',
  'yarim',
  'bucuk',
  'and',
  'ile',
  've',
  'ya',
  'oder',
  'und',
  'con',
  'sin',
]);

let ingredientCatalogCache = {
  expiresAt: 0,
  items: [],
  byNormalized: new Map(),
};

function configuredCorsOrigins() {
  return String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

const CORS_ORIGINS = configuredCorsOrigins();
const DEV_ORIGIN_PATTERNS = [
  /^http:\/\/localhost:\d+$/i,
  /^http:\/\/127\.0\.0\.1:\d+$/i,
  /^http:\/\/\[::1\]:\d+$/i,
];

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }
  const normalized = String(origin).replace(/\/$/, '');
  if (CORS_ORIGINS.includes(normalized)) {
    return true;
  }
  return !IS_PRODUCTION && DEV_ORIGIN_PATTERNS.some((pattern) => pattern.test(normalized));
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by this server.'));
    },
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));

function createRateLimiter({ label, windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const connection = clientConnectionInfo(req);
    const key = `${label}:${connection.ip || req.ip || 'unknown'}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    return next();
  };
}

const authRateLimit = createRateLimiter({
  label: 'auth',
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
});
const aiRateLimit = createRateLimiter({
  label: 'ai',
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AI_RATE_LIMIT_MAX,
});
const userDataRateLimit = createRateLimiter({
  label: 'user-data',
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: USER_DATA_RATE_LIMIT_MAX,
});

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function encryptJson(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DATA_SECRET, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptJson(payload) {
  const [prefix, ivText, tagText, encryptedText] = String(payload || '').split(':');
  if (prefix !== 'enc' || !ivText || !tagText || !encryptedText) {
    throw new Error('Encrypted data file is invalid');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    DATA_SECRET,
    Buffer.from(ivText, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

function defaultAppConfig() {
  return {
    adminButtons: [],
    updatedAt: new Date().toISOString(),
  };
}

function normalizeAdminButton(button) {
  return {
    id: String(button?.id || crypto.randomUUID()),
    label: String(button?.label || '').trim().slice(0, 28),
    url: String(button?.url || '').trim(),
    active: button?.active !== false,
  };
}

function normalizeAppConfig(config) {
  return {
    adminButtons: Array.isArray(config?.adminButtons)
      ? config.adminButtons
          .map(normalizeAdminButton)
          .filter((button) => button.label && /^https?:\/\//i.test(button.url))
          .slice(0, 8)
      : [],
    updatedAt: config?.updatedAt ? String(config.updatedAt) : new Date().toISOString(),
  };
}

function validIso(value) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeAuditLog(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((event) => {
      const createdAt = validIso(event?.createdAt);
      if (!createdAt) {
        return null;
      }
      return {
        id: String(event?.id || crypto.randomUUID()),
        type: String(event?.type || 'event').trim().slice(0, 80),
        label: String(event?.label || event?.type || 'Event').trim().slice(0, 140),
        userId: event?.userId ? String(event.userId) : undefined,
        email: event?.email ? String(event.email).trim().toLowerCase().slice(0, 160) : undefined,
        role: event?.role === 'admin' ? 'admin' : event?.role === 'user' ? 'user' : undefined,
        createdAt,
        ip: event?.ip ? String(event.ip).slice(0, 80) : undefined,
        userAgent: event?.userAgent ? String(event.userAgent).slice(0, 260) : undefined,
        details: event?.details && typeof event.details === 'object' ? event.details : undefined,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
    .slice(0, AUDIT_LOG_LIMIT);
}

function ensureStoreShape(store) {
  const shaped = store && typeof store === 'object' ? store : {};
  return {
    ...shaped,
    users: Array.isArray(shaped.users) ? shaped.users : [],
    appHelpCache: Array.isArray(shaped.appHelpCache) ? shaped.appHelpCache : [],
    aiCache: Array.isArray(shaped.aiCache) ? shaped.aiCache.slice(0, AI_CACHE_LIMIT) : [],
    appConfig: normalizeAppConfig(shaped.appConfig || defaultAppConfig()),
    auditLog: normalizeAuditLog(shaped.auditLog),
  };
}

function readStore() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return ensureStoreShape({ users: [] });
  }
  try {
    return ensureStoreShape(decryptJson(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (error) {
    if (IS_PRODUCTION) {
      throw error;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${DATA_FILE}.undecryptable-${timestamp}`;
    fs.copyFileSync(DATA_FILE, backupFile);
    console.warn(
      `Encrypted user storage could not be opened. Backed it up to ${backupFile} and started with a fresh local store.`
    );
    return ensureStoreShape({ users: [] });
  }
}

function writeStore(store) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, encryptJson(ensureStoreShape(store)), 'utf8');
}

function normalizeLanguage(value) {
  return SUPPORTED_LANGUAGES.has(value) ? value : 'tr';
}

function languageLabel(language) {
  return (
    {
      tr: 'Turkish',
      en: 'English',
      de: 'German',
      es: 'Spanish',
    }[normalizeLanguage(language)] || 'Turkish'
  );
}

function istanbulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ISTANBUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function isoFromIstanbulDateKey(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) {
    return undefined;
  }
  return new Date(`${dateKey}T00:00:00.000+03:00`).toISOString();
}

function defaultUserData() {
  return {
    latestRecipe: null,
    history: [],
    favorites: [],
    consumedMacros: { protein: 0, carbs: 0, fat: 0, calories: 0 },
    nutritionLog: [],
    nutritionCycleStartedAt: new Date().toISOString(),
    savedWorkoutPlans: [],
  };
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function geminiUrl() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
}

function parseGeminiJson(text) {
  const jsonText = extractJson(text) || text;
  return JSON.parse(jsonText);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function askGemini(prompt, { expectJson = false } = {}) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API key missing. Set GEMINI_API_KEY on the server.'
    );
  }

  const response = await fetchWithTimeout(geminiUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: expectJson ? 0.2 : 0.45,
        ...(expectJson ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('\n') ?? ''
  );
}

function isTransientAiError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes(' 429') ||
    message.includes(' 503') ||
    message.includes('resource_exhausted') ||
    message.includes('unavailable') ||
    message.includes('rate limit')
  );
}

async function runWithAiRetry(task, { attempts = 3, delayMs = 1200 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientAiError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError || new Error('AI request failed');
}

async function askGeminiWithRetry(prompt, { expectJson = false } = {}) {
  return runWithAiRetry(() => askGemini(prompt, { expectJson }), {
    attempts: 3,
    delayMs: 1200,
  });
}

function extractAssistantMessageText(messageContent) {
  if (!messageContent) {
    return '';
  }
  if (typeof messageContent === 'string') {
    return messageContent;
  }
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        return item?.text ? String(item.text) : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

async function askOpenAiCompatible({
  prompt,
  apiKey,
  model,
  baseUrl,
  providerLabel,
}) {
  if (!apiKey) {
    throw new Error(`${providerLabel} API key missing.`);
  }

  const response = await fetchWithTimeout(`${String(baseUrl).replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${providerLabel} request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return extractAssistantMessageText(data?.choices?.[0]?.message?.content);
}

function recipePrompt(ingredientsText, language, providerLabel = 'AI') {
  const cleanedIngredients = splitIngredientInput(ingredientsText).slice(0, 12);
  const ingredientLine = cleanedIngredients.length
    ? cleanedIngredients.join(', ')
    : String(ingredientsText || '').trim();

  return [
    `You are a professional home chef and nutrition writer for ${providerLabel}.`,
    `Create exactly one recipe in ${languageLabel(language)}.`,
    'Return only JSON.',
    'Use this shape:',
    '{"title":"","ingredients":[""],"steps":[""],"cookTime":"","calories":"","summary":"","youtubeUrl":"","nutrition":{"protein":"","fat":"","carbs":""}}',
    'Use practical home-cooking steps for real kitchens.',
    'Do not output markdown, notes, or explanations outside JSON.',
    'Use at least 5 ingredients and 4 steps.',
    'At least half of the listed ingredients must come from the user input ingredients.',
    'Steps must be specific, sequential, and safe for a real home kitchen.',
    'Each step must include the exact action, order, heat level or oven temperature when relevant, approximate timing, and a doneness cue such as color, texture, or internal readiness.',
    'Do not invent unsafe cooking shortcuts. For meat, chicken, fish, or eggs, include a clear safe-cooking cue.',
    'Avoid vague steps like "cook until done" unless you also explain how the user can tell it is done.',
    'Ingredients and steps must match each other; every main ingredient should be used in the steps.',
    'The summary must explain why the recipe fits the selected ingredients.',
    'youtubeUrl must be a YouTube recipe video URL when you know a trustworthy one; otherwise use an empty string.',
    'Do not invent random YouTube video IDs.',
    'Nutrition values must be concise strings like "24 g", "12 g", "38 g".',
    `User ingredients: ${ingredientLine}`,
  ].join('\n');
}

function translationPrompt(recipe, language) {
  return [
    `Translate this recipe into ${languageLabel(language)}.`,
    'Keep the JSON shape exactly the same.',
    'Return only JSON.',
    JSON.stringify({
      title: recipe.title,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      cookTime: recipe.cookTime ?? '',
      calories: recipe.calories ?? '',
      summary: recipe.summary ?? '',
      youtubeUrl: recipe.youtubeUrl ?? '',
      nutrition: recipe.nutrition ?? { protein: '', fat: '', carbs: '' },
      imageUrl: recipe.imageUrl ?? '',
      source: recipe.source ?? 'recommended',
      note: recipe.note ?? '',
    }),
  ].join('\n');
}

function workoutPlanPrompt(goalText, duration, regions, language) {
  const selectedRegions = regions.length ? regions.join(', ') : 'full body';
  return [
    `Create a ${duration} workout plan in ${languageLabel(language)}.`,
    'Return only JSON.',
    'Use exactly this shape:',
    '{"title":"","summary":"","days":[{"title":"","focus":"","exercises":[{"name":"","region":"","sets":"","reps":"","rest":"","summary":"","instructions":[""],"animationCue":"","motionStyle":""}]}]}',
    'Allowed region values: forearm, triceps, legs, chest, back, shoulders, core.',
    'Allowed motionStyle values: curl, press, hinge, squat, pull, twist, plank.',
    'Match motionStyle to the real movement: curl for curls/wrist curls, press for push-ups/dips/presses/extensions, hinge for deadlifts, squat for squats, pull for rows/pull-ups, twist for Russian twists/dead bugs, plank for planks/supermans.',
    'Every day must have 3 to 6 exercises.',
    'Use the user goal as the main source of truth. If the user names a body part, sport, equipment, or exercise, the plan must include closely related movements.',
    'Do not return generic full-body plans when the user asked for a specific focus.',
    'For each exercise, summary and instructions must explain how that exact movement is performed; do not reuse generic instructions across exercises.',
    'Each exercise must include 3 to 5 practical instructions covering setup, posture, movement path, breathing, tempo, and a common mistake to avoid.',
    'Instructions must be safe for a generally healthy beginner/intermediate user and must tell the user to stop if sharp pain occurs.',
    'Do not prescribe extreme loads, unsafe ranges of motion, or medical claims.',
    'The plan summary must explain how the selected regions are trained and how rest is managed.',
    `Goal or note: ${goalText || 'general fitness'}`,
    `Priority regions: ${selectedRegions}`,
  ].join('\n');
}

function appHelpPrompt(question, language) {
  return [
    `Answer in ${languageLabel(language)}.`,
    'You help users with this mobile app, recipes, nutrition tracking, workout plans, account settings, and safe usage questions.',
    'If the user asks something unrelated to the app, food, nutrition, or sport, briefly steer them back to those topics.',
    'Be concise, practical, and accurate.',
    'Use the app facts below and make grounded inferences from them when needed.',
    'App facts:',
    '- The app is built with Expo React Native.',
    '- Gemini is used through the local Express server for recipe AI, workout plan AI, and the in-app guide AI.',
    '- Secret AI keys are not sent to the client bundle.',
    '- The home screen shows daily nutrition as small round bars.',
    '- Favorite recipes and recipe history use visual cards.',
    '- Workout plan details use real YouTube exercise videos instead of bundled local GIFs.',
    '- Daily nutrition totals reset every 24 hours and previous days are saved per user.',
    '- Recipes are cached by normalized ingredient combination and language so repeated ingredients can be served from the database without another AI call.',
    '- Repeated chat answers are cached in the server database by language and question.',
    '- The home screen kitchen and sport cards open their related screens from the whole card area.',
    '- The settings panel includes an About section.',
    '- The app creation date shown in the UI is April 5, 2026.',
    '- The developer shown in the UI is Emirhan "Broskosss" Durmus.',
    `User question: ${question}`,
  ].join('\n');
}

function sanitizeYoutubeUrl(value) {
  const url = String(value || '').trim();
  if (!url) {
    return undefined;
  }
  if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
    return undefined;
  }
  return url.replace(/^http:\/\//i, 'https://');
}

function recipeYoutubeSearchUrl(recipe, ingredientsText, language) {
  const title = normalizeRecipeLine(recipe?.title || '');
  const ingredients = splitIngredientInput(ingredientsText).slice(0, 4).join(' ');
  const suffix = normalizeLanguage(language) === 'tr'
    ? 'tarifi nasil yapilir'
    : 'recipe how to make';
  const query = [title || ingredients || 'easy recipe', suffix]
    .filter(Boolean)
    .join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function withRecipeYoutubeUrl(recipe, ingredientsText, language) {
  return {
    ...recipe,
    youtubeUrl:
      sanitizeYoutubeUrl(recipe?.youtubeUrl) ||
      recipeYoutubeSearchUrl(recipe, ingredientsText, language),
  };
}

function normalizeRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    return {
      id: crypto.randomUUID(),
      title: '',
      ingredients: [],
      steps: [],
      cookTime: '',
      calories: '',
      summary: '',
      nutrition: { protein: '', fat: '', carbs: '' },
      source: 'generated',
      locale: 'tr',
      note: '',
    };
  }

  return {
    id: String(recipe.id || crypto.randomUUID()),
    title: String(recipe.title || '').trim(),
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((item) => String(item).trim()).filter(Boolean)
      : [],
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.map((item) => String(item).trim()).filter(Boolean)
      : [],
    cookTime: String(recipe.cookTime || '').trim(),
    calories: String(recipe.calories || '').trim(),
    summary: String(recipe.summary || '').trim(),
    nutrition: {
      protein: String(recipe.nutrition?.protein || '').trim(),
      fat: String(recipe.nutrition?.fat || '').trim(),
      carbs: String(recipe.nutrition?.carbs || '').trim(),
    },
    imageUrl: recipe.imageUrl ? String(recipe.imageUrl) : undefined,
    youtubeUrl: sanitizeYoutubeUrl(recipe.youtubeUrl),
    source: recipe.source === 'recommended' ? 'recommended' : 'generated',
    locale: normalizeLanguage(recipe.locale),
    note: String(recipe.note || '').trim(),
    completedAt: recipe.completedAt ? String(recipe.completedAt) : undefined,
    savedAt: recipe.savedAt ? String(recipe.savedAt) : undefined,
  };
}

function normalizeLookupText(value) {
  return String(value || '')
    .toLocaleLowerCase('en-US')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIngredientInput(ingredientsText) {
  return String(ingredientsText || '')
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanIngredientHint(value) {
  const normalized = normalizeLookupText(value).replace(/\b\d+(?:[.,]\d+)?\b/g, ' ');
  const words = normalized
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => !INGREDIENT_NOISE_WORDS.has(word));
  return words.join(' ').trim();
}

function titleCase(value) {
  return String(value || '')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(' ');
}

function stepLines(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }
  return String(text || '')
    .split(/\.\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.endsWith('.') ? line : `${line}.`));
}

function toSeed(value) {
  return String(value || '')
    .split('')
    .reduce(
      (accumulator, character, index) =>
        accumulator + character.charCodeAt(0) * (index + 1),
      0
    );
}

function nutritionFromSeed(seed) {
  return {
    protein: `${18 + (seed % 20)} g`,
    fat: `${8 + ((seed * 3) % 12)} g`,
    carbs: `${28 + ((seed * 5) % 24)} g`,
  };
}

function localizedCookTime(language, minutes) {
  return normalizeLanguage(language) === 'tr' ? `${minutes} dk` : `${minutes} min`;
}

function withRecipeMeta(recipe, seedSource, language) {
  const seed = toSeed(seedSource || recipe.title || recipe.id);
  const hasNutrition =
    Boolean(recipe.nutrition?.protein?.trim()) ||
    Boolean(recipe.nutrition?.fat?.trim()) ||
    Boolean(recipe.nutrition?.carbs?.trim());
  return {
    ...recipe,
    cookTime: recipe.cookTime?.trim() || localizedCookTime(language, 15 + (seed % 21)),
    calories: recipe.calories?.trim() || `${290 + ((seed * 3) % 260)} kcal`,
    nutrition: hasNutrition ? recipe.nutrition : nutritionFromSeed(seed),
  };
}

function normalizeRecipeLine(text) {
  return String(text || '')
    .replace(/^[\s\-*•]+/, '')
    .replace(/^\d+\s*[\)\.\-:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeRecipeShape(recipe) {
  const uniqueIngredients = Array.from(
    new Set(
      (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
        .map((item) => normalizeRecipeLine(item))
        .filter(Boolean)
    )
  );

  const cleanedSteps = (Array.isArray(recipe?.steps) ? recipe.steps : [])
    .map((item) => normalizeRecipeLine(item))
    .filter(Boolean)
    .map((step) => (/[.!?]$/.test(step) ? step : `${step}.`));

  return {
    ...recipe,
    title: normalizeRecipeLine(recipe?.title),
    ingredients: uniqueIngredients,
    steps: cleanedSteps,
    summary: String(recipe?.summary || '').trim(),
  };
}

function ingredientCoverageRatio(recipe, ingredientsText) {
  const requested = splitIngredientInput(ingredientsText)
    .map((item) => cleanIngredientHint(item))
    .map((item) => normalizeLookupText(item))
    .filter(Boolean);
  const uniqueRequested = Array.from(new Set(requested));

  if (!uniqueRequested.length) {
    return 1;
  }

  const blob = normalizeLookupText(
    [
      recipe?.title || '',
      recipe?.summary || '',
      ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients : []),
      ...(Array.isArray(recipe?.steps) ? recipe.steps : []),
    ].join(' ')
  );

  let matched = 0;
  for (const requestedItem of uniqueRequested) {
    const words = requestedItem.split(' ').filter((word) => word.length >= 3);
    const hit =
      blob.includes(requestedItem) ||
      words.some((word) => blob.includes(word)) ||
      words.some((word) => {
        const alias = INGREDIENT_ALIASES[word];
        return alias ? blob.includes(normalizeLookupText(alias)) : false;
      });
    if (hit) {
      matched += 1;
    }
  }

  return matched / uniqueRequested.length;
}

function recipeLooksUsable(recipe, ingredientsText, { minCoverage = 0.34 } = {}) {
  const hasTitle = Boolean(String(recipe?.title || '').trim());
  const hasIngredients = Array.isArray(recipe?.ingredients) && recipe.ingredients.length >= 3;
  const hasSteps = Array.isArray(recipe?.steps) && recipe.steps.length >= 3;
  if (!hasTitle || !hasIngredients || !hasSteps) {
    return false;
  }
  const coverage = ingredientCoverageRatio(recipe, ingredientsText);
  return coverage >= minCoverage;
}

async function findImageByRecipeTitle(title) {
  const query = String(title || '').trim();
  if (!query) {
    return null;
  }
  const meals = await searchMealsByName(query).catch(() => []);
  const image = meals.find((meal) => meal?.strMealThumb)?.strMealThumb;
  return image ? String(image) : null;
}

async function findImageByIngredientHints(ingredientsText) {
  const hints = splitIngredientInput(ingredientsText).slice(0, MAX_RECIPE_INGREDIENTS);
  for (const hint of hints) {
    const resolved = await resolveIngredientQuery(hint).catch(() => null);
    if (!resolved) {
      continue;
    }
    const meals = await fetchMealsByIngredient(resolved).catch(() => []);
    const image = meals.find((meal) => meal?.strMealThumb)?.strMealThumb;
    if (image) {
      return String(image);
    }
  }
  return null;
}

async function resolveRecipeImage(recipe, ingredientsText) {
  if (recipe?.imageUrl) {
    return String(recipe.imageUrl);
  }
  const byTitle = await findImageByRecipeTitle(recipe?.title).catch(() => null);
  if (byTitle) {
    return byTitle;
  }
  const byIngredients = await findImageByIngredientHints(ingredientsText).catch(() => null);
  return byIngredients || undefined;
}

async function normalizeGeneratedRecipe(rawRecipe, ingredientsText, language, providerLabel) {
  const normalized = sanitizeRecipeShape(
    withRecipeMeta(
      normalizeRecipe({
        ...rawRecipe,
        locale: language,
        source: 'generated',
      }),
      `${providerLabel}-${ingredientsText}-${language}`,
      language
    )
  );

  const summaryText =
    normalizeLanguage(language) === 'tr'
      ? `${providerLabel} ile malzemelerine uyumlu tarif olusturuldu.`
      : `Recipe generated by ${providerLabel} and aligned to your ingredients.`;
  const withVideo = withRecipeYoutubeUrl(normalized, ingredientsText, language);

  return {
    ...withVideo,
    summary: withVideo.summary || summaryText,
    imageUrl: withVideo.imageUrl || (await resolveRecipeImage(withVideo, ingredientsText)),
  };
}

function onlineRecipeText(language) {
  return ONLINE_RECIPE_TEXT[normalizeLanguage(language)] || ONLINE_RECIPE_TEXT.tr;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Remote request failed: ${response.status} ${text}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getIngredientCatalog() {
  if (
    ingredientCatalogCache.items.length &&
    ingredientCatalogCache.expiresAt > Date.now()
  ) {
    return ingredientCatalogCache;
  }

  const data = await fetchJson(`${THEMEALDB_BASE_URL}/list.php?i=list`);
  const items = Array.isArray(data?.meals)
    ? data.meals
        .map((item) => String(item?.strIngredient || '').trim())
        .filter(Boolean)
        .map((name) => ({ name, normalized: normalizeLookupText(name) }))
    : [];
  const byNormalized = new Map(items.map((item) => [item.normalized, item.name]));
  ingredientCatalogCache = {
    expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    items,
    byNormalized,
  };
  return ingredientCatalogCache;
}

function scoreCatalogItem(query, candidate) {
  if (!query || !candidate) {
    return 0;
  }
  if (candidate === query) {
    return 1000;
  }
  let score = 0;
  if (candidate.startsWith(query)) {
    score += 400;
  }
  if (candidate.includes(query)) {
    score += 260;
  }
  const queryWords = query.split(' ').filter(Boolean);
  const candidateWords = candidate.split(' ').filter(Boolean);
  for (const word of queryWords) {
    if (candidateWords.includes(word)) {
      score += 80;
    } else if (candidate.includes(word)) {
      score += 30;
    }
  }
  score -= Math.abs(candidate.length - query.length) * 2;
  return score;
}

async function resolveIngredientQuery(rawIngredient) {
  const cleaned = cleanIngredientHint(rawIngredient);
  if (!cleaned) {
    return null;
  }

  const alias = INGREDIENT_ALIASES[cleaned] || titleCase(cleaned);
  const normalizedAlias = normalizeLookupText(alias);

  try {
    const catalog = await getIngredientCatalog();
    const exact =
      catalog.byNormalized.get(normalizedAlias) ||
      catalog.byNormalized.get(normalizedAlias.replace(/\s+/g, ' '));
    if (exact) {
      return exact;
    }

    let bestName = null;
    let bestScore = 0;
    for (const item of catalog.items) {
      const score = scoreCatalogItem(normalizedAlias, item.normalized);
      if (score > bestScore) {
        bestScore = score;
        bestName = item.name;
      }
    }

    if (bestName && bestScore >= 120) {
      return bestName;
    }
  } catch {
    return alias;
  }

  return alias;
}

async function fetchMealById(id) {
  const data = await fetchJson(
    `${THEMEALDB_BASE_URL}/lookup.php?i=${encodeURIComponent(String(id || ''))}`
  );
  return Array.isArray(data?.meals) ? data.meals[0] || null : null;
}

async function fetchMealsByIngredient(ingredient) {
  const encoded = encodeURIComponent(String(ingredient || '').replace(/\s+/g, '_'));
  const data = await fetchJson(`${THEMEALDB_BASE_URL}/filter.php?i=${encoded}`);
  return Array.isArray(data?.meals) ? data.meals : [];
}

async function searchMealsByName(query) {
  const data = await fetchJson(
    `${THEMEALDB_BASE_URL}/search.php?s=${encodeURIComponent(String(query || ''))}`
  );
  return Array.isArray(data?.meals) ? data.meals : [];
}

async function fetchRandomMeal() {
  const data = await fetchJson(`${THEMEALDB_BASE_URL}/random.php`);
  return Array.isArray(data?.meals) ? data.meals[0] || null : null;
}

function mealToRecipe(meal, language, strategy) {
  const ingredients = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = String(meal?.[`strIngredient${index}`] || '').trim();
    const measure = String(meal?.[`strMeasure${index}`] || '').trim();
    if (ingredient) {
      ingredients.push(measure ? `${measure} ${ingredient}`.trim() : ingredient);
    }
  }

  return withRecipeYoutubeUrl(
    withRecipeMeta(
      normalizeRecipe({
        id: `online-${meal?.idMeal || crypto.randomUUID()}`,
        title: String(meal?.strMeal || '').trim(),
        ingredients,
        steps: stepLines(meal?.strInstructions || ''),
        imageUrl: meal?.strMealThumb ? String(meal.strMealThumb) : undefined,
        summary:
          strategy === 'closest'
            ? onlineRecipeText(language).closest
            : strategy === 'random'
              ? onlineRecipeText(language).random
              : onlineRecipeText(language).matched,
        source: 'generated',
        locale: language,
      }),
      `${meal?.idMeal || meal?.strMeal || Date.now()}`,
      language
    ),
    String(meal?.strMeal || ''),
    language
  );
}

function fallbackRecipe(ingredientsText, language) {
  const items = splitIngredientInput(ingredientsText);
  return withRecipeYoutubeUrl(
    withRecipeMeta(
      normalizeRecipe({
        id: `fallback-${Date.now()}`,
        title:
          normalizeLanguage(language) === 'tr'
            ? 'Pratik Mutfak Tarifi'
            : 'Quick Kitchen Recipe',
        ingredients: items.length
          ? items
          : normalizeLanguage(language) === 'tr'
            ? ['2 domates', '1 sogan', 'zeytinyagi']
            : ['2 tomatoes', '1 onion', 'olive oil'],
        steps:
          normalizeLanguage(language) === 'tr'
            ? [
                'Malzemeleri hazirla.',
                'Tavada 10-12 dakika kontrollu pisir.',
                'Baharatla ve sicak servis et.',
              ]
            : [
                'Prepare the ingredients.',
                'Cook in a pan for 10-12 minutes.',
                'Season and serve hot.',
              ],
        summary: onlineRecipeText(language).fallback,
        source: 'generated',
        locale: language,
      }),
      `${language}-${ingredientsText || 'fallback'}`,
      language
    ),
    ingredientsText,
    language
  );
}

async function findOnlineRecipe(ingredientsText, language) {
  const requestedIngredients = splitIngredientInput(ingredientsText).slice(
    0,
    MAX_RECIPE_INGREDIENTS
  );
  const resolvedIngredients = Array.from(
    new Set(
      (
        await Promise.all(
          requestedIngredients.map((ingredient) => resolveIngredientQuery(ingredient))
        )
      ).filter(Boolean)
    )
  );

  if (!resolvedIngredients.length) {
    return null;
  }

  const scoreMap = new Map();
  const searchResults = await Promise.allSettled(
    resolvedIngredients.map((ingredient) => fetchMealsByIngredient(ingredient))
  );

  for (let index = 0; index < searchResults.length; index += 1) {
    const result = searchResults[index];
    if (result.status !== 'fulfilled') {
      continue;
    }

    const ingredient = resolvedIngredients[index];
    for (const meal of result.value) {
      const current = scoreMap.get(meal.idMeal) || {
        score: 0,
        meal,
      };
      current.score += 1;
      current.meal = meal;
      scoreMap.set(meal.idMeal, current);
    }

    if (!result.value.length) {
      const byName = await searchMealsByName(ingredient).catch(() => []);
      if (byName[0]?.idMeal) {
        scoreMap.set(byName[0].idMeal, {
          score: 1,
          meal: byName[0],
        });
      }
    }
  }

  if (scoreMap.size) {
    const ranked = Array.from(scoreMap.values()).sort(
      (left, right) =>
        right.score - left.score ||
        String(left.meal?.strMeal || '').localeCompare(String(right.meal?.strMeal || ''))
    );
    const winner = ranked[0];
    const detailedMeal = await fetchMealById(winner.meal.idMeal).catch(() => null);
    if (detailedMeal) {
      const strategy =
        winner.score >= Math.min(resolvedIngredients.length, 2) ? 'matched' : 'closest';
      return mealToRecipe(detailedMeal, language, strategy);
    }
  }

  return null;
}

function translateStaticRecipeSummary(summary, language) {
  const normalizedSummary = normalizeLookupText(summary);
  if (!normalizedSummary) {
    return summary;
  }

  const recipeText = onlineRecipeText(language);
  if (normalizedSummary === normalizeLookupText(ONLINE_RECIPE_TEXT.en.recommended)) {
    return recipeText.recommended;
  }
  if (normalizedSummary === normalizeLookupText(ONLINE_RECIPE_TEXT.en.matched)) {
    return recipeText.matched;
  }
  if (normalizedSummary === normalizeLookupText(ONLINE_RECIPE_TEXT.en.closest)) {
    return recipeText.closest;
  }
  if (normalizedSummary === normalizeLookupText(ONLINE_RECIPE_TEXT.en.random)) {
    return recipeText.random;
  }
  if (normalizedSummary === normalizeLookupText(ONLINE_RECIPE_TEXT.en.fallback)) {
    return recipeText.fallback;
  }
  return summary;
}

function localizedRecipeCopy(recipe, language) {
  if (!recipe || typeof recipe !== 'object') {
    return fallbackRecipe('', language);
  }

  return withRecipeYoutubeUrl(
    withRecipeMeta(
      normalizeRecipe({
        ...recipe,
        summary: translateStaticRecipeSummary(recipe?.summary, language),
        locale: language,
      }),
      `${recipe?.id || recipe?.title || 'recipe'}-${language}`,
      language
    ),
    recipe?.title || '',
    language
  );
}

function normalizeWorkoutLookupText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\u0131/g, 'i')
    .replace(/\u0130/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function workoutTextIncludes(lookupText, phrases) {
  return phrases.some((phrase) => lookupText.includes(phrase));
}

function motionStyleFromExercise(exercise, incomingMotionStyle = 'press') {
  const region = VALID_REGIONS.has(exercise?.region) ? exercise.region : 'chest';
  const lookupText = normalizeWorkoutLookupText(
    [
      exercise?.name || '',
      exercise?.summary || '',
      exercise?.animationCue || '',
    ].join(' ')
  );

  if (
    workoutTextIncludes(lookupText, [
      'reverse wrist',
      'reverse forearm',
      'ters bilek',
      'bilek kaldirma',
      'wrist raise',
    ])
  ) {
    return 'curl';
  }
  if (workoutTextIncludes(lookupText, ['wrist curl', 'bilek curl'])) {
    return 'curl';
  }
  if (
    workoutTextIncludes(lookupText, [
      'chair dip',
      'bench dip',
      'tricep dip',
      'triceps dip',
      'sandalye dips',
      'dips',
      'triceps extension',
      'tricep extension',
      'french press',
      'push up',
      'pushup',
      'sinav',
      'floor press',
      'overhead press',
      'shoulder press',
      'military press',
      'lateral raise',
      'side raise',
      'bent arm lateral',
      'laterals',
      'yana',
    ])
  ) {
    return 'press';
  }
  if (
    workoutTextIncludes(lookupText, [
      'romanian deadlift',
      'romen deadlift',
      'rdl',
      'deadlift',
      'dead lift',
    ])
  ) {
    return 'hinge';
  }
  if (workoutTextIncludes(lookupText, ['goblet squat', 'squat', 'cok'])) {
    return 'squat';
  }
  if (
    workoutTextIncludes(lookupText, [
      'bent over row',
      'bentover row',
      'barbell row',
      'dumbbell row',
      'row',
      'pull up',
      'pullup',
      'barfiks',
    ])
  ) {
    return 'pull';
  }
  if (
    workoutTextIncludes(lookupText, [
      'russian twist',
      'twist',
      'dead bug',
      'deadbug',
    ])
  ) {
    return 'twist';
  }
  if (workoutTextIncludes(lookupText, ['plank', 'superman'])) {
    return 'plank';
  }
  if (workoutTextIncludes(lookupText, ['curl'])) {
    return 'curl';
  }

  if (incomingMotionStyle === 'press' && region === 'back') {
    return 'pull';
  }
  if (incomingMotionStyle === 'press' && region === 'legs') {
    return 'squat';
  }
  if (incomingMotionStyle === 'press' && region === 'core') {
    return 'plank';
  }
  return incomingMotionStyle;
}

function normalizeExercise(exercise) {
  const region = VALID_REGIONS.has(exercise?.region) ? exercise.region : 'chest';
  const incomingMotionStyle = VALID_MOTION_STYLES.has(exercise?.motionStyle)
    ? exercise.motionStyle
    : 'press';
  const motionStyle = motionStyleFromExercise(exercise, incomingMotionStyle);
  return {
    id: String(exercise?.id || crypto.randomUUID()),
    name: String(exercise?.name || '').trim(),
    region,
    sets: String(exercise?.sets || '').trim(),
    reps: String(exercise?.reps || '').trim(),
    rest: String(exercise?.rest || '').trim(),
    summary: String(exercise?.summary || '').trim(),
    instructions: Array.isArray(exercise?.instructions)
      ? exercise.instructions.map((item) => String(item).trim()).filter(Boolean)
      : [],
    animationCue: String(exercise?.animationCue || '').trim(),
    motionStyle,
  };
}

function normalizeWorkoutPlan(plan, fallbackDuration = 'weekly') {
  const duration = VALID_DURATIONS.has(plan?.duration) ? plan.duration : fallbackDuration;
  return {
    id: String(plan?.id || crypto.randomUUID()),
    title: String(plan?.title || '').trim(),
    summary: String(plan?.summary || '').trim(),
    duration,
    regions: Array.isArray(plan?.regions)
      ? plan.regions.filter((region) => VALID_REGIONS.has(region))
      : [],
    createdAt: String(plan?.createdAt || new Date().toISOString()),
    days: Array.isArray(plan?.days)
      ? plan.days
          .map((day) => ({
            id: String(day?.id || crypto.randomUUID()),
            title: String(day?.title || '').trim(),
            focus: String(day?.focus || '').trim(),
            exercises: Array.isArray(day?.exercises)
              ? day.exercises.map(normalizeExercise).filter((exercise) => exercise.name)
              : [],
          }))
          .filter((day) => day.title && day.exercises.length)
      : [],
  };
}

function localeCodeForLanguage(language) {
  return (
    {
      tr: 'tr-TR',
      en: 'en-US',
      de: 'de-DE',
      es: 'es-ES',
    }[normalizeLanguage(language)] || 'en-US'
  );
}

function createdAtLabel(language) {
  try {
    return new Intl.DateTimeFormat(localeCodeForLanguage(language), {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(APP_CREATED_AT));
  } catch {
    return 'April 5, 2026';
  }
}

function workoutFallbackText(language) {
  return WORKOUT_FALLBACK_TEXT[normalizeLanguage(language)] || WORKOUT_FALLBACK_TEXT.en;
}

function appHelpFallbackText(language) {
  return APP_HELP_FALLBACK_TEXT[normalizeLanguage(language)] || APP_HELP_FALLBACK_TEXT.en;
}

function workoutRegionLabel(region, language) {
  const safeLanguage = normalizeLanguage(language);
  const labelsByLanguage = {
    tr: {
      forearm: 'On kol',
      triceps: 'Triceps',
      legs: 'Bacak',
      chest: 'Gogus',
      back: 'Sirt',
      shoulders: 'Omuz',
      core: 'Core',
    },
    en: {
      forearm: 'Forearm',
      triceps: 'Triceps',
      legs: 'Legs',
      chest: 'Chest',
      back: 'Back',
      shoulders: 'Shoulders',
      core: 'Core',
    },
    de: {
      forearm: 'Unterarm',
      triceps: 'Trizeps',
      legs: 'Beine',
      chest: 'Brust',
      back: 'Ruecken',
      shoulders: 'Schultern',
      core: 'Core',
    },
    es: {
      forearm: 'Antebrazo',
      triceps: 'Triceps',
      legs: 'Piernas',
      chest: 'Pecho',
      back: 'Espalda',
      shoulders: 'Hombros',
      core: 'Core',
    },
  };
  const labels = labelsByLanguage[safeLanguage] || labelsByLanguage.en;
  return labels[region] || labels.chest;
}

function workoutDayLabels(duration, language) {
  const safeLanguage = normalizeLanguage(language);
  const text = workoutFallbackText(safeLanguage);
  if (duration === 'daily') {
    return [text.today];
  }
  if (duration === 'monthly') {
    if (safeLanguage === 'tr') {
      return ['1. Hafta', '2. Hafta', '3. Hafta', '4. Hafta'];
    }
    if (safeLanguage === 'de') {
      return ['Woche 1', 'Woche 2', 'Woche 3', 'Woche 4'];
    }
    if (safeLanguage === 'es') {
      return ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
    }
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }
  if (safeLanguage === 'tr') {
    return ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar'];
  }
  if (safeLanguage === 'de') {
    return ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  }
  if (safeLanguage === 'es') {
    return ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  }
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
}

function workoutExerciseBlueprints(language) {
  const isTurkish = normalizeLanguage(language) === 'tr';
  return {
    forearm: [
      { name: isTurkish ? 'Bilek curl' : 'Wrist curl', motionStyle: 'curl' },
      { name: isTurkish ? 'Ters bilek kaldirma' : 'Reverse wrist raise', motionStyle: 'pull' },
    ],
    triceps: [
      { name: isTurkish ? 'Sandalye dips' : 'Chair dips', motionStyle: 'press' },
      { name: 'Triceps extension', motionStyle: 'press' },
    ],
    legs: [
      { name: 'Goblet squat', motionStyle: 'squat' },
      { name: isTurkish ? 'Romen deadlift' : 'Romanian deadlift', motionStyle: 'hinge' },
    ],
    chest: [
      { name: 'Push-up', motionStyle: 'press' },
      { name: 'Floor press', motionStyle: 'press' },
    ],
    back: [
      { name: 'Bent-over row', motionStyle: 'pull' },
      { name: 'Superman hold', motionStyle: 'plank' },
    ],
    shoulders: [
      { name: 'Overhead press', motionStyle: 'press' },
      { name: 'Lateral raise', motionStyle: 'pull' },
    ],
    core: [
      { name: 'Dead bug', motionStyle: 'twist' },
      { name: 'Forearm plank', motionStyle: 'plank' },
    ],
  };
}

function workoutFallbackExerciseKey(candidate) {
  const lookupText = normalizeWorkoutLookupText(candidate?.name || '');
  if (workoutTextIncludes(lookupText, ['reverse wrist', 'ters bilek', 'bilek kaldirma'])) {
    return 'reverseWristCurl';
  }
  if (workoutTextIncludes(lookupText, ['wrist curl', 'bilek curl'])) {
    return 'wristCurl';
  }
  if (workoutTextIncludes(lookupText, ['chair dip', 'bench dip', 'sandalye dips', 'dips'])) {
    return 'chairDips';
  }
  if (workoutTextIncludes(lookupText, ['triceps extension'])) {
    return 'tricepsExtension';
  }
  if (workoutTextIncludes(lookupText, ['goblet squat'])) {
    return 'gobletSquat';
  }
  if (workoutTextIncludes(lookupText, ['romanian deadlift', 'romen deadlift'])) {
    return 'romanianDeadlift';
  }
  if (workoutTextIncludes(lookupText, ['push up', 'pushup'])) {
    return 'pushUp';
  }
  if (workoutTextIncludes(lookupText, ['floor press'])) {
    return 'floorPress';
  }
  if (workoutTextIncludes(lookupText, ['bent over row', 'row'])) {
    return 'bentOverRow';
  }
  if (workoutTextIncludes(lookupText, ['superman'])) {
    return 'superman';
  }
  if (workoutTextIncludes(lookupText, ['overhead press', 'shoulder press'])) {
    return 'overheadPress';
  }
  if (workoutTextIncludes(lookupText, ['lateral raise'])) {
    return 'lateralRaise';
  }
  if (workoutTextIncludes(lookupText, ['dead bug', 'deadbug'])) {
    return 'deadBug';
  }
  if (workoutTextIncludes(lookupText, ['forearm plank', 'plank'])) {
    return 'forearmPlank';
  }
  return candidate?.motionStyle || 'press';
}

function workoutFallbackExerciseDetails(candidate, language) {
  const tr = normalizeLanguage(language) === 'tr';
  const details = {
    curl: {
      tr: {
        summary: 'Dirsegi sabit tutup agirligi omuza dogru bukerek biceps kasini calistir.',
        cue: 'Dirsegi oynatmadan agirligi yavasca yukari cek.',
        instructions: [
          'Dirsegi govdeye yakin ve sabit tut.',
          'Agirligi omuza dogru bukerken bilegi duz tut.',
          'Tepe noktada kisa durup yavasca indir.',
        ],
      },
      en: {
        summary: 'Keep the elbow still and curl the weight toward the shoulder.',
        cue: 'Curl up slowly without moving the elbow.',
        instructions: [
          'Keep the elbow close to the body and still.',
          'Curl the weight toward the shoulder with a straight wrist.',
          'Pause briefly at the top, then lower slowly.',
        ],
      },
    },
    wristCurl: {
      tr: {
        summary: 'On kol sabitken bilegi bukup agirligi yukari yuvarla.',
        cue: 'Sadece bilekten hareket et.',
        instructions: [
          'On kolu diz veya sehpa uzerine sabitle, avuc ici yukari baksin.',
          'Sadece bilekten bukerek agirligi yukari yuvarla.',
          'Bilegi yavasca asagi indir, on kolu oynatma.',
        ],
      },
      en: {
        summary: 'Keep the forearm still and curl the wrist upward.',
        cue: 'Move only from the wrist.',
        instructions: [
          'Rest the forearm on a knee or bench with palm facing up.',
          'Curl only from the wrist to roll the weight upward.',
          'Lower the wrist slowly without moving the forearm.',
        ],
      },
    },
    reverseWristCurl: {
      tr: {
        summary: 'Avuc ici asagi bakarken el sirtini yukari kaldir.',
        cue: 'El sirtini tavana dogru kaldir.',
        instructions: [
          'On kolu sabitle, avuc ici yere baksin.',
          'El sirtini tavana dogru kaldir.',
          'Kontrollu indir, bilegi savurma.',
        ],
      },
      en: {
        summary: 'With the palm facing down, lift the back of the hand upward.',
        cue: 'Lift the back of the hand toward the ceiling.',
        instructions: [
          'Anchor the forearm with the palm facing down.',
          'Lift the back of the hand toward the ceiling.',
          'Lower with control without swinging the wrist.',
        ],
      },
    },
    chairDips: {
      tr: {
        summary: 'Eller sandalyede, dirsekleri geriye kirarak arka kol dips yap.',
        cue: 'Dirsekleri geriye kir ve avuclardan it.',
        instructions: [
          'Eller sandalyede omuz genisliginde, kalca sandalyeye yakin olsun.',
          'Dirsekleri geriye kirarak govdeyi asagi indir.',
          'Avuclardan itip dirsekleri kilitlemeden yukari don.',
        ],
      },
      en: {
        summary: 'Place hands on a chair and bend the elbows back for a triceps dip.',
        cue: 'Bend elbows back and press through the palms.',
        instructions: [
          'Place hands shoulder-width on the chair with hips close to it.',
          'Bend elbows backward and lower the body.',
          'Press through the palms and return without locking elbows hard.',
        ],
      },
    },
    tricepsExtension: {
      tr: {
        summary: 'Dirsekleri sabit tutup agirligi enseye indirerek arka kolu uzat.',
        cue: 'Dirsekleri sabit tut, sadece on kol hareket etsin.',
        instructions: [
          'Agirligi iki elle bas ustunde tut, dirsekler ileri baksin.',
          'Dirsekleri sabit tutup agirligi enseye dogru indir.',
          'Arka kolu sikarak kollari tekrar yukari uzat.',
        ],
      },
      en: {
        summary: 'Keep elbows still, lower the weight behind the head, then extend.',
        cue: 'Keep elbows fixed while the forearms move.',
        instructions: [
          'Hold the weight overhead with elbows pointing forward.',
          'Keep elbows still and lower the weight behind the head.',
          'Squeeze the triceps to extend the arms overhead again.',
        ],
      },
    },
    gobletSquat: {
      tr: {
        summary: 'Agirligi gogse yakin tutup kalcayi geriye alarak cok ve kalk.',
        cue: 'Kalcalari geriye gonder ve topuklardan kalk.',
        instructions: [
          'Agirligi gogse yakin tut, ayaklar omuz genisliginde olsun.',
          'Kalcalari geriye gonderip dizleri ayak yonunde buk.',
          'Topuklardan itip gogsu dik tutarak kalk.',
        ],
      },
      en: {
        summary: 'Hold the weight close to the chest, sit back, then stand tall.',
        cue: 'Sit back and stand through the heels.',
        instructions: [
          'Hold the weight close to the chest with feet shoulder-width.',
          'Send hips back and bend knees in line with the feet.',
          'Drive through the heels and stand with the chest tall.',
        ],
      },
    },
    romanianDeadlift: {
      tr: {
        summary: 'Dizleri hafif kirip kalcadan egilerek arka bacaklari calistir.',
        cue: 'Kalcalari geriye it, sirti duz tut.',
        instructions: [
          'Ayaklari kalca genisliginde tut, dizleri hafif kir.',
          'Kalcalari geriye iterek agirligi bacak boyunca indir.',
          'Arka bacak gerilince kalcayi one alip dikles.',
        ],
      },
      en: {
        summary: 'Soften the knees and hinge at the hips to train the hamstrings.',
        cue: 'Push hips back with a flat back.',
        instructions: [
          'Stand hip-width with a slight knee bend.',
          'Push hips back and lower the weight along the legs.',
          'When hamstrings stretch, drive hips forward to stand.',
        ],
      },
    },
    pushUp: {
      tr: {
        summary: 'Vucut tek cizgideyken gogsu yere indirip avuclardan iterek kalk.',
        cue: 'Karni sik, vucudu tek cizgide indir-kaldir.',
        instructions: [
          'Eller omuz hizasinda, vucut bas-topuk tek cizgi olsun.',
          'Dirsekleri 45 dereceyle kirip gogsunu yere indir.',
          'Karni sik, avuclardan iterek baslangica don.',
        ],
      },
      en: {
        summary: 'Hold one body line, lower the chest, then press back up.',
        cue: 'Brace and press in one straight line.',
        instructions: [
          'Set hands under shoulders and keep head-to-heel alignment.',
          'Bend elbows around 45 degrees and lower the chest.',
          'Brace the core and press through the palms to return.',
        ],
      },
    },
    floorPress: {
      tr: {
        summary: 'Sirt ustu yatip dirsekleri yere indirerek gogus presi yap.',
        cue: 'Dirsekler yere degince gogusten yukari it.',
        instructions: [
          'Sirt ustu yat, dizleri kir ve agirliklari gogus hizasinda tut.',
          'Dirsekler yere kontrollu degene kadar agirliklari indir.',
          'Gogsu sikarak yukari it, omuzlari yerden koparma.',
        ],
      },
      en: {
        summary: 'Lie on your back, lower elbows to the floor, then press up.',
        cue: 'Touch elbows down lightly, then press through the chest.',
        instructions: [
          'Lie on your back with knees bent and weights at chest level.',
          'Lower until elbows lightly touch the floor.',
          'Press up through the chest without lifting shoulders off the floor.',
        ],
      },
    },
    bentOverRow: {
      tr: {
        summary: 'Kalcadan egil, dirsekleri kalcaya cekerek sirt kaslarini sik.',
        cue: 'Dirsekleri kalcaya cek, belini yuvarlama.',
        instructions: [
          'Kalcadan egil, sirt duz ve agirliklar omuz altinda olsun.',
          'Dirsekleri kalcaya dogru cek, kurek kemiklerini yaklastir.',
          'Agirliklari yavasca indir, belini yuvarlama.',
        ],
      },
      en: {
        summary: 'Hinge forward and pull the elbows toward the hips.',
        cue: 'Pull elbows to hips without rounding the back.',
        instructions: [
          'Hinge forward with a flat back and weights under shoulders.',
          'Pull elbows toward the hips and squeeze shoulder blades.',
          'Lower the weights slowly without rounding the back.',
        ],
      },
    },
    superman: {
      tr: {
        summary: 'Yuzustu pozisyonda gogus ve bacaklari hafifce kaldirip tut.',
        cue: 'Gogus ve bacaklari hafif kaldir, boynu rahat tut.',
        instructions: [
          'Yuzustu uzan, kollar ileri ve boyun rahat olsun.',
          'Gogus ve bacaklari ayni anda hafifce kaldir.',
          'Belini sikistirmadan kisa tutup kontrollu indir.',
        ],
      },
      en: {
        summary: 'Lie face down and gently lift the chest and legs.',
        cue: 'Lift chest and legs lightly with a relaxed neck.',
        instructions: [
          'Lie face down with arms forward and neck relaxed.',
          'Lift chest and legs slightly at the same time.',
          'Hold briefly, then lower without pinching the low back.',
        ],
      },
    },
    overheadPress: {
      tr: {
        summary: 'Agirliklari omuzdan bas ustune kontrollu sekilde it.',
        cue: 'Karni sik ve agirliklari bas ustune it.',
        instructions: [
          'Agirliklari omuz hizasinda tut, karni sik.',
          'Dirsekleri hafif onde tutarak agirliklari yukari it.',
          'Bas ustunde kontrol et, sonra omuza yavasca indir.',
        ],
      },
      en: {
        summary: 'Press the weights from shoulder level to overhead with control.',
        cue: 'Brace and press the weights overhead.',
        instructions: [
          'Hold weights at shoulder level and brace the core.',
          'Keep elbows slightly forward and press overhead.',
          'Control at the top, then lower slowly to the shoulders.',
        ],
      },
    },
    lateralRaise: {
      tr: {
        summary: 'Dirsekler hafif kirik, kollari yana omuz hizasina kaldir.',
        cue: 'Kollari yana kaldir, omuzlari kulaga cekme.',
        instructions: [
          'Agirliklar yanda, dirsekler hafif kirik olsun.',
          'Kollari omuz hizasina kadar yana kaldir.',
          'Omuzlari kulaga cekmeden yavasca indir.',
        ],
      },
      en: {
        summary: 'With soft elbows, raise the arms out to shoulder height.',
        cue: 'Raise arms to the side without shrugging.',
        instructions: [
          'Hold weights by the sides with soft elbows.',
          'Raise arms out to shoulder height.',
          'Lower slowly without shrugging the shoulders.',
        ],
      },
    },
    deadBug: {
      tr: {
        summary: 'Bel yere sabitken zit kol ve bacagi kontrollu uzat.',
        cue: 'Belini yere bastir, zit kol-bacagi uzat.',
        instructions: [
          'Sirt ustu yat, bel boslugunu yere bastir.',
          'Zit kol ve bacagi yavasca uzat.',
          'Bel kalkmadan merkeze don ve taraf degistir.',
        ],
      },
      en: {
        summary: 'Keep the low back down while extending opposite arm and leg.',
        cue: 'Press the back down and extend opposite limbs.',
        instructions: [
          'Lie on your back and press the low back into the floor.',
          'Slowly extend the opposite arm and leg.',
          'Return without the back lifting, then switch sides.',
        ],
      },
    },
    forearmPlank: {
      tr: {
        summary: 'On kollarda destek alip karni sikarak vucudu sabit tut.',
        cue: 'Karni sik, kalcayi dusurmeden tek cizgide kal.',
        instructions: [
          'Dirsekleri omuz altina koy, ayak ucuna yuksel.',
          'Bas, kalca ve topuklari tek cizgide tut.',
          'Karni ve kalcayi sik, kalcanin dusmesine izin verme.',
        ],
      },
      en: {
        summary: 'Support on the forearms and brace the core to hold steady.',
        cue: 'Brace and hold one straight line.',
        instructions: [
          'Place elbows under shoulders and rise onto the toes.',
          'Keep head, hips, and heels aligned.',
          'Brace abs and glutes so the hips do not drop.',
        ],
      },
    },
    twist: {
      tr: {
        summary: 'Karni sikarak govdeyi sag ve sola kontrollu cevir.',
        cue: 'Gogsu uzun tut ve govdeyi sag-sol cevir.',
        instructions: [
          'Otur, govdeyi hafif geriye al ve karni sik.',
          'Gogsu uzun tutarak govdeyi sag-sol cevir.',
          'Hareketi belden savurmadan kontrollu yap.',
        ],
      },
      en: {
        summary: 'Brace the core and rotate the torso side to side with control.',
        cue: 'Keep the chest long and rotate side to side.',
        instructions: [
          'Sit down, lean back slightly, and brace the core.',
          'Keep the chest long and rotate side to side.',
          'Move with control instead of swinging from the low back.',
        ],
      },
    },
    pull: {
      tr: {
        summary: 'Bardan tutunup dirsekleri asagi cekerek gogsu bara yaklastir.',
        cue: 'Dirsekleri asagi cek, sallanmadan in.',
        instructions: [
          'Bari omuzdan biraz genis tut, omuzlari kulaktan uzaklastir.',
          'Dirsekleri asagi cekerek gogsu bara yaklastir.',
          'Sallanma yapmadan kontrollu sekilde asagi in.',
        ],
      },
      en: {
        summary: 'Hang from the bar and pull elbows down to bring the chest up.',
        cue: 'Pull elbows down and lower without swinging.',
        instructions: [
          'Grip the bar slightly wider than shoulders and set shoulders down.',
          'Pull elbows down to bring the chest toward the bar.',
          'Lower under control without swinging.',
        ],
      },
    },
  };
  const key = workoutFallbackExerciseKey(candidate);
  const detail = details[key] || details[candidate?.motionStyle] || details.press;
  return tr ? detail.tr : detail.en;
}

function fallbackWorkoutPlan(goalText, duration, regions, language) {
  const safeLanguage = normalizeLanguage(language);
  const text = workoutFallbackText(safeLanguage);
  const selectedRegions = Array.isArray(regions) && regions.length
    ? regions.filter((region) => VALID_REGIONS.has(region))
    : ['chest', 'back', 'legs'];
  const finalRegions = selectedRegions.length ? selectedRegions : ['chest', 'back', 'legs'];
  const labels = workoutDayLabels(duration, safeLanguage);
  const blueprints = workoutExerciseBlueprints(safeLanguage);
  const createdAt = new Date().toISOString();

  const days = labels.map((title, dayIndex) => {
    const primaryRegion = finalRegions[dayIndex % finalRegions.length];
    const secondaryRegion = finalRegions[(dayIndex + 1) % finalRegions.length];
    const candidates = (blueprints[primaryRegion] || blueprints.chest)
      .concat(blueprints[secondaryRegion] || blueprints.chest)
      .slice(0, 4);

    const exercises = candidates.map((candidate, exerciseIndex) => {
      const region = exerciseIndex < 2 ? primaryRegion : secondaryRegion;
      const setCount =
        duration === 'daily'
          ? 3
          : duration === 'weekly'
            ? 4
            : 3 + (dayIndex % 2);
      const detail = workoutFallbackExerciseDetails(candidate, safeLanguage);

      return normalizeExercise({
        id: `fallback-${dayIndex}-${exerciseIndex}-${Date.now()}`,
        name: candidate.name,
        region,
        sets: `${setCount} ${text.setUnit}`,
        reps: candidate.motionStyle === 'plank' ? text.plankReps : text.reps,
        rest: text.rest,
        summary: detail.summary,
        instructions: detail.instructions,
        animationCue: detail.cue,
        motionStyle: candidate.motionStyle,
      });
    });

    return {
      id: `fallback-day-${dayIndex}-${Date.now()}`,
      title,
      focus: `${workoutRegionLabel(primaryRegion, safeLanguage)} ${text.focusSuffix}`,
      exercises,
    };
  });

  return normalizeWorkoutPlan(
    {
      id: `fallback-plan-${Date.now()}`,
      title: goalText || text.title,
      summary: text.summary,
      duration,
      regions: finalRegions,
      createdAt,
      days,
    },
    duration
  );
}

function containsAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function aboutFallbackAnswer(language) {
  const safeLanguage = normalizeLanguage(language);
  const createdAt = createdAtLabel(safeLanguage);
  if (safeLanguage === 'tr') {
    return `Bu uygulamanin kurulum tarihi ${createdAt} olarak gosterilir ve yapan kisi ${APP_AUTHOR} olarak listelenir.`;
  }
  if (safeLanguage === 'de') {
    return `Diese App zeigt ${createdAt} als Erstellungsdatum und listet ${APP_AUTHOR} als Entwickler.`;
  }
  if (safeLanguage === 'es') {
    return `Esta app muestra ${createdAt} como fecha de creacion y a ${APP_AUTHOR} como desarrollador.`;
  }
  return `This app shows ${createdAt} as its creation date and lists ${APP_AUTHOR} as the developer.`;
}

function fallbackAppAnswer(question, language) {
  const safeLanguage = normalizeLanguage(language);
  const text = appHelpFallbackText(safeLanguage);
  const normalized = normalizeLookupText(question);
  if (!normalized) {
    return text.appOnly;
  }

  if (
    containsAny(normalized, [
      'besin',
      'nutrition',
      'macro',
      'kalori',
      'calorie',
      'protein',
      'karbonhidrat',
      'yag',
      'fat',
      'reset',
      'yenilen',
    ])
  ) {
    return text.nutrition || text.appOnly;
  }
  if (containsAny(normalized, ['ai', 'zeka', 'gemini', 'mobile', 'mobil', 'cache'])) {
    return text.ai;
  }
  if (containsAny(normalized, ['theme', 'tema', 'siyah', 'beyaz', 'black', 'white'])) {
    return text.theme;
  }
  if (
    containsAny(normalized, [
      'gif',
      'video',
      'youtube',
      'spor',
      'workout',
      'exercise',
      'hareket',
      'movement',
    ])
  ) {
    return text.workout;
  }
  if (
    containsAny(normalized, ['favori', 'gecmis', 'favorite', 'favorites', 'history', 'saved'])
  ) {
    return text.favorites;
  }
  if (containsAny(normalized, ['kurul', 'yapan', 'kim', 'built', 'created', 'developer'])) {
    return aboutFallbackAnswer(safeLanguage);
  }
  return text.appOnly;
}

function normalizeMacroTotals(value) {
  return {
    protein: Number(value?.protein || 0),
    carbs: Number(value?.carbs || 0),
    fat: Number(value?.fat || 0),
    calories: Number(value?.calories || 0),
  };
}

function normalizeNutritionLog(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const date = String(entry?.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return null;
      }
      const items = Array.isArray(entry?.items)
        ? entry.items
            .map((item) => ({
              id: String(item?.id || crypto.randomUUID()),
              title: String(item?.title || '').trim().slice(0, 120),
              completedAt: String(item?.completedAt || new Date().toISOString()),
              calories: item?.calories ? String(item.calories).slice(0, 40) : undefined,
              nutrition: item?.nutrition
                ? {
                    protein: String(item.nutrition.protein || '').slice(0, 40),
                    fat: String(item.nutrition.fat || '').slice(0, 40),
                    carbs: String(item.nutrition.carbs || '').slice(0, 40),
                  }
                : undefined,
            }))
            .filter((item) => item.title)
            .slice(0, 80)
        : [];

      return {
        date,
        totals: normalizeMacroTotals(entry?.totals),
        items,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (left.date < right.date ? 1 : -1))
    .slice(0, 370);
}

function normalizeNutritionCycleStartedAt(value, nutritionLog = []) {
  const direct = validIso(value);
  if (direct) {
    return direct;
  }

  const latestItem = nutritionLog
    .flatMap((entry) => entry.items || [])
    .sort((left, right) => (left.completedAt < right.completedAt ? 1 : -1))[0];
  const fromItem = validIso(latestItem?.completedAt);
  if (fromItem) {
    return fromItem;
  }

  const fromDate = isoFromIstanbulDateKey(nutritionLog[0]?.date);
  return fromDate || new Date().toISOString();
}

function normalizeUserData(data) {
  const nutritionLog = normalizeNutritionLog(data?.nutritionLog);
  return {
    latestRecipe: data?.latestRecipe ? normalizeRecipe(data.latestRecipe) : null,
    history: Array.isArray(data?.history) ? data.history.map(normalizeRecipe).filter((item) => item.title) : [],
    favorites: Array.isArray(data?.favorites)
      ? data.favorites.map(normalizeRecipe).filter((item) => item.title)
      : [],
    consumedMacros: normalizeMacroTotals(data?.consumedMacros),
    nutritionLog,
    nutritionCycleStartedAt: normalizeNutritionCycleStartedAt(
      data?.nutritionCycleStartedAt,
      nutritionLog
    ),
    savedWorkoutPlans: Array.isArray(data?.savedWorkoutPlans)
      ? data.savedWorkoutPlans
          .map((plan) => normalizeWorkoutPlan(plan, plan?.duration))
          .filter((plan) => plan.title && plan.days.length)
      : [],
  };
}

function resolveNutritionWindow(data, now = new Date()) {
  const normalized = normalizeUserData(data);
  const startedAt = new Date(normalized.nutritionCycleStartedAt);
  const elapsedMs = now.getTime() - startedAt.getTime();
  const shouldReset = elapsedMs >= NUTRITION_RESET_MS;

  if (!shouldReset) {
    return {
      data: normalized,
      reset: false,
      dateKey: istanbulDateKey(startedAt),
      elapsedHours: Math.max(0, elapsedMs / (60 * 60 * 1000)),
    };
  }

  const nextStartedAt = now.toISOString();
  return {
    data: {
      ...normalized,
      consumedMacros: { protein: 0, carbs: 0, fat: 0, calories: 0 },
      nutritionCycleStartedAt: nextStartedAt,
    },
    reset: true,
    dateKey: istanbulDateKey(now),
    elapsedHours: elapsedMs / (60 * 60 * 1000),
  };
}

function summarizeUserData(data) {
  const normalized = normalizeUserData(data);
  const nutritionItemCount = normalized.nutritionLog.reduce(
    (total, entry) => total + entry.items.length,
    0
  );
  const recentRecipes = normalized.history.slice(0, 5).map((recipe) => recipe.title);
  const recentFavorites = normalized.favorites.slice(0, 5).map((recipe) => recipe.title);
  const recentPlans = normalized.savedWorkoutPlans.slice(0, 5).map((plan) => plan.title);

  return {
    latestRecipeTitle: normalized.latestRecipe?.title || '',
    historyCount: normalized.history.length,
    favoriteCount: normalized.favorites.length,
    savedWorkoutPlanCount: normalized.savedWorkoutPlans.length,
    nutritionDayCount: normalized.nutritionLog.length,
    nutritionItemCount,
    totalRecipes: normalized.history.length + normalized.favorites.length,
    currentMacros: normalized.consumedMacros,
    nutritionCycleStartedAt: normalized.nutritionCycleStartedAt,
    recentRecipes,
    recentFavorites,
    recentPlans,
    nutritionDates: normalized.nutritionLog.slice(0, 8).map((entry) => entry.date),
    missing: [
      ...(normalized.history.length ? [] : ['recipe_history']),
      ...(normalized.favorites.length ? [] : ['favorites']),
      ...(normalized.savedWorkoutPlans.length ? [] : ['workout_plans']),
      ...(nutritionItemCount ? [] : ['nutrition_entries']),
    ],
  };
}

function safePhotoUri(value) {
  const uri = value ? String(value) : '';
  if (!uri || uri.startsWith('blob:') || uri.startsWith('file://localhost/')) {
    return undefined;
  }

  if (uri.startsWith('data:')) {
    const isAllowedImage = /^data:image\/(png|jpe?g|webp);base64,/i.test(uri);
    return isAllowedImage && uri.length <= PROFILE_PHOTO_DATA_URI_LIMIT ? uri : undefined;
  }

  try {
    const parsed = new URL(uri);
    if (parsed.protocol === 'https:') {
      return uri;
    }
    if (
      !IS_PRODUCTION &&
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return uri;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizeAvatarColor(value) {
  return VALID_AVATAR_COLORS.has(value) ? value : 'mint';
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    lastLoginAt: validIso(user.lastLoginAt),
    lastLogoutAt: validIso(user.lastLogoutAt),
    lastSeenAt: validIso(user.lastSeenAt),
    role: user.role === 'admin' ? 'admin' : 'user',
    profile: {
      displayName: String(user.profile?.displayName || '').trim(),
      language: normalizeLanguage(user.profile?.language),
      themeColor: VALID_THEMES.has(user.profile?.themeColor)
        ? user.profile.themeColor
        : 'obsidian',
      avatarColor: normalizeAvatarColor(user.profile?.avatarColor),
      photoUri: safePhotoUri(user.profile?.photoUri),
    },
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  const [salt, savedHash] = String(storedValue || '').split(':');
  if (!salt || !savedHash) {
    return false;
  }
  const candidate = crypto.scryptSync(password, salt, 64);
  const saved = Buffer.from(savedHash, 'hex');
  return saved.length === candidate.length && crypto.timingSafeEqual(saved, candidate);
}

function clientConnectionInfo(req) {
  const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return {
    ip:
      forwardedFor ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      undefined,
    userAgent: req?.headers?.['user-agent']
      ? String(req.headers['user-agent']).slice(0, 260)
      : undefined,
  };
}

function createSession(userId, req) {
  const connection = clientConnectionInfo(req);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    ip: connection.ip,
    userAgent: connection.userAgent,
  });
  return token;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const session = sessions.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  session.lastSeenAt = Date.now();
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  const connection = clientConnectionInfo(req);
  session.ip = connection.ip || session.ip;
  session.userAgent = connection.userAgent || session.userAgent;
  req.token = token;
  req.userId = session.userId;
  return next();
}

const sessionCleanupTimer = setInterval(
  cleanupExpiredSessions,
  Math.min(SESSION_TTL_MS, 60 * 60 * 1000)
);
if (typeof sessionCleanupTimer.unref === 'function') {
  sessionCleanupTimer.unref();
}

function findUserOrThrow(store, userId) {
  const user = store.users.find((item) => item.id === userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

function requireAdmin(req, res, next) {
  try {
    const store = readStore();
    const user = findUserOrThrow(store, req.userId);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.adminUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown admin auth error',
    });
  }
}

function safeAuditDetails(details) {
  if (!details || typeof details !== 'object') {
    return undefined;
  }
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return undefined;
  }
}

function recordAudit(store, { req, user, type, label, details }) {
  const connection = clientConnectionInfo(req);
  const event = {
    id: crypto.randomUUID(),
    type: String(type || 'event').slice(0, 80),
    label: String(label || type || 'Event').slice(0, 140),
    userId: user?.id,
    email: user?.email,
    role: user?.role === 'admin' ? 'admin' : 'user',
    createdAt: new Date().toISOString(),
    ip: connection.ip,
    userAgent: connection.userAgent,
    details: safeAuditDetails(details),
  };
  store.auditLog = normalizeAuditLog([event, ...(store.auditLog || [])]);
}

function recordAnonymousAudit(req, type, label, details) {
  try {
    const store = readStore();
    recordAudit(store, { req, type, label, details });
    writeStore(store);
  } catch {
    // Audit should never block the primary user flow.
  }
}

function activeSessionsForUser(userId) {
  return Array.from(sessions.entries())
    .filter(([, session]) => session.userId === userId)
    .map(([token, session]) => ({
      id: token.slice(0, 10),
      createdAt: new Date(session.createdAt).toISOString(),
      lastSeenAt: new Date(session.lastSeenAt || session.createdAt).toISOString(),
      ip: session.ip,
      userAgent: session.userAgent,
    }))
    .sort((left, right) => (left.lastSeenAt < right.lastSeenAt ? 1 : -1));
}

function latestConnectionForUser(store, userId) {
  const session = activeSessionsForUser(userId)[0];
  if (session) {
    return {
      at: session.lastSeenAt,
      ip: session.ip,
      userAgent: session.userAgent,
      active: true,
    };
  }

  const event = store.auditLog.find(
    (item) => item.userId === userId && (item.ip || item.userAgent)
  );
  return event
    ? {
        at: event.createdAt,
        ip: event.ip,
        userAgent: event.userAgent,
        active: false,
      }
    : null;
}

function buildAdminAnalytics(store) {
  const users = store.users
    .map((user) => {
      const stats = summarizeUserData(user.data);
      const activeSessions = activeSessionsForUser(user.id);
      const recentEvents = store.auditLog
        .filter((event) => event.userId === user.id)
        .slice(0, 10);

      return {
        user: sanitizeUser(user),
        activeSessions: activeSessions.length,
        sessions: activeSessions,
        lastConnection: latestConnectionForUser(store, user.id),
        stats,
        recentEvents,
      };
    })
    .sort((left, right) => {
      const leftSeen =
        left.lastConnection?.at || left.user.lastLoginAt || left.user.createdAt;
      const rightSeen =
        right.lastConnection?.at || right.user.lastLoginAt || right.user.createdAt;
      return leftSeen < rightSeen ? 1 : -1;
    });

  const summary = users.reduce(
    (total, item) => ({
      userCount: total.userCount + 1,
      standardUserCount:
        total.standardUserCount + (item.user.role === 'admin' ? 0 : 1),
      adminCount: total.adminCount + (item.user.role === 'admin' ? 1 : 0),
      activeSessions: total.activeSessions + item.activeSessions,
      totalRecipes: total.totalRecipes + item.stats.historyCount,
      totalFavorites: total.totalFavorites + item.stats.favoriteCount,
      totalWorkoutPlans:
        total.totalWorkoutPlans + item.stats.savedWorkoutPlanCount,
      totalNutritionDays:
        total.totalNutritionDays + item.stats.nutritionDayCount,
      totalNutritionEntries:
        total.totalNutritionEntries + item.stats.nutritionItemCount,
      totalAppActions: store.auditLog.length,
    }),
    {
      userCount: 0,
      standardUserCount: 0,
      adminCount: 0,
      activeSessions: 0,
      totalRecipes: 0,
      totalFavorites: 0,
      totalWorkoutPlans: 0,
      totalNutritionDays: 0,
      totalNutritionEntries: 0,
      totalAppActions: store.auditLog.length,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    timeZone: ISTANBUL_TIME_ZONE,
    summary,
    users,
    auditLog: store.auditLog.slice(0, 120),
  };
}

function stableCacheValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableCacheValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableCacheValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

function aiCacheKey(kind, parameters) {
  const payload = JSON.stringify(stableCacheValue(parameters));
  return `${kind}:${crypto.createHash('sha256').update(payload).digest('hex')}`;
}

function cacheIngredientKey(value) {
  const cleaned = cleanIngredientHint(value);
  const normalized = normalizeLookupText(cleaned);
  const aliased =
    INGREDIENT_ALIASES[cleaned] ||
    INGREDIENT_ALIASES[normalized] ||
    INGREDIENT_ALIASES[normalizeLookupText(value)];
  return normalizeLookupText(aliased || normalized);
}

function recipeCacheParameters(ingredientsText, language) {
  const ingredients = Array.from(
    new Set(splitIngredientInput(ingredientsText).map(cacheIngredientKey).filter(Boolean))
  )
    .sort();
  return {
    language: normalizeLanguage(language),
    ingredients: ingredients.length
      ? ingredients
      : [normalizeLookupText(ingredientsText)].filter(Boolean),
  };
}

function workoutCacheParameters(goalText, duration, regions, language) {
  const selectedRegions = Array.isArray(regions)
    ? regions.filter((region) => VALID_REGIONS.has(region)).sort()
    : [];
  return {
    language: normalizeLanguage(language),
    duration: VALID_DURATIONS.has(duration) ? duration : 'weekly',
    regions: selectedRegions,
    goal: normalizeLookupText(goalText || 'general fitness'),
  };
}

function supabaseCacheConfig() {
  const apiKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !apiKey) {
    return null;
  }
  return {
    apiKey,
    tableUrl: `${SUPABASE_URL}/rest/v1/${encodeURIComponent(
      SUPABASE_AI_CACHE_TABLE
    )}`,
  };
}

function supabaseHeaders(extra = {}) {
  const config = supabaseCacheConfig();
  if (!config) {
    return {};
  }
  return {
    apikey: config.apiKey,
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function normalizeAiCacheItem(item) {
  if (!item || typeof item !== 'object' || !item.payload) {
    return null;
  }
  return {
    key: String(item.key || item.cache_key || '').trim(),
    kind: String(item.kind || '').trim(),
    payload: item.payload,
    source: String(item.source || '').trim(),
    updatedAt: String(item.updatedAt || item.updated_at || new Date().toISOString()),
  };
}

function getLocalAiCache(cacheKey) {
  const store = readStore();
  return normalizeAiCacheItem(
    store.aiCache.find((item) => item.key === cacheKey || item.cache_key === cacheKey)
  );
}

function rememberLocalAiCache(item) {
  const normalized = normalizeAiCacheItem(item);
  if (!normalized?.key) {
    return;
  }
  const store = readStore();
  store.aiCache = [
    normalized,
    ...store.aiCache.filter(
      (cacheItem) => cacheItem.key !== normalized.key && cacheItem.cache_key !== normalized.key
    ),
  ].slice(0, AI_CACHE_LIMIT);
  writeStore(store);
}

async function getSupabaseAiCache(cacheKey) {
  const config = supabaseCacheConfig();
  if (!config) {
    return null;
  }

  const url = `${config.tableUrl}?cache_key=eq.${encodeURIComponent(
    cacheKey
  )}&select=cache_key,kind,payload,source,updated_at&limit=1`;
  const response = await fetch(url, {
    headers: supabaseHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Supabase cache read failed: ${response.status}`);
  }
  const rows = await response.json();
  return normalizeAiCacheItem(rows?.[0]);
}

async function rememberSupabaseAiCache(item) {
  const config = supabaseCacheConfig();
  const normalized = normalizeAiCacheItem(item);
  if (!config || !normalized?.key) {
    return;
  }

  const response = await fetch(`${config.tableUrl}?on_conflict=cache_key`, {
    method: 'POST',
    headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify({
      cache_key: normalized.key,
      kind: normalized.kind,
      payload: normalized.payload,
      source: normalized.source,
      updated_at: normalized.updatedAt,
    }),
  });
  if (!response.ok) {
    throw new Error(`Supabase cache write failed: ${response.status}`);
  }
}

async function getCachedAiResponse(cacheKey) {
  try {
    const supabaseItem = await getSupabaseAiCache(cacheKey);
    if (supabaseItem?.payload) {
      rememberLocalAiCache(supabaseItem);
      return supabaseItem;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'Supabase AI cache read skipped.',
        error instanceof Error ? error.message : error
      );
    }
  }

  return getLocalAiCache(cacheKey);
}

async function rememberAiResponse({ cacheKey, kind, payload, source }) {
  if (!cacheKey || !payload) {
    return;
  }

  const item = {
    key: cacheKey,
    kind,
    payload,
    source,
    updatedAt: new Date().toISOString(),
  };
  rememberLocalAiCache(item);

  try {
    await rememberSupabaseAiCache(item);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'Supabase AI cache write skipped.',
        error instanceof Error ? error.message : error
      );
    }
  }
}

function appHelpCacheKey(question, language) {
  return `${normalizeLanguage(language)}:${normalizeLookupText(question)}`;
}

function getCachedAppAnswer(question, language) {
  const key = appHelpCacheKey(question, language);
  if (!key.endsWith(':')) {
    const store = readStore();
    return store.appHelpCache.find((item) => item.key === key) || null;
  }
  return null;
}

function rememberAppAnswer(question, language, answer, source) {
  const normalizedAnswer = String(answer || '').trim();
  const key = appHelpCacheKey(question, language);
  if (!normalizedAnswer || key.endsWith(':')) {
    return;
  }

  const store = readStore();
  const nextItem = {
    key,
    question: String(question || '').trim().slice(0, 280),
    language: normalizeLanguage(language),
    answer: normalizedAnswer,
    source,
    updatedAt: new Date().toISOString(),
  };
  store.appHelpCache = [
    nextItem,
    ...store.appHelpCache.filter((item) => item.key !== key),
  ].slice(0, APP_HELP_CACHE_LIMIT);
  writeStore(store);
}

function ensureAdminUser() {
  if (!ADMIN_PASSWORD) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        'ADMIN_PASSWORD is not set. Automatic admin bootstrap is disabled.'
      );
    }
    return;
  }

  const store = readStore();
  const existing = store.users.find((user) => user.email === ADMIN_EMAIL);
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      writeStore(store);
    }
    return;
  }

  const createdAt = new Date().toISOString();
  store.users.push({
    id: crypto.randomUUID(),
    email: ADMIN_EMAIL,
    passwordHash: hashPassword(ADMIN_PASSWORD),
    role: 'admin',
    createdAt,
    lastLoginAt: undefined,
    lastLogoutAt: undefined,
    lastSeenAt: undefined,
      profile: {
        displayName: 'Admin',
        language: 'tr',
        themeColor: 'obsidian',
        avatarColor: 'mint',
        photoUri: undefined,
      },
    data: defaultUserData(),
  });
  writeStore(store);
}

async function generateRecipeWithProvider(providerId, ingredientsText, language) {
  let text = '';
  if (providerId === 'gemini') {
    text = await askGeminiWithRetry(recipePrompt(ingredientsText, language, 'Gemini'), {
      expectJson: true,
    });
  } else if (providerId === 'chatgpt') {
    text = await askOpenAiCompatible({
      prompt: recipePrompt(ingredientsText, language, 'ChatGPT'),
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
      baseUrl: OPENAI_BASE_URL,
      providerLabel: 'ChatGPT',
    });
  } else if (providerId === 'grok') {
    text = await askOpenAiCompatible({
      prompt: recipePrompt(ingredientsText, language, 'Grok'),
      apiKey: XAI_API_KEY,
      model: XAI_MODEL,
      baseUrl: XAI_BASE_URL,
      providerLabel: 'Grok',
    });
  } else {
    throw new Error(`Unknown recipe provider: ${providerId}`);
  }

  const parsed = parseGeminiJson(text);
  return normalizeGeneratedRecipe(parsed, ingredientsText, language, providerId);
}

app.get('/health', (_req, res) => {
  if (IS_PRODUCTION) {
    return res.json({
      ok: true,
      service: 'ai-server',
    });
  }

  return res.json({
    ok: true,
    service: 'ai-server',
    storage: path.basename(DATA_FILE),
    encrypted: true,
    aiConfigured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
    recipeProvider: 'gemini+themealdb',
    aiCache: {
      provider: supabaseCacheConfig() ? 'supabase' : 'local-encrypted',
      table: SUPABASE_AI_CACHE_TABLE,
    },
    providers: {
      gemini: Boolean(GEMINI_API_KEY),
      chatgpt: Boolean(OPENAI_API_KEY),
      grok: Boolean(XAI_API_KEY),
    },
  });
});

app.get('/api/app/config', (_req, res) => {
  const store = readStore();
  res.json({ config: normalizeAppConfig(store.appConfig) });
});

app.put('/api/admin/app-config', requireAuth, requireAdmin, userDataRateLimit, (req, res) => {
  try {
    const store = readStore();
    const adminUser = findUserOrThrow(store, req.userId);
    store.appConfig = normalizeAppConfig({
      ...(req.body?.config || {}),
      updatedAt: new Date().toISOString(),
    });
    recordAudit(store, {
      req,
      user: adminUser,
      type: 'admin_config_update',
      label: 'Admin updated app buttons',
      details: {
        buttonCount: store.appConfig.adminButtons.length,
      },
    });
    writeStore(store);
    return res.json({ config: store.appConfig });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown app config update error',
    });
  }
});

app.get('/api/admin/analytics', requireAuth, requireAdmin, userDataRateLimit, (req, res) => {
  try {
    const store = readStore();
    const adminUser = findUserOrThrow(store, req.userId);
    recordAudit(store, {
      req,
      user: adminUser,
      type: 'admin_analytics_view',
      label: 'Admin opened analytics',
      details: {
        userCount: store.users.length,
      },
    });
    writeStore(store);
    return res.json({ analytics: buildAdminAnalytics(readStore()) });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown admin analytics error',
    });
  }
});

app.post('/api/ai/recipe', aiRateLimit, async (req, res) => {
  try {
    const ingredientsText = String(req.body?.ingredientsText || '').trim().slice(0, 1200);
    const language = normalizeLanguage(req.body?.language);
    let geminiWarning = '';

    if (!ingredientsText) {
      return res.status(400).json({ error: 'ingredientsText is required' });
    }

    const cacheKey = aiCacheKey(
      'recipe',
      recipeCacheParameters(ingredientsText, language)
    );
    const cached = await getCachedAiResponse(cacheKey);
    if (cached?.payload?.recipe) {
      const recipe = await normalizeGeneratedRecipe(
        cached.payload.recipe,
        ingredientsText,
        language,
        cached.source || 'cache'
      );
      if (recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.2 })) {
        return res.json({ recipe, cached: true, provider: cached.source || 'cache' });
      }
    }

    recordAnonymousAudit(req, 'ai_recipe_request', 'AI recipe requested', {
      language,
      ingredientCount: splitIngredientInput(ingredientsText).length,
    });

    if (GEMINI_API_KEY) {
      try {
        const recipe = await generateRecipeWithProvider(
          'gemini',
          ingredientsText,
          language
        );
        if (recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.34 })) {
          await rememberAiResponse({
            cacheKey,
            kind: 'recipe',
            payload: { recipe },
            source: 'gemini',
          });
          return res.json({ recipe, provider: 'gemini' });
        }
        if (recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.2 })) {
          await rememberAiResponse({
            cacheKey,
            kind: 'recipe',
            payload: { recipe },
            source: 'gemini',
          });
          return res.json({
            recipe,
            provider: 'gemini',
            warning:
              'Recipe generated with partial ingredient coverage. Consider adding more specific ingredient names.',
          });
        }
      } catch (error) {
        geminiWarning = error instanceof Error ? error.message : String(error);
        if (process.env.NODE_ENV !== 'test') {
          console.warn(
            'Gemini recipe generation failed. Falling back to online recipe search.',
            geminiWarning
          );
        }
      }
    }

    const onlineRecipe = await findOnlineRecipe(ingredientsText, language).catch(() => null);
    if (
      onlineRecipe &&
      recipeLooksUsable(onlineRecipe, ingredientsText, { minCoverage: 0.2 })
    ) {
      const imageUrl =
        onlineRecipe.imageUrl ||
        (await resolveRecipeImage(onlineRecipe, ingredientsText).catch(() => undefined));
      const recipe = { ...onlineRecipe, imageUrl };
      await rememberAiResponse({
        cacheKey,
        kind: 'recipe',
        payload: { recipe },
        source: 'themealdb',
      });
      return res.json({
        recipe,
        provider: 'themealdb',
        ...(geminiWarning ? { warning: geminiWarning } : {}),
      });
    }

    const fallback = fallbackRecipe(ingredientsText, language);
    await rememberAiResponse({
      cacheKey,
      kind: 'recipe',
      payload: { recipe: fallback },
      source: 'fallback',
    });
    return res.json({
      recipe: fallback,
      ...(geminiWarning ? { warning: geminiWarning } : {}),
    });
  } catch (error) {
    const ingredientsText = String(req.body?.ingredientsText || '').trim().slice(0, 1200);
    const language = normalizeLanguage(req.body?.language);
    const fallback = fallbackRecipe(ingredientsText, language);
    try {
      await rememberAiResponse({
        cacheKey: aiCacheKey('recipe', recipeCacheParameters(ingredientsText, language)),
        kind: 'recipe',
        payload: { recipe: fallback },
        source: 'fallback',
      });
    } catch {
      // Cache write failures should not block a safe response.
    }
    return res.json({
      recipe: fallback,
      warning: error instanceof Error ? error.message : 'Unknown recipe error',
    });
  }
});

app.post('/api/ai/recipe-variants', aiRateLimit, async (req, res) => {
  try {
    const ingredientsText = String(req.body?.ingredientsText || '').trim().slice(0, 1200);
    const language = normalizeLanguage(req.body?.language);

    if (!ingredientsText) {
      return res.status(400).json({ error: 'ingredientsText is required' });
    }

    recordAnonymousAudit(req, 'ai_recipe_variants_request', 'AI recipe variants requested', {
      language,
      ingredientCount: splitIngredientInput(ingredientsText).length,
    });

    const providers = [
      {
        id: 'gemini',
        label: 'Gemini',
        model: GEMINI_MODEL,
        available: Boolean(GEMINI_API_KEY),
      },
      {
        id: 'chatgpt',
        label: 'ChatGPT',
        model: OPENAI_MODEL,
        available: Boolean(OPENAI_API_KEY),
      },
      {
        id: 'grok',
        label: 'Grok',
        model: XAI_MODEL,
        available: Boolean(XAI_API_KEY),
      },
    ];

    const variants = await Promise.all(
      providers.map(async (provider) => {
        if (!provider.available) {
          return {
            provider: provider.id,
            label: provider.label,
            model: provider.model,
            available: false,
            warning: `${provider.label} API key is not configured on the server.`,
          };
        }

        try {
          const recipe = await generateRecipeWithProvider(
            provider.id,
            ingredientsText,
            language
          );
          if (!recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.2 })) {
            return {
              provider: provider.id,
              label: provider.label,
              model: provider.model,
              available: true,
              warning:
                'The generated recipe was incomplete or weakly matched to ingredients.',
            };
          }
          return {
            provider: provider.id,
            label: provider.label,
            model: provider.model,
            available: true,
            recipe,
          };
        } catch (error) {
          return {
            provider: provider.id,
            label: provider.label,
            model: provider.model,
            available: true,
            warning: error instanceof Error ? error.message : 'Unknown provider error',
          };
        }
      })
    );

    return res.json({ variants });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Unknown recipe variants generation error',
    });
  }
});

app.post('/api/ai/translate-recipe', aiRateLimit, async (req, res) => {
  try {
    const recipe = req.body?.recipe;
    const language = normalizeLanguage(req.body?.language);

    if (!recipe) {
      return res.status(400).json({ error: 'recipe is required' });
    }

    if (language === 'en') {
      return res.json({ recipe: localizedRecipeCopy(recipe, 'en') });
    }

    if (GEMINI_API_KEY) {
      try {
        const text = await askGeminiWithRetry(translationPrompt(recipe, language), {
          expectJson: true,
        });
        const parsed = parseGeminiJson(text);
        return res.json({
          recipe: withRecipeMeta(
            normalizeRecipe({
              ...parsed,
              id: recipe.id,
              source: recipe.source,
              locale: language,
            }),
            `${recipe.id || recipe.title || 'recipe'}-${language}`,
            language
          ),
        });
      } catch {
        // Fall through to a safe localized copy without failing the request.
      }
    }

    return res.json({
      recipe: localizedRecipeCopy(recipe, language),
    });
  } catch (error) {
    return res.json({
      recipe: localizedRecipeCopy(req.body?.recipe, req.body?.language),
      warning: error instanceof Error ? error.message : 'Unknown translation error',
    });
  }
});

app.post('/api/ai/workout-plan', aiRateLimit, async (req, res) => {
  try {
    const goalText = String(req.body?.goalText || '').trim().slice(0, 1000);
    const duration = VALID_DURATIONS.has(req.body?.duration) ? req.body.duration : 'weekly';
    const regions = Array.isArray(req.body?.regions)
      ? req.body.regions.filter((region) => VALID_REGIONS.has(region))
      : [];
    const language = normalizeLanguage(req.body?.language);
    const fallbackPlan = fallbackWorkoutPlan(goalText, duration, regions, language);
    const cacheKey = aiCacheKey(
      'workout-plan',
      workoutCacheParameters(goalText, duration, regions, language)
    );
    const cached = await getCachedAiResponse(cacheKey);
    if (cached?.payload?.plan) {
      const plan = normalizeWorkoutPlan(
        {
          ...cached.payload.plan,
          duration,
          regions,
        },
        duration
      );
      if (plan.days.length) {
        return res.json({ plan });
      }
    }

    if (!GEMINI_API_KEY) {
      return res.json({
        plan: fallbackPlan,
        fallback: true,
        warning:
          'Gemini API key missing. Returned a safe fallback workout plan instead.',
      });
    }

    const text = await askGeminiWithRetry(
      workoutPlanPrompt(goalText, duration, regions, language),
      {
        expectJson: true,
      }
    );
    const parsed = parseGeminiJson(text);
    const plan = normalizeWorkoutPlan(
      {
        ...parsed,
        duration,
        regions,
        createdAt: new Date().toISOString(),
      },
      duration
    );

    if (!plan.days.length) {
      return res.json({
        plan: fallbackPlan,
        fallback: true,
        warning: 'AI workout plan content was incomplete. Returned fallback plan.',
      });
    }

    await rememberAiResponse({
      cacheKey,
      kind: 'workout-plan',
      payload: { plan },
      source: 'gemini',
    });

    return res.json({ plan });
  } catch (error) {
    const goalText = String(req.body?.goalText || '').trim();
    const duration = VALID_DURATIONS.has(req.body?.duration) ? req.body.duration : 'weekly';
    const regions = Array.isArray(req.body?.regions)
      ? req.body.regions.filter((region) => VALID_REGIONS.has(region))
      : [];
    const language = normalizeLanguage(req.body?.language);
    return res.json({
      plan: fallbackWorkoutPlan(goalText, duration, regions, language),
      fallback: true,
      warning: error instanceof Error ? error.message : 'Unknown workout plan error',
    });
  }
});

app.post('/api/ai/app-help', aiRateLimit, async (req, res) => {
  try {
    const question = String(req.body?.question || '').trim().slice(0, 800);
    const language = normalizeLanguage(req.body?.language);

    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    const cached = getCachedAppAnswer(question, language);
    if (cached?.answer) {
      return res.json({ answer: cached.answer, cached: true });
    }

    if (!GEMINI_API_KEY) {
      const fallbackAnswer = fallbackAppAnswer(question, language);
      rememberAppAnswer(question, language, fallbackAnswer, 'fallback');
      return res.json({
        answer: fallbackAnswer,
        fallback: true,
        warning: 'Gemini API key missing. Returned fallback app guidance.',
      });
    }

    const answer = (await askGeminiWithRetry(appHelpPrompt(question, language))).trim();
    if (!answer) {
      const fallbackAnswer = fallbackAppAnswer(question, language);
      rememberAppAnswer(question, language, fallbackAnswer, 'fallback');
      return res.json({
        answer: fallbackAnswer,
        fallback: true,
        warning: 'AI app help response was empty. Returned fallback app guidance.',
      });
    }

    rememberAppAnswer(question, language, answer, 'ai');
    return res.json({ answer });
  } catch (error) {
    const question = String(req.body?.question || '').trim();
    const language = normalizeLanguage(req.body?.language);
    const fallbackAnswer = fallbackAppAnswer(question, language);
    rememberAppAnswer(question, language, fallbackAnswer, 'fallback');
    return res.json({
      answer: fallbackAnswer,
      fallback: true,
      warning: error instanceof Error ? error.message : 'Unknown app help error',
    });
  }
});

app.post('/api/auth/register', authRateLimit, (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const confirmPassword = String(req.body?.confirmPassword || '');
    const language = normalizeLanguage(req.body?.language);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const store = readStore();
    const existing = store.users.find((user) => user.email === email);
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    const now = new Date().toISOString();
    const user = {
      id: crypto.randomUUID(),
      email,
      passwordHash: hashPassword(password),
      role: 'user',
      createdAt: now,
      lastLoginAt: now,
      lastLogoutAt: undefined,
      lastSeenAt: now,
      profile: {
        displayName: email.split('@')[0],
        language,
        themeColor: 'obsidian',
        avatarColor: 'mint',
        photoUri: undefined,
      },
      data: defaultUserData(),
    };

    store.users.push(user);
    recordAudit(store, {
      req,
      user,
      type: 'register',
      label: 'User registered',
      details: { language },
    });
    writeStore(store);

    const token = createSession(user.id, req);
    return res.status(201).json({
      token,
      user: sanitizeUser(user),
      data: normalizeUserData(user.data),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown register error',
    });
  }
});

app.post('/api/auth/login', authRateLimit, (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const store = readStore();
    const user = store.users.find((item) => item.email === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Email or password is incorrect' });
    }

    const now = new Date();
    const nutritionWindow = resolveNutritionWindow(user.data, now);
    user.data = nutritionWindow.data;
    user.lastLoginAt = now.toISOString();
    user.lastSeenAt = now.toISOString();
    recordAudit(store, {
      req,
      user,
      type: 'login',
      label: 'User logged in',
      details: {
        lastLogoutAt: validIso(user.lastLogoutAt),
        nutritionReset: nutritionWindow.reset,
        nutritionElapsedHours: Math.round(nutritionWindow.elapsedHours * 10) / 10,
      },
    });
    writeStore(store);

    const token = createSession(user.id, req);
    return res.json({
      token,
      user: sanitizeUser(user),
      data: user.data,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown login error',
    });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  try {
    const store = readStore();
    const user = findUserOrThrow(store, req.userId);
    const now = new Date().toISOString();
    user.lastLogoutAt = now;
    user.lastSeenAt = now;
    recordAudit(store, {
      req,
      user,
      type: 'logout',
      label: 'User logged out',
      details: {
        sessionStartedAt: sessions.get(req.token)?.createdAt
          ? new Date(sessions.get(req.token).createdAt).toISOString()
          : undefined,
      },
    });
    writeStore(store);
  } catch {
    // Logging out should still clear the in-memory session.
  }
  sessions.delete(req.token);
  res.json({ ok: true });
});

app.get('/api/user/state', requireAuth, (req, res) => {
  try {
    const store = readStore();
    const user = findUserOrThrow(store, req.userId);
    const nutritionWindow = resolveNutritionWindow(user.data, new Date());
    if (nutritionWindow.reset) {
      user.data = nutritionWindow.data;
      recordAudit(store, {
        req,
        user,
        type: 'nutrition_reset',
        label: 'Nutrition tracker reset after 24 hours',
        details: {
          dateKey: nutritionWindow.dateKey,
          nutritionElapsedHours:
            Math.round(nutritionWindow.elapsedHours * 10) / 10,
        },
      });
      writeStore(store);
    }
    return res.json({
      user: sanitizeUser(user),
      data: nutritionWindow.data,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown state error',
    });
  }
});

app.put('/api/user/profile', requireAuth, userDataRateLimit, (req, res) => {
  try {
    const store = readStore();
    const user = findUserOrThrow(store, req.userId);
    const nextProfile = req.body?.profile || {};

    user.profile = {
      ...user.profile,
      displayName: String(nextProfile.displayName || user.profile.displayName || '')
        .trim()
        .slice(0, 60),
      language: normalizeLanguage(nextProfile.language || user.profile.language),
      themeColor: VALID_THEMES.has(nextProfile.themeColor)
        ? nextProfile.themeColor
        : user.profile.themeColor || 'obsidian',
      avatarColor: normalizeAvatarColor(
        nextProfile.avatarColor || user.profile.avatarColor
      ),
      photoUri: safePhotoUri(nextProfile.photoUri),
    };
    user.lastSeenAt = new Date().toISOString();
    recordAudit(store, {
      req,
      user,
      type: 'profile_update',
      label: 'User updated profile',
      details: {
        language: user.profile.language,
        themeColor: user.profile.themeColor,
        avatarColor: user.profile.avatarColor,
        hasPhoto: Boolean(user.profile.photoUri),
      },
    });

    writeStore(store);
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown profile update error',
    });
  }
});

app.post('/api/user/change-password', requireAuth, authRateLimit, (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const nextPassword = String(req.body?.nextPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (nextPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (nextPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }

    const store = readStore();
    const user = findUserOrThrow(store, req.userId);
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.passwordHash = hashPassword(nextPassword);
    user.lastSeenAt = new Date().toISOString();
    recordAudit(store, {
      req,
      user,
      type: 'password_change',
      label: 'User changed password',
    });
    writeStore(store);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown password update error',
    });
  }
});

app.put('/api/user/data', requireAuth, userDataRateLimit, (req, res) => {
  try {
    const store = readStore();
    const user = findUserOrThrow(store, req.userId);
    const before = summarizeUserData(user.data);
    const nutritionWindow = resolveNutritionWindow(req.body || {}, new Date());
    user.data = nutritionWindow.data;
    user.lastSeenAt = new Date().toISOString();
    const after = summarizeUserData(user.data);
    recordAudit(store, {
      req,
      user,
      type: 'data_sync',
      label: 'User data synced',
      details: {
        before: {
          recipes: before.historyCount,
          favorites: before.favoriteCount,
          plans: before.savedWorkoutPlanCount,
          nutritionItems: before.nutritionItemCount,
        },
        after: {
          recipes: after.historyCount,
          favorites: after.favoriteCount,
          plans: after.savedWorkoutPlanCount,
          nutritionItems: after.nutritionItemCount,
        },
        nutritionReset: nutritionWindow.reset,
      },
    });
    writeStore(store);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown data update error',
    });
  }
});

ensureAdminUser();

if (!GEMINI_API_KEY) {
  console.log(
    'Gemini API key is not set. Online recipe search still works via TheMealDB; Gemini-only features use safe fallbacks.'
  );
}

app.listen(port, '0.0.0.0', () => {
  console.log(`AI server running on http://0.0.0.0:${port}`);
  console.log(`Encrypted user storage enabled at ${DATA_FILE}`);
  console.log(`Gemini model: ${GEMINI_MODEL}`);
});
