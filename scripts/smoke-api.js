'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.SMOKE_AI_SERVER_PORT || 3101);
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(pathname, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let payload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`${pathname} returned invalid JSON: ${raw}`);
    }
  }

  return { status: response.status, payload };
}

async function waitForHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const { status, payload } = await request('/health');
      if (status === 200 && payload.ok && payload.service === 'ai-server') {
        return payload;
      }
      lastError = new Error(`Unexpected /health payload: ${JSON.stringify(payload)}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }

  throw new Error(
    `Server health check timed out after ${timeoutMs}ms: ${lastError?.message || 'unknown'}`
  );
}

function randomEmail() {
  const random = Math.random().toString(36).slice(2, 10);
  return `smoke-${Date.now()}-${random}@example.com`;
}

async function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  serverProcess.kill();
  await Promise.race([
    new Promise((resolve) => serverProcess.once('exit', resolve)),
    sleep(5000),
  ]);

  if (!serverProcess.killed) {
    try {
      serverProcess.kill('SIGKILL');
    } catch {
      // Ignore hard kill failure.
    }
  }
}

async function main() {
  const adminEmail = `admin-${Date.now()}@smoke.local`;
  const adminPassword = `Smoke-${crypto.randomBytes(12).toString('base64url')}!`;
  const smokeDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mobiluygulama-smoke-'));
  const smokeDataFile = path.join(smokeDataDir, 'users.secure.db');
  const serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      AI_SERVER_PORT: String(PORT),
      GEMINI_API_KEY: '',
      APP_DATA_FILE: smokeDataFile,
      APP_DATA_SECRET: `smoke-secret-${Date.now()}`,
      ADMIN_EMAIL: adminEmail,
      ADMIN_PASSWORD: adminPassword,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (chunk) => process.stdout.write(`[server] ${chunk}`));
  serverProcess.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

  try {
    const health = await waitForHealth();
    assert(health.ok === true, 'Health endpoint did not report ok=true.');

    const appConfigResponse = await request('/api/app/config');
    assert(appConfigResponse.status === 200, 'App config endpoint did not return HTTP 200.');
    assert(
      Array.isArray(appConfigResponse.payload.config?.adminButtons),
      'App config endpoint did not return adminButtons array.'
    );

    const recipeResponse = await request('/api/ai/recipe', {
      method: 'POST',
      body: {
        ingredientsText: 'chicken, rice, tomato',
        language: 'en',
      },
    });
    assert(recipeResponse.status === 200, 'Recipe endpoint did not return HTTP 200.');
    assert(recipeResponse.payload.recipe?.title, 'Recipe endpoint returned an empty title.');
    assert(
      Array.isArray(recipeResponse.payload.recipe?.steps) &&
        recipeResponse.payload.recipe.steps.length > 0,
      'Recipe endpoint returned no steps.'
    );

    const translationResponse = await request('/api/ai/translate-recipe', {
      method: 'POST',
      body: {
        recipe: recipeResponse.payload.recipe,
        language: 'de',
      },
    });
    assert(
      translationResponse.status === 200,
      'Translate recipe endpoint did not return HTTP 200.'
    );
    assert(
      translationResponse.payload.recipe?.locale === 'de',
      'Translate recipe endpoint did not set locale=de.'
    );

    const workoutResponse = await request('/api/ai/workout-plan', {
      method: 'POST',
      body: {
        goalText: 'Build chest and back strength',
        duration: 'weekly',
        regions: ['chest', 'back'],
        language: 'en',
      },
    });
    assert(workoutResponse.status === 200, 'Workout endpoint did not return HTTP 200.');
    assert(
      Array.isArray(workoutResponse.payload.plan?.days) &&
        workoutResponse.payload.plan.days.length > 0,
      'Workout endpoint returned no workout days.'
    );
    assert(
      workoutResponse.payload.fallback === true,
      'Workout endpoint should report fallback=true when Gemini key is missing.'
    );

    const appHelpQuestion = `Where can I find favorite recipes smoke ${Date.now()}?`;
    const appHelpResponse = await request('/api/ai/app-help', {
      method: 'POST',
      body: {
        question: appHelpQuestion,
        language: 'en',
      },
    });
    assert(appHelpResponse.status === 200, 'App-help endpoint did not return HTTP 200.');
    assert(
      typeof appHelpResponse.payload.answer === 'string' &&
        appHelpResponse.payload.answer.trim().length > 0,
      'App-help endpoint returned an empty answer.'
    );
    assert(
      appHelpResponse.payload.fallback === true,
      'App-help endpoint should report fallback=true when Gemini key is missing.'
    );

    const cachedAppHelpResponse = await request('/api/ai/app-help', {
      method: 'POST',
      body: {
        question: appHelpQuestion,
        language: 'en',
      },
    });
    assert(cachedAppHelpResponse.status === 200, 'Cached app-help request failed.');
    assert(
      cachedAppHelpResponse.payload.cached === true,
      'Repeated app-help question was not served from cache.'
    );

    const variantsResponse = await request('/api/ai/recipe-variants', {
      method: 'POST',
      body: {
        ingredientsText: 'chicken, rice, tomato',
        language: 'en',
      },
    });
    assert(
      variantsResponse.status === 200,
      'Recipe-variants endpoint did not return HTTP 200.'
    );
    assert(
      Array.isArray(variantsResponse.payload.variants) &&
        variantsResponse.payload.variants.length >= 3,
      'Recipe-variants endpoint did not return expected provider variants.'
    );

    const email = randomEmail();
    const registerResponse = await request('/api/auth/register', {
      method: 'POST',
      body: {
        email,
        password: '123456',
        confirmPassword: '123456',
        language: 'en',
      },
    });
    assert(registerResponse.status === 201, 'Register endpoint did not return HTTP 201.');
    const token = registerResponse.payload.token;
    assert(typeof token === 'string' && token.length > 20, 'Register endpoint token is invalid.');

    const stateResponse = await request('/api/user/state', { token });
    assert(stateResponse.status === 200, 'User state endpoint did not return HTTP 200.');
    assert(stateResponse.payload.user?.email === email, 'User state endpoint returned wrong user.');

    const profileResponse = await request('/api/user/profile', {
      method: 'PUT',
      token,
      body: {
        profile: {
          displayName: 'Smoke QA',
          language: 'en',
          themeColor: 'obsidian',
          photoUri: 'blob:http://localhost:8081/bad-photo',
        },
      },
    });
    assert(profileResponse.status === 200, 'Profile endpoint did not return HTTP 200.');
    assert(
      profileResponse.payload.user?.profile?.displayName === 'Smoke QA',
      'Profile endpoint did not persist displayName.'
    );
    assert(
      profileResponse.payload.user?.profile?.photoUri === undefined,
      'Profile endpoint did not strip unsupported blob photo URI.'
    );

    const dataResponse = await request('/api/user/data', {
      method: 'PUT',
      token,
      body: {
        latestRecipe: recipeResponse.payload.recipe,
        history: [recipeResponse.payload.recipe],
        favorites: [],
        consumedMacros: { protein: 24, carbs: 35, fat: 9, calories: 420 },
        nutritionLog: [
          {
            date: '2026-05-03',
            totals: { protein: 24, carbs: 35, fat: 9, calories: 420 },
            items: [
              {
                id: 'recipe-smoke',
                title: recipeResponse.payload.recipe.title,
                completedAt: new Date().toISOString(),
                calories: '420 kcal',
                nutrition: { protein: '24 g', carbs: '35 g', fat: '9 g' },
              },
            ],
          },
        ],
        savedWorkoutPlans: [workoutResponse.payload.plan],
      },
    });
    assert(dataResponse.status === 200, 'User data endpoint did not return HTTP 200.');

    const stateAfterDataResponse = await request('/api/user/state', { token });
    assert(
      stateAfterDataResponse.payload.data?.nutritionLog?.[0]?.date === '2026-05-03',
      'User state endpoint did not persist nutrition history.'
    );

    const adminLoginResponse = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: adminEmail,
        password: adminPassword,
      },
    });
    assert(adminLoginResponse.status === 200, 'Admin login did not return HTTP 200.');
    assert(adminLoginResponse.payload.user?.role === 'admin', 'Admin user role missing.');

    const adminConfigResponse = await request('/api/admin/app-config', {
      method: 'PUT',
      token: adminLoginResponse.payload.token,
      body: {
        config: {
          adminButtons: [
            {
              label: 'Docs',
              url: 'https://docs.expo.dev/',
              active: true,
            },
          ],
        },
      },
    });
    assert(adminConfigResponse.status === 200, 'Admin app-config update failed.');
    assert(
      adminConfigResponse.payload.config?.adminButtons?.[0]?.label === 'Docs',
      'Admin app-config update did not persist button.'
    );

    const passwordResponse = await request('/api/user/change-password', {
      method: 'POST',
      token,
      body: {
        currentPassword: '123456',
        nextPassword: '1234567',
        confirmPassword: '1234567',
      },
    });
    assert(
      passwordResponse.status === 200 && passwordResponse.payload.ok === true,
      'Change password endpoint failed.'
    );

    const logoutResponse = await request('/api/auth/logout', {
      method: 'POST',
      token,
    });
    assert(
      logoutResponse.status === 200 && logoutResponse.payload.ok === true,
      'Logout endpoint failed.'
    );

    console.log('\nSmoke test passed.');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(
      'Validated endpoints: health, app-config, admin config, recipe, recipe-variants, translate-recipe, workout-plan, app-help cache, auth, profile, user data.'
    );
  } finally {
    await stopServer(serverProcess);
    fs.rmSync(smokeDataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('\nSmoke test failed.');
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
