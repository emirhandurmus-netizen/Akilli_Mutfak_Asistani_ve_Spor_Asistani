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
loadEnvFile(path.join(PROJECT_ROOT, 'env.local'), { override: true });
loadEnvFile(path.join(PROJECT_ROOT, '.env.local'), { override: true });

const app = express();
const port = Number(process.env.APP_SERVER_PORT || 3001);
const PUBLIC_APP_SERVER_URL = (
  process.env.APP_PUBLIC_SERVER_URL ||
  process.env.EXPO_PUBLIC_APP_SERVER_URL ||
  `http://127.0.0.1:${port}`
).replace(/\/+$/, '');
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@mobiluygulama.local')
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD?.trim() || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 24 * 60 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 30);
const SEARCH_RATE_LIMIT_MAX = Number(process.env.SEARCH_RATE_LIMIT_MAX || 80);
const USER_DATA_RATE_LIMIT_MAX = Number(process.env.USER_DATA_RATE_LIMIT_MAX || 120);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 30000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || '';
const GEMINI_API_BASE_URL = (
  process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
).replace(/\/+$/, '');
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
const GEMINI_GOOGLE_SEARCH_ENABLED = process.env.GEMINI_GOOGLE_SEARCH !== 'false';
const PROFILE_PHOTO_DATA_URI_LIMIT = Number(
  process.env.PROFILE_PHOTO_DATA_URI_LIMIT || 700000
);
const APP_HELP_CACHE_LIMIT = 500;
const SEARCH_CACHE_LIMIT = Number(process.env.SEARCH_CACHE_LIMIT || 700);
const AUDIT_LOG_LIMIT = 800;
const RECOMMENDATION_COUNT = 6;
const ISTANBUL_TIME_ZONE = 'Europe/Istanbul';
const NUTRITION_RESET_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = process.env.APP_DATA_FILE
  ? path.resolve(process.env.APP_DATA_FILE)
  : path.join(DEFAULT_DATA_DIR, 'users.secure.db');
const DATA_DIR = path.dirname(DATA_FILE);
const DATA_KEY_FILE = process.env.APP_DATA_KEY_FILE
  ? path.resolve(process.env.APP_DATA_KEY_FILE)
  : path.join(DATA_DIR, 'app-data.key');
const configuredDataSecret = process.env.APP_DATA_SECRET?.trim();
if (!configuredDataSecret && IS_PRODUCTION) {
  throw new Error('APP_DATA_SECRET must be configured in production.');
}

function hashDataSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

function readOrCreateProjectDataSecret() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_KEY_FILE)) {
    const existing = fs.readFileSync(DATA_KEY_FILE, 'utf8').trim();
    if (existing.length >= 32) {
      return existing;
    }
  }

  const generated = crypto.randomBytes(32).toString('base64url');
  fs.writeFileSync(DATA_KEY_FILE, `${generated}\n`, { encoding: 'utf8', mode: 0o600 });
  return generated;
}

const primaryDataSecret = configuredDataSecret || readOrCreateProjectDataSecret();
const legacyMachineDataSecret = `dev:${os.hostname()}:${PROJECT_ROOT}`;
const DATA_KEYS = [
  {
    label: configuredDataSecret ? 'APP_DATA_SECRET' : 'project data key',
    key: hashDataSecret(primaryDataSecret),
    primary: true,
  },
];
if (legacyMachineDataSecret !== primaryDataSecret) {
  DATA_KEYS.push({
    label: 'legacy machine-local development key',
    key: hashDataSecret(legacyMachineDataSecret),
    primary: false,
  });
}
const DATA_SECRET = DATA_KEYS[0].key;
if (!configuredDataSecret && process.env.NODE_ENV !== 'test') {
  console.warn(
    `APP_DATA_SECRET is not set. Using project-local data key at ${DATA_KEY_FILE}. Copy this key with ${DATA_FILE} when moving registered users to another computer.`
  );
}
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
    title: 'Kaynak destekli spor plani',
    summary: 'Hedef ve secili bolgelere gore guvenli bir spor plani hazirlandi.',
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
    title: 'Source-backed workout plan',
    summary: 'A safe workout plan was prepared from your goal and selected regions.',
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
    title: 'Quellenbasierter Trainingsplan',
    summary: 'Ein sicherer Trainingsplan wurde aus Ziel und Fokusbereichen erstellt.',
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
    title: 'Plan de entrenamiento con fuentes',
    summary: 'Se preparo un plan seguro segun tu objetivo y regiones seleccionadas.',
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
    search:
      'Tarifler girilen malzemelerle webdeki yemek sitelerinde ve YouTube aramasinda aranir. Uygun sonuc bulunamazsa yerel, guvenli bir yedek tarif gosterilir.',
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
    search:
      'Recipes are searched from cooking websites and YouTube using the entered ingredients. If no usable match is found, the app shows a safe local fallback recipe.',
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
    search:
      'Rezepte werden anhand der Zutaten auf Rezeptseiten und YouTube gesucht. Wenn kein brauchbarer Treffer gefunden wird, zeigt die App ein sicheres lokales Ersatzrezept.',
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
    search:
      'Las recetas se buscan en sitios de cocina y YouTube usando los ingredientes. Si no hay un resultado util, la app muestra una receta local segura.',
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
  sucuk: 'Sausage',
  sosis: 'Sausage',
  ekmek: 'Bread',
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
  sausage: 'Sausage',
  bread: 'Bread',
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

const SEARCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const RECIPE_SEARCH_DOMAINS = [
  'nefisyemektarifleri.com',
  'yemek.com',
  'lezzet.com.tr',
  'refikaninmutfagi.com',
  'ardaninmutfagi.com',
  'allrecipes.com',
  'bbcgoodfood.com',
  'eatingwell.com',
];
const THEMEALDB_API_BASE = 'https://www.themealdb.com/api/json/v1/1';
const THEMEALDB_INGREDIENT_FALLBACKS = {
  'chicken breast': ['chicken_breast', 'chicken'],
  'chicken thigh': ['chicken_thigh', 'chicken'],
  potatoes: ['potatoes', 'potato'],
  mushrooms: ['mushrooms', 'mushroom'],
  courgettes: ['courgettes', 'zucchini'],
  aubergine: ['aubergine', 'eggplant'],
  'green beans': ['green_beans', 'beans'],
  chickpeas: ['chickpeas', 'chickpea'],
  lentils: ['lentils', 'lentil'],
  'olive oil': ['olive_oil', 'oil'],
};
const THEMEALDB_REVERSE_ALIASES_TR = {
  beef: 'et',
  bread: 'ekmek',
  broccoli: 'brokoli',
  butter: 'tereyagi',
  carrot: 'havuc',
  cheese: 'peynir',
  chicken: 'tavuk',
  'chicken breast': 'tavuk gogsu',
  chickpeas: 'nohut',
  chopped: 'dogranmis',
  crushed: 'ezilmis',
  cucumber: 'salatalik',
  egg: 'yumurta',
  eggplant: 'patlican',
  fish: 'balik',
  flour: 'un',
  garlic: 'sarimsak',
  ginger: 'zencefil',
  lemon: 'limon',
  lentils: 'mercimek',
  milk: 'sut',
  mushroom: 'mantar',
  mushrooms: 'mantar',
  oil: 'yag',
  onion: 'sogan',
  pasta: 'makarna',
  paste: 'ezmesi',
  parsley: 'maydanoz',
  pepper: 'biber',
  potato: 'patates',
  potatoes: 'patates',
  puree: 'puresi',
  red: 'kirmizi',
  rice: 'pirinc',
  salmon: 'somon',
  spinach: 'ispanak',
  stock: 'suyu',
  thyme: 'kekik',
  tomato: 'domates',
  tomatoes: 'domates',
  tuna: 'ton baligi',
  white: 'beyaz',
  whole: 'butun',
  wine: 'sarap',
  yogurt: 'yogurt',
  zucchini: 'kabak',
};
const WORKOUT_SEARCH_DOMAINS = [
  'acefitness.org',
  'verywellfit.com',
  'muscleandstrength.com',
  'exrx.net',
  'self.com',
];

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
const searchRateLimit = createRateLimiter({
  label: 'search',
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: SEARCH_RATE_LIMIT_MAX,
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

function decryptJsonWithKey(payload, key) {
  const [prefix, ivText, tagText, encryptedText] = String(payload || '').split(':');
  if (prefix !== 'enc' || !ivText || !tagText || !encryptedText) {
    throw new Error('Encrypted data file is invalid');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

function decryptJson(payload) {
  let lastError = null;
  for (const dataKey of DATA_KEYS) {
    try {
      return {
        data: decryptJsonWithKey(payload, dataKey.key),
        keyLabel: dataKey.label,
        primary: dataKey.primary,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Encrypted data file could not be opened');
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
    searchCache: Array.isArray(shaped.searchCache)
      ? shaped.searchCache.slice(0, SEARCH_CACHE_LIMIT)
      : [],
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
    const opened = decryptJson(fs.readFileSync(DATA_FILE, 'utf8'));
    const store = ensureStoreShape(opened.data);
    if (!opened.primary) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${DATA_FILE}.pre-portable-key-${timestamp}`;
      fs.copyFileSync(DATA_FILE, backupFile);
      writeStore(store);
      console.warn(
        `Encrypted user storage was opened with ${opened.keyLabel}. Backed it up to ${backupFile} and re-saved it with the portable primary key.`
      );
    }
    return store;
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

function webHeaders(extra = {}) {
  return {
    'User-Agent': SEARCH_USER_AGENT,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    ...extra,
  };
}

async function fetchText(url, options = {}, timeoutMs = 12000) {
  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers: webHeaders(options.headers || {}),
    },
    timeoutMs
  );
  if (!response.ok) {
    throw new Error(`Remote page failed: ${response.status}`);
  }
  return await response.text();
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    hellip: '...',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
  };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const key = String(entity).toLowerCase();
    if (key.startsWith('#x')) {
      return String.fromCodePoint(parseInt(key.slice(2), 16));
    }
    if (key.startsWith('#')) {
      return String.fromCodePoint(parseInt(key.slice(1), 10));
    }
    return named[key] || match;
  });
}

function normalizeWhitespace(value) {
  return decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(value) {
  return normalizeWhitespace(
    String(value || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );
}

function absoluteUrl(candidate, baseUrl) {
  const raw = decodeHtmlEntities(candidate).trim();
  if (!raw || raw.startsWith('javascript:') || raw.startsWith('mailto:')) {
    return null;
  }
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

function extractMetaContent(html, names) {
  for (const name of names) {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    );
    const reversePattern = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`,
      'i'
    );
    const match = html.match(pattern) || html.match(reversePattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1]);
    }
  }
  return '';
}

function extractTitleFromHtml(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  if (h1) {
    return stripHtml(h1);
  }
  return (
    extractMetaContent(html, ['og:title', 'twitter:title']) ||
    stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
  );
}

function uniqueStrings(values, limit = 20) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const cleaned = normalizeRecipeLine(value);
    const key = normalizeLookupText(cleaned);
    if (!cleaned || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(cleaned);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

function arrayFromUnknown(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return [value];
}

function textFromUnknown(value) {
  if (typeof value === 'string') {
    return stripHtml(value);
  }
  if (Array.isArray(value)) {
    return value.map(textFromUnknown).filter(Boolean).join(' ');
  }
  if (value && typeof value === 'object') {
    return textFromUnknown(value.text || value.name || value.description || '');
  }
  return '';
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
    sourceUrl: recipe.sourceUrl ? String(recipe.sourceUrl).trim() : undefined,
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
  const delimiterItems = String(ingredientsText || '')
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (delimiterItems.length > 1) {
    return delimiterItems;
  }

  const freeTextItems = splitFreeTextIngredients(ingredientsText);
  return freeTextItems.length ? freeTextItems : delimiterItems;
}

function splitFreeTextIngredients(ingredientsText) {
  const normalized = normalizeLookupText(ingredientsText);
  const words = normalized.split(' ').filter(Boolean);
  if (words.length < 2) {
    return [];
  }

  const knownTerms = new Set(
    [...Object.keys(INGREDIENT_ALIASES), ...Object.values(INGREDIENT_ALIASES)]
      .map((value) => normalizeLookupText(value))
      .filter(Boolean)
  );
  const items = [];
  let knownCount = 0;
  let index = 0;

  while (index < words.length) {
    let matched = '';
    for (let size = Math.min(3, words.length - index); size >= 1; size -= 1) {
      const candidate = words.slice(index, index + size).join(' ');
      if (knownTerms.has(candidate)) {
        matched = candidate;
        break;
      }
    }

    if (matched) {
      items.push(matched);
      knownCount += 1;
      index += matched.split(' ').length;
      continue;
    }

    if (!INGREDIENT_NOISE_WORDS.has(words[index])) {
      items.push(words[index]);
    }
    index += 1;
  }

  return knownCount >= 2 ? Array.from(new Set(items)) : [];
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

function requiredIngredientCoverage(ingredientsText) {
  const requestedCount = new Set(
    splitIngredientInput(ingredientsText)
      .map((item) => cleanIngredientHint(item))
      .map((item) => normalizeLookupText(item))
      .filter(Boolean)
  ).size;
  if (requestedCount <= 3) {
    return 1;
  }
  if (requestedCount === 4) {
    return 0.75;
  }
  return 0.65;
}

function requestAllowsSalad(ingredientsText) {
  const requested = new Set(normalizeLookupText(ingredientsText).split(' ').filter(Boolean));
  return ['salata', 'salad', 'lettuce', 'marul', 'cucumber', 'salatalik'].some((word) =>
    requested.has(word)
  );
}

function recipeLooksLikeUnrequestedSalad(recipe, ingredientsText) {
  if (requestAllowsSalad(ingredientsText)) {
    return false;
  }
  return /\b(salata|salad)\b/.test(normalizeLookupText(recipe?.title || ''));
}

function recipeLooksUsable(recipe, ingredientsText, { minCoverage = 0.34 } = {}) {
  const hasTitle = Boolean(String(recipe?.title || '').trim());
  const hasIngredients = Array.isArray(recipe?.ingredients) && recipe.ingredients.length >= 3;
  const hasSteps = Array.isArray(recipe?.steps) && recipe.steps.length >= 3;
  if (!hasTitle || !hasIngredients || !hasSteps) {
    return false;
  }
  if (recipeLooksLikeUnrequestedSalad(recipe, ingredientsText)) {
    return false;
  }
  const coverage = ingredientCoverageRatio(recipe, ingredientsText);
  return coverage >= Math.max(minCoverage, requiredIngredientCoverage(ingredientsText));
}

function isUnstableRecipeImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) {
    return true;
  }
  return /source\.unsplash\.com|photo-1546069901-ba9599a7e63c/i.test(value);
}

async function resolveRecipeImage(recipe, ingredientsText, language) {
  if (recipe?.imageUrl && !isUnstableRecipeImageUrl(recipe.imageUrl)) {
    return String(recipe.imageUrl);
  }
  return recipeImageSearchUrl(ingredientsText, recipe?.title || '', language || recipe?.locale);
}

async function normalizeFoundRecipe(rawRecipe, ingredientsText, language, sourceLabel) {
  const normalized = sanitizeRecipeShape(
    withRecipeMeta(
      normalizeRecipe({
        ...rawRecipe,
        locale: language,
        source: 'generated',
      }),
      `${sourceLabel}-${ingredientsText}-${language}`,
      language
    )
  );

  const summaryText =
    normalizeLanguage(language) === 'tr'
      ? `${sourceLabel} kaynagindan malzemelerine uygun tarif bulundu.`
      : `Recipe found from ${sourceLabel} and matched to your ingredients.`;
  const withVideo = withRecipeYoutubeUrl(normalized, ingredientsText, language);

  return {
    ...withVideo,
    summary: withVideo.summary || summaryText,
    imageUrl: await resolveRecipeImage(withVideo, ingredientsText, language),
  };
}

function geminiRecipeSchema() {
  return {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short recipe title in the requested language.',
      },
      summary: {
        type: 'string',
        description: 'One or two sentence recipe summary in the requested language.',
      },
      ingredients: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ingredient list with quantities. Include every user ingredient.',
      },
      steps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Step-by-step cooking instructions in order.',
      },
      cookTime: {
        type: 'string',
        description: 'Estimated total cooking time, for example 20 dk or 20 min.',
      },
      calories: {
        type: 'string',
        description: 'Estimated calories per serving, for example 520 kcal.',
      },
      nutrition: {
        type: 'object',
        properties: {
          protein: { type: 'string' },
          carbs: { type: 'string' },
          fat: { type: 'string' },
        },
        required: ['protein', 'carbs', 'fat'],
      },
      sourceUrl: {
        type: 'string',
        description: 'Optional public recipe or reference URL when available.',
      },
    },
    required: ['title', 'summary', 'ingredients', 'steps', 'cookTime', 'calories', 'nutrition'],
  };
}

function geminiModelCandidates() {
  return uniqueStrings(
    [GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    4
  );
}

function geminiRecipePrompt(ingredientsText, language, mode = 'primary') {
  const safeLanguage = normalizeLanguage(language);
  const requestedItems = splitIngredientInput(ingredientsText)
    .map(cleanIngredientHint)
    .filter(Boolean);
  const requestLine = requestedItems.length ? requestedItems.join(', ') : ingredientsText;
  const languageName = languageLabel(safeLanguage);
  const variantInstruction =
    mode === 'variant'
      ? 'Create a meaningfully different variation from the first obvious recipe while still using every user ingredient.'
      : 'Create the most practical matching home recipe.';

  return [
    'You are a careful cooking assistant for a mobile kitchen app.',
    'Research common real recipes and pairings with Google Search when the tool is available.',
    `Respond only in ${languageName}.`,
    variantInstruction,
    `User ingredients: ${requestLine}.`,
    'Hard rules:',
    '- The recipe must be built around every user ingredient, not just one of them.',
    '- Every user ingredient must appear in the ingredients list and in at least one cooking step.',
    '- You may add only common pantry items such as salt, pepper, oil, butter, water, spices, onion, garlic, or herbs.',
    '- Do not return a salad unless the user explicitly asked for salad, lettuce, cucumber, or similar salad ingredients.',
    '- For egg, meat, chicken, fish, sausage, or sucuk, include a clear fully-cooked safety step.',
    '- Avoid generic titles like "Pratik Mutfak Tarifi"; name the actual dish.',
    'Return a single JSON object that matches the provided schema.',
  ].join('\n');
}

function parseJsonText(value) {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    const json = extractJson(text);
    if (!json) {
      return null;
    }
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}

function geminiErrorMessage(payload) {
  if (!payload) {
    return '';
  }
  if (typeof payload === 'string') {
    return payload.slice(0, 240);
  }
  const message =
    payload.error?.message ||
    payload.message ||
    payload.status ||
    payload.error_description ||
    '';
  return String(message || '').slice(0, 240);
}

function extractGeminiOutputText(payload) {
  if (!payload) {
    return '';
  }
  if (typeof payload === 'string') {
    return payload;
  }
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }
  if (typeof payload.text === 'string') {
    return payload.text;
  }

  const parts = [];
  if (Array.isArray(payload.candidates)) {
    for (const candidate of payload.candidates) {
      const contentParts = candidate?.content?.parts || [];
      for (const part of contentParts) {
        if (typeof part?.text === 'string') {
          parts.push(part.text);
        }
      }
    }
  }
  if (Array.isArray(payload.steps)) {
    for (const step of payload.steps) {
      for (const fieldName of ['content', 'summary']) {
        const block = step?.[fieldName];
        if (!Array.isArray(block)) {
          continue;
        }
        for (const part of block) {
          if (typeof part?.text === 'string') {
            parts.push(part.text);
          }
        }
      }
    }
  }
  return parts.join('\n').trim();
}

function looksLikeRecipePayload(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      (payload.title || payload.recipe_name || payload.recipeName) &&
      Array.isArray(payload.ingredients)
  );
}

function parseGeminiRecipePayload(payload) {
  if (looksLikeRecipePayload(payload)) {
    return payload;
  }
  if (looksLikeRecipePayload(payload?.recipe)) {
    return payload.recipe;
  }
  const textPayload = parseJsonText(extractGeminiOutputText(payload));
  if (looksLikeRecipePayload(textPayload)) {
    return textPayload;
  }
  if (looksLikeRecipePayload(textPayload?.recipe)) {
    return textPayload.recipe;
  }
  return null;
}

async function requestGeminiInteraction(model, prompt, useGoogleSearch) {
  const body = {
    model,
    input: prompt,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: geminiRecipeSchema(),
    },
  };
  if (useGoogleSearch) {
    body.tools = [{ type: 'google_search' }];
  }

  const response = await fetchWithTimeout(
    `${GEMINI_API_BASE_URL}/interactions`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    30000
  );

  const responseText = await response.text();
  const parsed = parseJsonText(responseText) || responseText;
  if (!response.ok) {
    const error = new Error(
      `Gemini request failed (${response.status})${geminiErrorMessage(parsed) ? `: ${geminiErrorMessage(parsed)}` : ''}`
    );
    error.status = response.status;
    throw error;
  }
  return parsed;
}

function recipeImageSearchUrl(ingredientsText, title, language) {
  const ingredients = splitIngredientInput(ingredientsText)
    .map(cleanIngredientHint)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');
  const query = new URLSearchParams({
    title: String(title || '').slice(0, 90),
    ingredients: ingredients || String(ingredientsText || '').slice(0, 140),
    language: normalizeLanguage(language),
  });
  return `${PUBLIC_APP_SERVER_URL}/api/recipe-image.svg?${query.toString()}`;
}

function normalizeGeminiIngredients(rawIngredients) {
  if (!Array.isArray(rawIngredients)) {
    return [];
  }
  return rawIngredients
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      const quantity = String(item?.quantity || item?.amount || '').trim();
      const name = String(item?.name || item?.ingredient || '').trim();
      return [quantity, name].filter(Boolean).join(' ');
    })
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGeminiSteps(payload) {
  const steps = payload?.steps || payload?.instructions;
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps
    .map((item) => (typeof item === 'string' ? item : item?.text || item?.instruction || ''))
    .map((item) => String(item).trim())
    .filter(Boolean);
}

async function recipeFromGeminiPayload(payload, ingredientsText, language, model) {
  const title = payload.title || payload.recipeName || payload.recipe_name || '';
  const ingredients = normalizeGeminiIngredients(payload.ingredients);
  const steps = normalizeGeminiSteps(payload);
  const nutrition =
    payload.nutrition && typeof payload.nutrition === 'object' ? payload.nutrition : {};
  const recipe = await normalizeFoundRecipe(
    {
      id: `gemini-${crypto.randomUUID()}`,
      title,
      ingredients,
      steps,
      cookTime: payload.cookTime || payload.cook_time || payload.prep_time || '',
      calories: payload.calories || payload.estimatedCalories || '',
      nutrition: {
        protein: nutrition.protein || nutrition.protein_g || '',
        carbs: nutrition.carbs || nutrition.carbohydrates || nutrition.carbs_g || '',
        fat: nutrition.fat || nutrition.fat_g || '',
      },
      imageUrl:
        payload.imageUrl || payload.image_url || recipeImageSearchUrl(ingredientsText, title, language),
      sourceUrl: payload.sourceUrl || payload.source_url || undefined,
      summary: payload.summary || '',
      source: 'generated',
      locale: language,
      note: `Gemini ${model}`,
    },
    ingredientsText,
    language,
    'Gemini'
  );

  if (!recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.2 })) {
    return null;
  }
  return recipe;
}

async function generateGeminiRecipe(ingredientsText, language, { mode = 'primary' } = {}) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const prompt = geminiRecipePrompt(ingredientsText, language, mode);
  let lastError = null;
  for (const model of geminiModelCandidates()) {
    const searchModes = GEMINI_GOOGLE_SEARCH_ENABLED ? [true, false] : [false];
    for (const useGoogleSearch of searchModes) {
      try {
        const responsePayload = await requestGeminiInteraction(model, prompt, useGoogleSearch);
        const recipePayload = parseGeminiRecipePayload(responsePayload);
        if (!recipePayload) {
          throw new Error('Gemini response did not contain a recipe JSON object.');
        }
        const recipe = await recipeFromGeminiPayload(
          recipePayload,
          ingredientsText,
          language,
          model
        );
        if (recipe) {
          return recipe;
        }
        throw new Error('Gemini recipe did not match the requested ingredients.');
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    console.warn(
      `Gemini recipe generation failed: ${
        lastError instanceof Error ? lastError.message : 'Unknown Gemini error'
      }`
    );
  }
  return null;
}

function onlineRecipeText(language) {
  return ONLINE_RECIPE_TEXT[normalizeLanguage(language)] || ONLINE_RECIPE_TEXT.tr;
}

function searchResultUrl(rawUrl, baseUrl) {
  const direct = absoluteUrl(rawUrl, baseUrl);
  if (!direct) {
    return null;
  }
  try {
    const parsed = new URL(direct);
    const redirected =
      parsed.searchParams.get('uddg') ||
      parsed.searchParams.get('u') ||
      parsed.searchParams.get('q');
    if (redirected?.startsWith('http')) {
      return decodeHtmlEntities(redirected);
    }
    return direct;
  } catch {
    return direct;
  }
}

function usefulSearchUrl(url, domains = []) {
  if (!/^https?:\/\//i.test(String(url || ''))) {
    return false;
  }
  const host = sourceHost(url);
  if (
    !host ||
    host.includes('duckduckgo.com') ||
    host.includes('bing.com') ||
    host.includes('google.com') ||
    host.includes('youtube.com') ||
    host.includes('youtu.be')
  ) {
    return false;
  }
  if (/\.(pdf|jpg|jpeg|png|webp|gif|zip)(\?|$)/i.test(url)) {
    return false;
  }
  return !domains.length || domains.some((domain) => host.endsWith(domain));
}

async function searchDuckDuckGo(query, { domains = [], limit = 8 } = {}) {
  const html = await fetchText(
    `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {},
    10000
  );
  const results = [];
  const resultPattern =
    /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = null;
  while ((match = resultPattern.exec(html)) && results.length < limit) {
    const url = searchResultUrl(match[1], 'https://duckduckgo.com/');
    if (!usefulSearchUrl(url, domains)) {
      continue;
    }
    results.push({
      url,
      title: stripHtml(match[2]),
      source: sourceHost(url),
    });
  }
  return results;
}

async function searchBing(query, { domains = [], limit = 8 } = {}) {
  const html = await fetchText(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    {},
    10000
  );
  const results = [];
  const resultPattern = /<li[^>]+class=["'][^"']*b_algo[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match = null;
  while ((match = resultPattern.exec(html)) && results.length < limit) {
    const url = searchResultUrl(match[1], 'https://www.bing.com/');
    if (!usefulSearchUrl(url, domains)) {
      continue;
    }
    results.push({
      url,
      title: stripHtml(match[2]),
      source: sourceHost(url),
    });
  }
  return results;
}

async function searchWebPages(query, domains, limit = 12) {
  const domainQueries = domains.slice(0, 6).map((domain) => `${query} site:${domain}`);
  const queries = [query, ...domainQueries];
  const searches = await Promise.allSettled(
    queries.flatMap((item) => [
      searchDuckDuckGo(item, { domains, limit: 5 }),
      searchBing(item, { domains, limit: 5 }),
    ])
  );
  const byUrl = new Map();
  for (const result of searches) {
    if (result.status !== 'fulfilled') {
      continue;
    }
    for (const item of result.value) {
      if (!byUrl.has(item.url)) {
        byUrl.set(item.url, item);
      }
    }
  }
  return Array.from(byUrl.values()).slice(0, limit);
}

function jsonLdBlocks(html) {
  const blocks = [];
  const pattern =
    /<script[^>]+type=["'][^"']*ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = null;
  while ((match = pattern.exec(html))) {
    const raw = decodeHtmlEntities(match[1]).trim();
    if (!raw) {
      continue;
    }
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      const jsonText = extractJson(raw);
      if (jsonText) {
        try {
          blocks.push(JSON.parse(jsonText));
        } catch {
          // Ignore malformed structured data and continue with HTML parsing.
        }
      }
    }
  }
  return blocks;
}

function hasStructuredType(value, typeName) {
  const expected = normalizeLookupText(typeName);
  return arrayFromUnknown(value?.['@type']).some(
    (item) => normalizeLookupText(item) === expected
  );
}

function collectStructuredObjects(value, typeName, result = []) {
  if (!value || result.length > 40) {
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredObjects(item, typeName, result));
    return result;
  }
  if (typeof value !== 'object') {
    return result;
  }
  if (hasStructuredType(value, typeName)) {
    result.push(value);
  }
  for (const child of Object.values(value)) {
    if (child && (Array.isArray(child) || typeof child === 'object')) {
      collectStructuredObjects(child, typeName, result);
    }
  }
  return result;
}

function instructionLinesFromStructured(value) {
  if (!value) {
    return [];
  }
  if (typeof value === 'string') {
    return stepLines(stripHtml(value));
  }
  if (Array.isArray(value)) {
    return value.flatMap(instructionLinesFromStructured);
  }
  if (typeof value === 'object') {
    if (value.itemListElement) {
      return instructionLinesFromStructured(value.itemListElement);
    }
    if (value.steps) {
      return instructionLinesFromStructured(value.steps);
    }
    const text = textFromUnknown(value.text || value.name || value.description);
    return text ? [text] : [];
  }
  return [];
}

function imageFromStructured(value, pageUrl) {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return absoluteUrl(value, pageUrl) || undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageFromStructured(item, pageUrl);
      if (found) {
        return found;
      }
    }
  }
  if (typeof value === 'object') {
    return imageFromStructured(value.url || value.contentUrl || value.thumbnailUrl, pageUrl);
  }
  return undefined;
}

function videoFromStructured(value) {
  const values = arrayFromUnknown(value).flatMap((item) => {
    if (typeof item === 'string') {
      return [item];
    }
    if (item && typeof item === 'object') {
      return [item.url, item.embedUrl, item.contentUrl, item.thumbnailUrl].filter(Boolean);
    }
    return [];
  });
  return values.map(sanitizeYoutubeUrl).find(Boolean);
}

function nutritionTextValue(value, unit) {
  const raw = textFromUnknown(value);
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) {
    return raw.slice(0, 40);
  }
  return `${match[1].replace(',', '.')} ${unit}`;
}

function recipeNutritionFromStructured(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') {
    return { calories: '', nutrition: { protein: '', fat: '', carbs: '' } };
  }
  return {
    calories: nutritionTextValue(nutrition.calories || nutrition.energy, 'kcal'),
    nutrition: {
      protein: nutritionTextValue(nutrition.proteinContent, 'g'),
      fat: nutritionTextValue(nutrition.fatContent, 'g'),
      carbs: nutritionTextValue(nutrition.carbohydrateContent, 'g'),
    },
  };
}

function cookTimeFromStructured(recipe, language) {
  const value = recipe.totalTime || recipe.cookTime || recipe.prepTime;
  const text = textFromUnknown(value);
  const match = text.match(/P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (match) {
    const minutes = Number(match[1] || 0) * 60 + Number(match[2] || 0);
    if (minutes > 0) {
      return localizedCookTime(language, minutes);
    }
  }
  return text.slice(0, 40);
}

function structuredRecipeToRecipe(item, pageUrl, ingredientsText, language) {
  const source = sourceHost(pageUrl);
  const ingredients = uniqueStrings(
    arrayFromUnknown(item.recipeIngredient || item.ingredients).map(textFromUnknown),
    28
  );
  const steps = uniqueStrings(
    instructionLinesFromStructured(item.recipeInstructions || item.instructions),
    18
  );
  const nutrition = recipeNutritionFromStructured(item.nutrition);
  const recipe = normalizeRecipe({
    id: `web-${crypto.createHash('sha1').update(pageUrl).digest('hex').slice(0, 16)}`,
    title: textFromUnknown(item.name || item.headline || extractTitleFromHtml('')),
    ingredients,
    steps,
    imageUrl: imageFromStructured(item.image || item.photo || item.thumbnailUrl, pageUrl),
    youtubeUrl: videoFromStructured(item.video),
    cookTime: cookTimeFromStructured(item, language),
    calories: nutrition.calories,
    nutrition: nutrition.nutrition,
    summary:
      textFromUnknown(item.description).slice(0, 260) ||
      (normalizeLanguage(language) === 'tr'
        ? `${source} kaynagindan bulunan tarif.`
        : `Recipe found from ${source}.`),
    sourceUrl: pageUrl,
    source: 'generated',
    locale: language,
  });
  return withRecipeYoutubeUrl(
    withRecipeMeta(sanitizeRecipeShape(recipe), `${pageUrl}-${ingredientsText}`, language),
    ingredientsText,
    language
  );
}

function looksLikeIngredientLine(line, ingredientsText) {
  const cleaned = normalizeRecipeLine(line);
  const lookup = normalizeLookupText(cleaned);
  if (cleaned.length < 3 || cleaned.length > 130) {
    return false;
  }
  if (
    containsAny(lookup, [
      'yorum',
      'comment',
      'paylas',
      'share',
      'abone',
      'login',
      'uye',
      'servis',
      'kac kisilik',
    ])
  ) {
    return false;
  }
  const requested = splitIngredientInput(ingredientsText)
    .map(cleanIngredientHint)
    .map(normalizeLookupText)
    .filter(Boolean);
  const hasRequested = requested.some((item) => lookup.includes(item));
  const hasMeasure =
    /\b(\d+|bir|iki|uc|yarim|half|cup|cups|tbsp|tsp|gram|gr|kg|ml|litre|adet|kasik|bardak|pinch|tutam)\b/.test(
      lookup
    );
  const knownIngredient = Object.keys(INGREDIENT_ALIASES).some((key) =>
    lookup.includes(normalizeLookupText(key))
  );
  return hasRequested || hasMeasure || knownIngredient;
}

function looksLikeStepLine(line) {
  const cleaned = normalizeRecipeLine(line);
  const lookup = normalizeLookupText(cleaned);
  if (cleaned.length < 18 || cleaned.length > 260) {
    return false;
  }
  if (containsAny(lookup, ['yorum', 'comment', 'paylas', 'share', 'abone', 'login'])) {
    return false;
  }
  return containsAny(lookup, [
    'pisir',
    'dogra',
    'karistir',
    'ekle',
    'hazirla',
    'servis',
    'isit',
    'firin',
    'kizart',
    'kaynat',
    'dinlendir',
    'cook',
    'mix',
    'add',
    'slice',
    'bake',
    'serve',
    'stir',
    'season',
    'heat',
    'simmer',
    'fry',
  ]);
}

function htmlListItems(html) {
  const items = [];
  const pattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match = null;
  while ((match = pattern.exec(html))) {
    const text = stripHtml(match[1]);
    if (text) {
      items.push(text);
    }
  }
  return items;
}

function htmlParagraphItems(html) {
  const items = [];
  const pattern = /<(?:p|div|span)\b[^>]*>([\s\S]*?)<\/(?:p|div|span)>/gi;
  let match = null;
  while ((match = pattern.exec(html)) && items.length < 120) {
    const text = stripHtml(match[1]);
    if (text) {
      items.push(text);
    }
  }
  return items;
}

function nutritionFromPageText(text) {
  const lower = text.toLocaleLowerCase('tr-TR');
  const calories = lower.match(/(\d{2,4})\s*(?:kcal|kalori|calorie|calories)/)?.[1];
  const protein = lower.match(/(?:protein|prote[iı]n)[^\d]{0,24}(\d{1,3}(?:[.,]\d+)?)\s*g/)?.[1];
  const carbs = lower.match(/(?:karbonhidrat|carb|carbs)[^\d]{0,24}(\d{1,3}(?:[.,]\d+)?)\s*g/)?.[1];
  const fat = lower.match(/(?:ya[gğ]|fat)[^\d]{0,24}(\d{1,3}(?:[.,]\d+)?)\s*g/)?.[1];
  return {
    calories: calories ? `${calories} kcal` : '',
    nutrition: {
      protein: protein ? `${protein.replace(',', '.')} g` : '',
      carbs: carbs ? `${carbs.replace(',', '.')} g` : '',
      fat: fat ? `${fat.replace(',', '.')} g` : '',
    },
  };
}

function htmlRecipeToRecipe(html, pageUrl, ingredientsText, language) {
  const structuredRecipes = jsonLdBlocks(html).flatMap((block) =>
    collectStructuredObjects(block, 'Recipe')
  );
  for (const structuredRecipe of structuredRecipes) {
    const recipe = structuredRecipeToRecipe(
      structuredRecipe,
      pageUrl,
      ingredientsText,
      language
    );
    if (recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.15 })) {
      return recipe;
    }
  }

  const source = sourceHost(pageUrl);
  const title = extractTitleFromHtml(html);
  const description = extractMetaContent(html, [
    'description',
    'og:description',
    'twitter:description',
  ]);
  const imageUrl =
    absoluteUrl(
      extractMetaContent(html, ['og:image', 'twitter:image']),
      pageUrl
    ) || undefined;
  const listItems = htmlListItems(html);
  const paragraphs = htmlParagraphItems(html);
  const ingredients = uniqueStrings(
    listItems.filter((item) => looksLikeIngredientLine(item, ingredientsText)),
    24
  );
  const steps = uniqueStrings(
    [...listItems, ...paragraphs].filter(looksLikeStepLine),
    14
  );
  const pageNutrition = nutritionFromPageText(stripHtml(html));

  if (!title || ingredients.length < 3 || steps.length < 3) {
    return null;
  }

  const recipe = normalizeRecipe({
    id: `web-${crypto.createHash('sha1').update(pageUrl).digest('hex').slice(0, 16)}`,
    title,
    ingredients,
    steps,
    imageUrl,
    calories: pageNutrition.calories,
    nutrition: pageNutrition.nutrition,
    summary:
      description.slice(0, 260) ||
      (normalizeLanguage(language) === 'tr'
        ? `${source} kaynagindan bulunan tarif.`
        : `Recipe found from ${source}.`),
    sourceUrl: pageUrl,
    source: 'generated',
    locale: language,
  });

  return withRecipeYoutubeUrl(
    withRecipeMeta(sanitizeRecipeShape(recipe), `${pageUrl}-${ingredientsText}`, language),
    ingredientsText,
    language
  );
}

async function recipeFromUrl(url, ingredientsText, language) {
  const html = await fetchText(url, {}, 12000);
  return htmlRecipeToRecipe(html, url, ingredientsText, language);
}

function recipeSearchQuery(ingredientsText, language) {
  const cleaned = splitIngredientInput(ingredientsText)
    .map(cleanIngredientHint)
    .filter(Boolean)
    .slice(0, 6);
  const base = cleaned.length ? cleaned.join(' ') : ingredientsText;
  return normalizeLanguage(language) === 'tr'
    ? `${base} yemek tarifi malzemeler kalori`
    : `${base} recipe ingredients calories`;
}

function recipeDomainsForLanguage(language) {
  const safeLanguage = normalizeLanguage(language);
  if (safeLanguage === 'tr') {
    return RECIPE_SEARCH_DOMAINS;
  }
  return [
    'allrecipes.com',
    'bbcgoodfood.com',
    'eatingwell.com',
    'foodnetwork.com',
    'delish.com',
    ...RECIPE_SEARCH_DOMAINS.slice(0, 3),
  ];
}

async function findYoutubeVideoUrl(query) {
  const html = await fetchText(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    {},
    10000
  );
  const ids = Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g))
    .map((match) => match[1])
    .filter(Boolean);
  const first = Array.from(new Set(ids))[0];
  return first ? `https://www.youtube.com/watch?v=${first}` : undefined;
}

async function addRecipeVideo(recipe, ingredientsText, language) {
  const suffix =
    normalizeLanguage(language) === 'tr'
      ? 'tarifi nasil yapilir'
      : 'recipe step by step';
  const query = [recipe.title, splitIngredientInput(ingredientsText).slice(0, 4).join(' '), suffix]
    .filter(Boolean)
    .join(' ');
  const youtubeUrl = await findYoutubeVideoUrl(query).catch(() => undefined);
  return youtubeUrl ? { ...recipe, youtubeUrl } : recipe;
}

async function fetchMealDbJson(pathname) {
  const response = await fetchWithTimeout(
    `${THEMEALDB_API_BASE}${pathname}`,
    {
      headers: webHeaders({ Accept: 'application/json' }),
    },
    10000
  );
  if (!response.ok) {
    throw new Error(`TheMealDB request failed: ${response.status}`);
  }
  return await response.json();
}

function mealDbIngredientCandidatesForItem(item) {
  const cleaned = cleanIngredientHint(item);
  const normalized = normalizeLookupText(cleaned || item);
  const aliased =
    INGREDIENT_ALIASES[cleaned] ||
    INGREDIENT_ALIASES[normalized] ||
    INGREDIENT_ALIASES[normalizeLookupText(item)];
  const base = normalizeLookupText(aliased || normalized);
  if (!base) {
    return [];
  }

  const variants = [
    base.replace(/\s+/g, '_'),
    base,
    ...(THEMEALDB_INGREDIENT_FALLBACKS[base] || []),
  ];
  if (base.endsWith('s') && base.length > 3) {
    variants.push(base.slice(0, -1));
  }

  return uniqueStrings(
    variants.map((value) => normalizeLookupText(value).replace(/\s+/g, '_')),
    5
  );
}

function mealDbIngredientCandidates(ingredientsText) {
  return uniqueStrings(
    splitIngredientInput(ingredientsText).flatMap(mealDbIngredientCandidatesForItem),
    10
  );
}

function mealDbSearchTerms(ingredientsText) {
  const items = splitIngredientInput(ingredientsText)
    .map((item) => cleanIngredientHint(item))
    .filter(Boolean);
  const terms = items.map((item) => {
    const normalized = normalizeLookupText(item);
    return INGREDIENT_ALIASES[item] || INGREDIENT_ALIASES[normalized] || item;
  });
  return uniqueStrings(terms, 5);
}

async function mealDbLookupMeal(id) {
  if (!id) {
    return null;
  }
  const data = await fetchMealDbJson(`/lookup.php?i=${encodeURIComponent(id)}`);
  return Array.isArray(data?.meals) ? data.meals[0] || null : null;
}

function localizeMealDbIngredientName(name, language) {
  const value = String(name || '').trim();
  if (normalizeLanguage(language) !== 'tr') {
    return value;
  }
  const lookup = normalizeLookupText(value);
  if (THEMEALDB_REVERSE_ALIASES_TR[lookup]) {
    return THEMEALDB_REVERSE_ALIASES_TR[lookup];
  }
  return lookup
    .split(/\s+/)
    .map((word) => THEMEALDB_REVERSE_ALIASES_TR[word] || word)
    .join(' ')
    .trim();
}

function localizeMealDbMeasure(measure, language) {
  const value = String(measure || '').trim();
  if (normalizeLanguage(language) !== 'tr') {
    return value;
  }
  return value
    .replace(/\bcups?\b/gi, 'bardak')
    .replace(/\btbsps?\b/gi, 'yemek kasigi')
    .replace(/\btblsps?\b/gi, 'yemek kasigi')
    .replace(/\btablespoons?\b/gi, 'yemek kasigi')
    .replace(/\btsps?\b/gi, 'tatli kasigi')
    .replace(/\bteaspoons?\b/gi, 'tatli kasigi')
    .replace(/\bcloves?\b/gi, 'dis')
    .replace(/\bpinches?\b/gi, 'tutam')
    .replace(/\bslices?\b/gi, 'dilim')
    .replace(/\bcans?\b/gi, 'kutu')
    .replace(/\bthinly\b/gi, 'ince')
    .replace(/\bfinely\b/gi, 'ince')
    .replace(/\bchopped\b/gi, 'dogranmis')
    .replace(/\bsliced\b/gi, 'dilimlenmis')
    .replace(/\bto serve\b/gi, 'servis icin')
    .replace(/\bfor frying\b/gi, 'kizartmak icin')
    .replace(/\bg\b/gi, 'gr');
}

async function mealDbRecipeFromMeal(meal, ingredientsText, language) {
  if (!meal?.idMeal || !meal?.strMeal) {
    return null;
  }

  const ingredients = [];
  for (let index = 1; index <= 20; index += 1) {
    const ingredient = String(meal[`strIngredient${index}`] || '').trim();
    if (!ingredient) {
      continue;
    }
    const measure = localizeMealDbMeasure(meal[`strMeasure${index}`], language);
    const localizedIngredient = localizeMealDbIngredientName(ingredient, language);
    ingredients.push(`${measure} ${localizedIngredient}`.trim());
  }

  const steps = stepLines(meal.strInstructions)
    .filter((line) => !/^step\s+\d+$/i.test(normalizeLookupText(line)))
    .slice(0, 18);
  if (ingredients.length < 3 || steps.length < 3) {
    return null;
  }

  const sourceUrl =
    (meal.strSource ? String(meal.strSource).trim() : '') ||
    `https://www.themealdb.com/meal/${meal.idMeal}`;
  return await normalizeFoundRecipe(
    {
      id: `mealdb-${meal.idMeal}`,
      title:
        normalizeLanguage(language) === 'tr'
          ? `Internetten: ${meal.strMeal}`
          : meal.strMeal,
      ingredients,
      steps,
      imageUrl: meal.strMealThumb ? String(meal.strMealThumb).trim() : undefined,
      youtubeUrl: sanitizeYoutubeUrl(meal.strYoutube),
      sourceUrl,
      summary: onlineRecipeText(language).matched,
      source: 'generated',
      locale: language,
    },
    ingredientsText,
    language,
    'TheMealDB'
  );
}

function scoreMealDbRecipe(recipe, ingredientsText, index) {
  return (
    ingredientCoverageRatio(recipe, ingredientsText) * 120 +
    Math.min(recipe.ingredients.length, 12) * 2 +
    Math.min(recipe.steps.length, 10) * 3 +
    (recipe.imageUrl ? 8 : 0) +
    Math.max(0, 12 - index)
  );
}

async function findMealDbRecipe(ingredientsText, language) {
  const found = new Map();
  const ingredientCandidates = mealDbIngredientCandidates(ingredientsText);

  for (const ingredient of ingredientCandidates.slice(0, 6)) {
    const data = await fetchMealDbJson(`/filter.php?i=${encodeURIComponent(ingredient)}`)
      .catch(() => null);
    if (!Array.isArray(data?.meals)) {
      continue;
    }
    for (const meal of data.meals.slice(0, 12)) {
      if (meal?.idMeal && !found.has(meal.idMeal)) {
        found.set(meal.idMeal, meal);
      }
    }
  }

  if (!found.size) {
    for (const term of mealDbSearchTerms(ingredientsText)) {
      const data = await fetchMealDbJson(`/search.php?s=${encodeURIComponent(term)}`)
        .catch(() => null);
      if (!Array.isArray(data?.meals)) {
        continue;
      }
      for (const meal of data.meals.slice(0, 8)) {
        if (meal?.idMeal && !found.has(meal.idMeal)) {
          found.set(meal.idMeal, meal);
        }
      }
      if (found.size) {
        break;
      }
    }
  }

  const summaries = Array.from(found.values()).slice(0, 10);
  if (!summaries.length) {
    return null;
  }

  const detailed = await Promise.allSettled(
    summaries.map(async (summary) => mealDbLookupMeal(summary.idMeal))
  );
  const scored = [];
  for (let index = 0; index < detailed.length; index += 1) {
    const result = detailed[index];
    if (result.status !== 'fulfilled' || !result.value) {
      continue;
    }
    const recipe = await mealDbRecipeFromMeal(result.value, ingredientsText, language);
    if (!recipe || !recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.15 })) {
      continue;
    }
    scored.push({
      recipe,
      score: scoreMealDbRecipe(recipe, ingredientsText, index),
    });
  }

  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.recipe || null;
}

function scoreFoundRecipe(recipe, ingredientsText, sourceUrl) {
  const coverage = ingredientCoverageRatio(recipe, ingredientsText);
  const domainIndex = RECIPE_SEARCH_DOMAINS.findIndex((domain) =>
    sourceHost(sourceUrl).endsWith(domain)
  );
  const domainScore = domainIndex >= 0 ? Math.max(0, 20 - domainIndex * 2) : 4;
  return (
    coverage * 100 +
    Math.min(recipe.ingredients.length, 12) * 3 +
    Math.min(recipe.steps.length, 10) * 4 +
    (recipe.imageUrl ? 8 : 0) +
    domainScore
  );
}

async function findOnlineRecipe(ingredientsText, language) {
  const domains = recipeDomainsForLanguage(language);
  const query = recipeSearchQuery(ingredientsText, language);
  const searchResults = await searchWebPages(query, domains, 14);
  const candidates = await Promise.allSettled(
    searchResults.slice(0, 10).map(async (result) => {
      const recipe = await recipeFromUrl(result.url, ingredientsText, language);
      if (!recipe || !recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.15 })) {
        return null;
      }
      return {
        recipe,
        sourceUrl: result.url,
        score: scoreFoundRecipe(recipe, ingredientsText, result.url),
      };
    })
  );
  const ranked = candidates
    .filter((item) => item.status === 'fulfilled' && item.value?.recipe)
    .map((item) => item.value)
    .sort((left, right) => right.score - left.score);
  if (!ranked.length) {
    return null;
  }
  const best = ranked[0].recipe;
  const withVideo = await addRecipeVideo(best, ingredientsText, language);
  return {
    ...withVideo,
    summary:
      withVideo.summary ||
      (ingredientCoverageRatio(withVideo, ingredientsText) >= 0.34
        ? onlineRecipeText(language).matched
        : onlineRecipeText(language).closest),
  };
}

async function findRecommendedRecipes(language) {
  const queries =
    normalizeLanguage(language) === 'tr'
      ? [
          'pratik yemek tarifi',
          'kolay aksam yemegi tarifi',
          'saglikli ev yemegi tarifi',
        ]
      : [
          'easy healthy dinner recipe',
          'quick home recipe',
          'balanced dinner recipe',
        ];
  const domains = recipeDomainsForLanguage(language);
  const found = new Map();

  // Run DuckDuckGo and Bing searches for all queries in parallel, without heavy site:domain queries
  const searchPromises = queries.map(async (query) => {
    try {
      const searches = await Promise.allSettled([
        searchDuckDuckGo(query, { domains, limit: 4 }),
        searchBing(query, { domains, limit: 4 })
      ]);
      const urls = [];
      for (const res of searches) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          urls.push(...res.value);
        }
      }
      return urls;
    } catch {
      return [];
    }
  });

  const allSearchResults = await Promise.all(searchPromises);

  // Extract top candidates
  const candidates = [];
  for (let i = 0; i < allSearchResults.length; i++) {
    const urls = allSearchResults[i];
    const query = queries[i];
    if (urls.length > 0) candidates.push({ url: urls[0].url, query });
    if (urls.length > 1) candidates.push({ url: urls[1].url, query });
  }

  if (candidates.length === 0) {
    return [];
  }

  // Fetch recipe pages in parallel
  const parsed = await Promise.allSettled(
    candidates.map((c) => recipeFromUrl(c.url, c.query, language))
  );

  const videoPromises = [];
  for (const result of parsed) {
    if (result.status === 'fulfilled' && result.value?.title) {
      const rec = result.value;
      videoPromises.push(
        addRecipeVideo(rec, rec.title, language)
          .then((withVideo) => ({ ...withVideo, source: 'recommended' }))
          .catch(() => ({ ...rec, source: 'recommended' }))
      );
    }
  }

  const recipes = await Promise.all(videoPromises);
  for (const recipe of recipes) {
    found.set(normalizeLookupText(recipe.title), recipe);
  }

  return Array.from(found.values()).slice(0, RECOMMENDATION_COUNT);
}

function fallbackRecipe(ingredientsText, language) {
  const items = splitIngredientInput(ingredientsText);
  const safeLanguage = normalizeLanguage(language);
  const ingredients = items.length
    ? items
    : safeLanguage === 'tr'
      ? ['2 domates', '1 sogan', 'zeytinyagi']
      : ['2 tomatoes', '1 onion', 'olive oil'];
  const mainName = ingredients.slice(0, 3).join(', ');
  const remainingItems = ingredients.slice(1).join(', ') || ingredients[0];
  const hasSafetySensitiveIngredient = ingredients.some((item) =>
    /\b(chicken|tavuk|beef|dana|kiyma|meat|et|fish|balik|salmon|somon|tuna|ton|egg|yumurta|sausage|sucuk|sosis)\b/i.test(
      normalizeLookupText(item)
    )
  );
  const fallbackCopy =
    safeLanguage === 'tr'
      ? {
          title: `${titleCase(mainName)} ile Pratik Tava`,
          summary: `${mainName} malzemelerine gore hazirlanan, alakasiz kaynak yerine guvenli yerel tarif.`,
          steps: [
            `${mainName} malzemelerini temizle ve esit boyutta hazirla.`,
            `${ingredients[0]} ile basla; tavayi orta ateste az yagla isitip 2-3 dakika cevir.`,
            `Kalan malzemeleri (${remainingItems}) ekle; kapagi yarim kapatip 8-12 dakika kontrollu pisir.`,
            ...(hasSafetySensitiveIngredient
              ? ['Tavuk, et, balik, yumurta veya sucuk kullandiysan ici cig kalmayana kadar pisirmeye devam et.']
              : []),
            'Tuz ve baharatla tatlandir, 2 dakika dinlendirip sicak servis et.',
          ],
        }
      : {
          title: `Quick Skillet with ${titleCase(mainName)}`,
          summary: `A safe local recipe built around ${mainName} instead of an unrelated source match.`,
          steps: [
            `Clean and prepare ${mainName} in even pieces.`,
            `Start with ${ingredients[0]}; warm a skillet with a little oil and cook for 2-3 minutes.`,
            `Add the remaining ingredients (${remainingItems}); cook partly covered for 8-12 minutes.`,
            ...(hasSafetySensitiveIngredient
              ? ['If using egg, sausage, meat, or fish, keep cooking until fully done.']
              : []),
            'Season, rest for 2 minutes, and serve warm.',
          ],
        };
  const title =
    safeLanguage === 'tr' || safeLanguage === 'en'
      ? fallbackCopy.title
      : `Quick Skillet with ${titleCase(mainName)}`;
  const summary =
    safeLanguage === 'tr' || safeLanguage === 'en'
      ? fallbackCopy.summary
      : `A safe local recipe built around ${mainName} instead of an unrelated source match.`;
  return withRecipeYoutubeUrl(
    withRecipeMeta(
      normalizeRecipe({
        id: `fallback-${crypto.randomUUID()}`,
        title,
        ingredients,
        steps: fallbackCopy.steps,
        imageUrl: recipeImageSearchUrl(ingredientsText, title, safeLanguage),
        summary,
        source: 'generated',
        locale: safeLanguage,
      }),
      `${safeLanguage}-${ingredientsText || 'fallback'}`,
      safeLanguage
    ),
    ingredientsText,
    safeLanguage
  );
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
    youtubeUrl: sanitizeYoutubeUrl(exercise?.youtubeUrl),
    sourceUrl: exercise?.sourceUrl ? String(exercise.sourceUrl).trim() : undefined,
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

function workoutSearchQuery(exercise, goalText, language) {
  const suffix =
    normalizeLanguage(language) === 'tr'
      ? 'egzersiz dogru form video'
      : 'exercise proper form video';
  return [exercise.name, workoutRegionLabel(exercise.region, language), goalText, suffix]
    .filter(Boolean)
    .join(' ');
}

async function findWorkoutSource(query) {
  const results = await searchWebPages(query, WORKOUT_SEARCH_DOMAINS, 5).catch(() => []);
  return results[0] || null;
}

async function enrichWorkoutExercise(exercise, goalText, language) {
  const query = workoutSearchQuery(exercise, goalText, language);
  const [videoResult, sourceResult] = await Promise.allSettled([
    findYoutubeVideoUrl(query),
    findWorkoutSource(query),
  ]);
  const youtubeUrl =
    videoResult.status === 'fulfilled' ? sanitizeYoutubeUrl(videoResult.value) : undefined;
  const source = sourceResult.status === 'fulfilled' ? sourceResult.value : null;
  const host = source?.source || sourceHost(source?.url);
  const sourceNote =
    host && normalizeLanguage(language) === 'tr'
      ? ` Kaynak kontrolu: ${host}.`
      : host
        ? ` Source checked: ${host}.`
        : '';
  return normalizeExercise({
    ...exercise,
    youtubeUrl,
    sourceUrl: source?.url,
    summary: `${exercise.summary || ''}${sourceNote}`.trim(),
  });
}

async function buildWorkoutPlanFromSearch(goalText, duration, regions, language) {
  try {
    const basePlan = fallbackWorkoutPlan(goalText, duration, regions, language);
    const enrichedDays = [];
    for (const day of basePlan.days) {
      const exercises = await Promise.all(
        day.exercises.map((exercise) =>
          enrichWorkoutExercise(exercise, goalText, language).catch(() => exercise)
        )
      );
      enrichedDays.push({ ...day, exercises });
    }
    return normalizeWorkoutPlan(
      {
        ...basePlan,
        id: `search-plan-${Date.now()}`,
        title: goalText || workoutFallbackText(language).title,
        summary:
          normalizeLanguage(language) === 'tr'
            ? 'Hedef, bolge secimi, YouTube ve egzersiz kaynaklari taranarak hazirlanan plan.'
            : 'Plan prepared from your goal, selected regions, YouTube, and exercise sources.',
        days: enrichedDays,
      },
      duration
    );
  } catch (error) {
    console.warn(
      `Workout search failed, falling back to local plan: ${
        error instanceof Error ? error.message : 'Unknown workout error'
      }`
    );
    return fallbackWorkoutPlan(goalText, duration, regions, language);
  }
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
  if (
    containsAny(normalized, [
      'arama',
      'kaynak',
      'site',
      'internet',
      'web',
      'youtube',
      'mobile',
      'mobil',
      'cache',
    ])
  ) {
    return text.search;
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
      weight: user.profile?.weight !== undefined ? Number(user.profile.weight) : undefined,
      height: user.profile?.height !== undefined ? Number(user.profile.height) : undefined,
      age: user.profile?.age !== undefined ? Number(user.profile.age) : undefined,
      gender: user.profile?.gender !== undefined ? String(user.profile.gender) : undefined,
      activityLevel: user.profile?.activityLevel !== undefined ? String(user.profile.activityLevel) : undefined,
      fitnessGoal: user.profile?.fitnessGoal !== undefined ? String(user.profile.fitnessGoal) : undefined,
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

function searchCacheKey(kind, parameters) {
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

function recipeSearchCacheParameters(ingredientsText, language) {
  return {
    ...recipeCacheParameters(ingredientsText, language),
    generator: GEMINI_API_KEY ? 'gemini-v2-image' : 'classic-v3-image',
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

function normalizeSearchCacheItem(item) {
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

function getLocalSearchCache(cacheKey) {
  const store = readStore();
  return normalizeSearchCacheItem(
    store.searchCache.find((item) => item.key === cacheKey || item.cache_key === cacheKey)
  );
}

function rememberLocalSearchCache(item) {
  const normalized = normalizeSearchCacheItem(item);
  if (!normalized?.key) {
    return;
  }
  const store = readStore();
  store.searchCache = [
    normalized,
    ...store.searchCache.filter(
      (cacheItem) => cacheItem.key !== normalized.key && cacheItem.cache_key !== normalized.key
    ),
  ].slice(0, SEARCH_CACHE_LIMIT);
  writeStore(store);
}

function getCachedSearchResponse(cacheKey) {
  return getLocalSearchCache(cacheKey);
}

function rememberSearchResponse({ cacheKey, kind, payload, source }) {
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
  rememberLocalSearchCache(item);
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

function escapeSvgText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function recipeImageTheme(title, ingredientsText) {
  const lookup = normalizeLookupText(`${title} ${ingredientsText}`);
  const hasAny = (terms) => terms.some((term) => lookup.includes(term));
  if (hasAny(['salata', 'salad', 'lettuce', 'marul', 'cucumber', 'salatalik'])) {
    return 'salad';
  }
  if (
    hasAny(['yumurta', 'egg']) &&
    hasAny(['sucuk', 'sausage', 'sosis', 'ekmek', 'bread'])
  ) {
    return 'breakfast';
  }
  if (hasAny(['makarna', 'pasta', 'spaghetti', 'noodle', 'nudeln'])) {
    return 'pasta';
  }
  if (hasAny(['pirinc', 'rice', 'pilav', 'arroz', 'reis'])) {
    return 'rice';
  }
  if (hasAny(['tavuk', 'chicken', 'huhn', 'pollo'])) {
    return 'chicken';
  }
  if (hasAny(['balik', 'fish', 'somon', 'salmon', 'tuna', 'ton'])) {
    return 'fish';
  }
  if (hasAny(['et', 'beef', 'kiyma', 'dana', 'meat', 'sucuk', 'sausage'])) {
    return 'skillet';
  }
  if (hasAny(['yumurta', 'egg'])) {
    return 'egg';
  }
  return 'home';
}

function recipeImagePalette(theme) {
  const palettes = {
    breakfast: ['#fff3c4', '#f4b63f', '#8f2d1f', '#fff7df', '#d33f2f'],
    egg: ['#fff7d6', '#f1bc31', '#50321d', '#ffffff', '#f4a62a'],
    skillet: ['#f3d2b5', '#8b3d2a', '#2d1b16', '#ffe1ba', '#c94e34'],
    chicken: ['#f7d8a8', '#d57b35', '#52301d', '#fff0cf', '#74a65d'],
    pasta: ['#ffe19a', '#d99235', '#5f371d', '#fff3bf', '#cc4433'],
    rice: ['#f8f1db', '#d6a652', '#534230', '#ffffff', '#7fa16b'],
    fish: ['#c7e9f4', '#4394ad', '#183e52', '#f8fbff', '#e98158'],
    salad: ['#dcefc5', '#6aaa55', '#27411f', '#f7ffe8', '#e64c3a'],
    home: ['#f3dec4', '#bd7550', '#352019', '#fff4df', '#6f9f69'],
  };
  return palettes[theme] || palettes.home;
}

function recipeImageGarnish(seed, palette) {
  const shapes = [];
  for (let index = 0; index < 16; index += 1) {
    const x = 250 + ((seed * (index + 7)) % 310);
    const y = 170 + ((seed * (index + 13)) % 155);
    const r = 5 + ((seed + index * 3) % 9);
    const color = index % 3 === 0 ? palette[4] : index % 3 === 1 ? palette[1] : palette[3];
    shapes.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.9"/>`);
  }
  return shapes.join('');
}

function recipeImageMainShapes(theme, palette, seed) {
  const garnish = recipeImageGarnish(seed, palette);
  if (theme === 'breakfast' || theme === 'egg') {
    return `
      <rect x="158" y="228" width="184" height="64" rx="18" fill="#d7a24e" transform="rotate(-9 250 260)"/>
      <rect x="436" y="224" width="172" height="58" rx="17" fill="#d7a24e" transform="rotate(8 522 253)"/>
      <circle cx="336" cy="235" r="58" fill="#fffdf2"/>
      <circle cx="336" cy="235" r="23" fill="#f1a91e"/>
      <circle cx="470" cy="260" r="54" fill="#fffdf2"/>
      <circle cx="470" cy="260" r="21" fill="#f1a91e"/>
      <circle cx="405" cy="198" r="31" fill="${palette[4]}"/>
      <circle cx="528" cy="314" r="27" fill="${palette[4]}"/>
      <circle cx="245" cy="318" r="25" fill="${palette[4]}"/>
      ${garnish}
    `;
  }
  if (theme === 'pasta') {
    return `
      <path d="M210 259c78-78 226 67 344-15" fill="none" stroke="${palette[1]}" stroke-width="22" stroke-linecap="round"/>
      <path d="M225 300c82-73 212 54 330-22" fill="none" stroke="#ffd77a" stroke-width="18" stroke-linecap="round"/>
      <path d="M268 225c70 57 160 64 238 12" fill="none" stroke="#ffe7a5" stroke-width="18" stroke-linecap="round"/>
      <circle cx="330" cy="295" r="20" fill="${palette[4]}"/>
      <circle cx="475" cy="224" r="19" fill="${palette[4]}"/>
      ${garnish}
    `;
  }
  if (theme === 'fish') {
    return `
      <path d="M260 252c70-62 202-61 278 4-78 71-209 65-278-4Z" fill="${palette[1]}"/>
      <path d="M548 256l66-48v95l-66-47Z" fill="${palette[1]}"/>
      <circle cx="316" cy="241" r="8" fill="${palette[2]}"/>
      <path d="M374 205c27 29 28 69 1 101" fill="none" stroke="${palette[3]}" stroke-width="10" opacity="0.65"/>
      ${garnish}
    `;
  }
  if (theme === 'salad') {
    return `
      <circle cx="304" cy="238" r="48" fill="${palette[1]}"/>
      <circle cx="388" cy="285" r="58" fill="#84bd62"/>
      <circle cx="486" cy="236" r="52" fill="#5fa64c"/>
      <circle cx="524" cy="311" r="38" fill="${palette[4]}"/>
      <circle cx="272" cy="316" r="34" fill="#f2f0c1"/>
      ${garnish}
    `;
  }
  return `
    <rect x="218" y="205" width="128" height="84" rx="24" fill="${palette[1]}" transform="rotate(-12 282 247)"/>
    <rect x="363" y="219" width="150" height="82" rx="24" fill="#e0a15f" transform="rotate(9 438 260)"/>
    <circle cx="312" cy="314" r="34" fill="${palette[4]}"/>
    <circle cx="520" cy="302" r="31" fill="${palette[3]}"/>
    <path d="M237 200c110 54 248 44 326-9" fill="none" stroke="#fff4d5" stroke-width="11" opacity="0.55"/>
    ${garnish}
  `;
}

function generatedRecipeImageSvg({ title, ingredients, language }) {
  const safeTitle = String(title || '').trim();
  const safeIngredients = String(ingredients || '').trim();
  const theme = recipeImageTheme(safeTitle, safeIngredients);
  const palette = recipeImagePalette(theme);
  const seed = toSeed(`${safeTitle}-${safeIngredients}-${language}`) || 37;
  const subtitle = splitIngredientInput(safeIngredients).slice(0, 4).join(' - ');
  const mainShapes = recipeImageMainShapes(theme, palette, seed);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette[0]}"/>
      <stop offset="0.55" stop-color="${palette[3]}"/>
      <stop offset="1" stop-color="${palette[1]}"/>
    </linearGradient>
    <radialGradient id="plate" cx="50%" cy="43%" r="58%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.72" stop-color="#fffaf0"/>
      <stop offset="1" stop-color="#e6d8c8"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#1b120c" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="800" height="520" fill="url(#bg)"/>
  <circle cx="126" cy="88" r="78" fill="#ffffff" opacity="0.18"/>
  <circle cx="686" cy="102" r="118" fill="#ffffff" opacity="0.16"/>
  <circle cx="674" cy="418" r="90" fill="${palette[2]}" opacity="0.14"/>
  <ellipse cx="400" cy="278" rx="282" ry="164" fill="url(#plate)" filter="url(#shadow)"/>
  <ellipse cx="400" cy="278" rx="218" ry="119" fill="none" stroke="#ffffff" stroke-width="18" opacity="0.68"/>
  ${mainShapes}
  <rect x="0" y="386" width="800" height="134" fill="#111111" opacity="0.12"/>
  <text x="52" y="435" fill="${palette[2]}" font-family="Arial, sans-serif" font-size="36" font-weight="800">${escapeSvgText(safeTitle || (normalizeLanguage(language) === 'tr' ? 'Tarif' : 'Recipe'))}</text>
  <text x="54" y="471" fill="${palette[2]}" font-family="Arial, sans-serif" font-size="22" font-weight="700" opacity="0.78">${escapeSvgText(subtitle)}</text>
</svg>`;
}

app.get('/api/recipe-image.svg', (req, res) => {
  const title = String(req.query?.title || '').slice(0, 120);
  const ingredients = String(req.query?.ingredients || '').slice(0, 240);
  const language = normalizeLanguage(req.query?.language);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(generatedRecipeImageSvg({ title, ingredients, language }));
});

app.get('/health', (_req, res) => {
  if (IS_PRODUCTION) {
    return res.json({
      ok: true,
      service: 'app-server',
    });
  }

  return res.json({
    ok: true,
    service: 'app-server',
    storage: path.basename(DATA_FILE),
    encrypted: true,
    recipeProvider: GEMINI_API_KEY
      ? 'gemini+themealdb+web-search'
      : 'themealdb+web-search',
    geminiConfigured: Boolean(GEMINI_API_KEY),
    geminiModel: GEMINI_API_KEY ? GEMINI_MODEL : undefined,
    workoutProvider: 'web-search+local-library',
    cache: {
      provider: 'local-encrypted',
      limit: SEARCH_CACHE_LIMIT,
    },
    recipeSources: RECIPE_SEARCH_DOMAINS,
    workoutSources: WORKOUT_SEARCH_DOMAINS,
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

app.post('/api/search/recipe', searchRateLimit, async (req, res) => {
  try {
    const ingredientsText = String(req.body?.ingredientsText || '').trim().slice(0, 1200);
    const language = normalizeLanguage(req.body?.language);

    if (!ingredientsText) {
      return res.status(400).json({ error: 'ingredientsText is required' });
    }

    const cacheKey = searchCacheKey(
      'recipe',
      recipeSearchCacheParameters(ingredientsText, language)
    );
    const cached = getCachedSearchResponse(cacheKey);
    if (cached?.payload?.recipe && (!GEMINI_API_KEY || cached.source === 'gemini')) {
      const recipe = await normalizeFoundRecipe(
        cached.payload.recipe,
        ingredientsText,
        language,
        cached.source || 'cache'
      );
      if (recipeLooksUsable(recipe, ingredientsText, { minCoverage: 0.2 })) {
        return res.json({ recipe, cached: true, provider: cached.source || 'cache' });
      }
    }

    recordAnonymousAudit(req, 'recipe_search_request', 'Recipe search requested', {
      language,
      ingredientCount: splitIngredientInput(ingredientsText).length,
    });

    const geminiRecipe = await generateGeminiRecipe(ingredientsText, language);
    if (
      geminiRecipe &&
      recipeLooksUsable(geminiRecipe, ingredientsText, { minCoverage: 0.2 })
    ) {
      rememberSearchResponse({
        cacheKey,
        kind: 'recipe',
        payload: { recipe: geminiRecipe },
        source: 'gemini',
      });
      return res.json({
        recipe: geminiRecipe,
        provider: 'gemini',
      });
    }

    const mealDbRecipe = await findMealDbRecipe(ingredientsText, language).catch(() => null);
    if (
      mealDbRecipe &&
      recipeLooksUsable(mealDbRecipe, ingredientsText, { minCoverage: 0.15 })
    ) {
      rememberSearchResponse({
        cacheKey,
        kind: 'recipe',
        payload: { recipe: mealDbRecipe },
        source: 'themealdb',
      });
      return res.json({
        recipe: mealDbRecipe,
        provider: 'themealdb',
      });
    }

    const onlineRecipe = await findOnlineRecipe(ingredientsText, language).catch(() => null);
    if (
      onlineRecipe &&
      recipeLooksUsable(onlineRecipe, ingredientsText, { minCoverage: 0.15 })
    ) {
      const imageUrl =
        onlineRecipe.imageUrl ||
        (await resolveRecipeImage(onlineRecipe, ingredientsText).catch(() => undefined));
      const recipe = { ...onlineRecipe, imageUrl };
      rememberSearchResponse({
        cacheKey,
        kind: 'recipe',
        payload: { recipe },
        source: sourceHost(recipe.sourceUrl) || 'web-search',
      });
      return res.json({
        recipe,
        provider: 'web-search',
      });
    }

    const fallback = fallbackRecipe(ingredientsText, language);
    rememberSearchResponse({
      cacheKey,
      kind: 'recipe',
      payload: { recipe: fallback },
      source: 'fallback',
    });
    return res.json({
      recipe: fallback,
      fallback: true,
    });
  } catch (error) {
    const ingredientsText = String(req.body?.ingredientsText || '').trim().slice(0, 1200);
    const language = normalizeLanguage(req.body?.language);
    const fallback = fallbackRecipe(ingredientsText, language);
    try {
      rememberSearchResponse({
        cacheKey: searchCacheKey(
          'recipe',
          recipeSearchCacheParameters(ingredientsText, language)
        ),
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

app.post('/api/search/recipe-variants', searchRateLimit, async (req, res) => {
  try {
    const ingredientsText = String(req.body?.ingredientsText || '').trim().slice(0, 1200);
    const language = normalizeLanguage(req.body?.language);

    if (!ingredientsText) {
      return res.status(400).json({ error: 'ingredientsText is required' });
    }

    recordAnonymousAudit(req, 'recipe_sources_request', 'Recipe source alternatives requested', {
      language,
      ingredientCount: splitIngredientInput(ingredientsText).length,
    });

    const geminiVariantRecipe = await generateGeminiRecipe(ingredientsText, language, {
      mode: 'variant',
    }).catch(() => null);
    const geminiVariants =
      geminiVariantRecipe &&
      recipeLooksUsable(geminiVariantRecipe, ingredientsText, { minCoverage: 0.2 })
        ? [
            {
              provider: 'gemini',
              label: 'Gemini',
              available: true,
              recipe: geminiVariantRecipe,
            },
          ]
        : [];

    const domains = recipeDomainsForLanguage(language).slice(0, 4);
    const variants = await Promise.all(
      domains.map(async (domain) => {
        const recipe = await findOnlineRecipe(`${ingredientsText} site:${domain}`, language)
          .catch(() => null);
        return {
          provider: domain,
          label: domain,
          available: Boolean(recipe),
          recipe: recipe || undefined,
          warning: recipe ? undefined : 'No usable recipe found from this source.',
        };
      })
    );

    return res.json({ variants: [...geminiVariants, ...variants] });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Unknown recipe source search error',
    });
  }
});

app.post('/api/search/translate-recipe', searchRateLimit, async (req, res) => {
  try {
    const recipe = req.body?.recipe;
    const language = normalizeLanguage(req.body?.language);

    if (!recipe) {
      return res.status(400).json({ error: 'recipe is required' });
    }

    if (language === 'en') {
      return res.json({ recipe: localizedRecipeCopy(recipe, 'en') });
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

app.get('/api/search/recommendations', searchRateLimit, async (req, res) => {
  try {
    const language = normalizeLanguage(req.query?.language);
    const cacheKey = searchCacheKey('recommendations', {
      language,
      day: new Date().toISOString().slice(0, 10),
    });
    const cached = getCachedSearchResponse(cacheKey);
    if (Array.isArray(cached?.payload?.recipes) && cached.payload.recipes.length) {
      return res.json({ recipes: cached.payload.recipes, cached: true });
    }

    const recipes = await findRecommendedRecipes(language).catch(() => []);
    const safeRecipes = recipes.length
      ? recipes
      : [
          fallbackRecipe(
            normalizeLanguage(language) === 'tr'
              ? 'domates, sogan, biber'
              : 'tomato, onion, pepper',
            language
          ),
          fallbackRecipe(
            normalizeLanguage(language) === 'tr'
              ? 'tavuk, pirinc, yogurt'
              : 'chicken, rice, yogurt',
            language
          ),
        ];
    rememberSearchResponse({
      cacheKey,
      kind: 'recommendations',
      payload: { recipes: safeRecipes.slice(0, RECOMMENDATION_COUNT) },
      source: recipes.length ? 'web-search' : 'fallback',
    });
    return res.json({ recipes: safeRecipes.slice(0, RECOMMENDATION_COUNT) });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown recommendation search error',
    });
  }
});

app.post('/api/search/workout-plan', searchRateLimit, async (req, res) => {
  try {
    const goalText = String(req.body?.goalText || '').trim().slice(0, 1000);
    const duration = VALID_DURATIONS.has(req.body?.duration) ? req.body.duration : 'weekly';
    const regions = Array.isArray(req.body?.regions)
      ? req.body.regions.filter((region) => VALID_REGIONS.has(region))
      : [];
    const language = normalizeLanguage(req.body?.language);
    const cacheKey = searchCacheKey(
      'workout-plan',
      workoutCacheParameters(goalText, duration, regions, language)
    );
    const cached = getCachedSearchResponse(cacheKey);
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

    const plan = await buildWorkoutPlanFromSearch(goalText, duration, regions, language);
    rememberSearchResponse({
      cacheKey,
      kind: 'workout-plan',
      payload: { plan },
      source: 'web-search',
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

app.post('/api/search/app-help', searchRateLimit, async (req, res) => {
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

    const answer = fallbackAppAnswer(question, language);
    rememberAppAnswer(question, language, answer, 'local');
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
      weight: nextProfile.weight !== undefined ? Number(nextProfile.weight) : user.profile.weight,
      height: nextProfile.height !== undefined ? Number(nextProfile.height) : user.profile.height,
      age: nextProfile.age !== undefined ? Number(nextProfile.age) : user.profile.age,
      gender: nextProfile.gender !== undefined ? String(nextProfile.gender) : user.profile.gender,
      activityLevel: nextProfile.activityLevel !== undefined ? String(nextProfile.activityLevel) : user.profile.activityLevel,
      fitnessGoal: nextProfile.fitnessGoal !== undefined ? String(nextProfile.fitnessGoal) : user.profile.fitnessGoal,
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

app.listen(port, '0.0.0.0', () => {
  console.log(`App search server running on http://0.0.0.0:${port}`);
  console.log(`Encrypted user storage enabled at ${DATA_FILE}`);
  console.log(`Recipe sources: ${RECIPE_SEARCH_DOMAINS.join(', ')}`);
});
