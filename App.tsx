import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';

const HERO_IMAGE = { uri: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800' };
const FALLBACK_IMAGE = { uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800' };

const REFRESH_MS = 5 * 60 * 1000;
const RECOMMENDATION_COUNT = 6;
const APP_CREATED_AT = '2026-04-05T00:00:00.000Z';
const APP_AUTHOR = 'Emirhan "Broskosss" Durmus';
const LATEST_UPDATE_AT = '2026-06-09T00:00:00+03:00';
const APP_VERSION = `v${Constants.expoConfig?.version || '0.0.1'}`;
const PROFILE_PHOTO_DATA_URI_LIMIT = 700000;
let clientIdCounter = 0;
const MACRO_TARGETS = {
  protein: 120,
  carbs: 250,
  fat: 70,
  calories: 2200,
} as const;

function expoExtraValue(key: string) {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function makeClientId(prefix: string) {
  clientIdCounter += 1;
  return `${prefix}-${Date.now()}-${clientIdCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function getPersonalizedMacros(profile: UserProfile | undefined) {
  if (!profile || !profile.weight || !profile.height || !profile.age || !profile.gender) {
    return MACRO_TARGETS;
  }
  const w = Number(profile.weight);
  const h = Number(profile.height);
  const a = Number(profile.age);
  const isMale = profile.gender === 'male';
  
  // BMR using Mifflin-St Jeor Formula
  const bmr = 10 * w + 6.25 * h - 5 * a + (isMale ? 5 : -161);
  
  // TDEE multiplier
  let multiplier = 1.2;
  if (profile.activityLevel === 'light') multiplier = 1.375;
  else if (profile.activityLevel === 'moderate') multiplier = 1.55;
  else if (profile.activityLevel === 'active') multiplier = 1.725;
  
  const tdee = bmr * multiplier;
  
  // Caloric Target based on Goal
  let targetCalories = tdee;
  if (profile.fitnessGoal === 'lose') {
    targetCalories = Math.max(1200, tdee - 500);
  } else if (profile.fitnessGoal === 'gain') {
    targetCalories = tdee + 400;
  } else if (profile.fitnessGoal === 'muscle') {
    targetCalories = tdee + 200;
  }
  
  // Protein Target based on body weight (2.0g/kg for muscle/lose, 1.6g/kg for gain/maintain)
  let proteinPerKg = 1.6;
  if (profile.fitnessGoal === 'muscle' || profile.fitnessGoal === 'lose') {
    proteinPerKg = 2.0;
  }
  const protein = Math.max(40, Math.round(w * proteinPerKg));
  
  // Fat Target: 25% of target calories (1g fat = 9 kcal)
  const fat = Math.max(30, Math.round((targetCalories * 0.25) / 9));
  
  // Carbohydrates Target: remaining calories (1g carb = 4 kcal)
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbs = Math.max(50, Math.round((targetCalories - proteinKcal - fatKcal) / 4));
  
  const calories = Math.round(targetCalories);
  
  return { protein, carbs, fat, calories };
}

const EMPTY_APP_CONFIG: AppConfig = { adminButtons: [] };
const MOTION_STYLES: MotionStyle[] = [
  'curl',
  'press',
  'hinge',
  'squat',
  'pull',
  'twist',
  'plank',
];
const workoutThumbnail = (videoId: string) =>
  `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
type WorkoutVideo = {
  title: string;
  videoId: string;
  thumbnail: string;
  watchUrl?: string;
  startSeconds?: number;
  endSeconds?: number;
};
type WorkoutVideoKey =
  | MotionStyle
  | 'wristCurl'
  | 'reverseWristCurl'
  | 'chairDips'
  | 'tricepsExtension'
  | 'gobletSquat'
  | 'romanianDeadlift'
  | 'pushUp'
  | 'floorPress'
  | 'bentOverRow'
  | 'superman'
  | 'overheadPress'
  | 'lateralRaise'
  | 'deadBug'
  | 'forearmPlank'
  | 'russianTwist'
  | 'pullUp';
const WORKOUT_VIDEOS: Record<WorkoutVideoKey, WorkoutVideo> = {
  curl: {
    title: 'Biceps Curl - short form clip',
    videoId: 'ykJmrZ5v0Oo',
    thumbnail: workoutThumbnail('ykJmrZ5v0Oo'),
    startSeconds: 6,
    endSeconds: 58,
  },
  press: {
    title: 'Push-Up - short form clip',
    videoId: 'JyCG_5l3XLk',
    thumbnail: workoutThumbnail('JyCG_5l3XLk'),
    startSeconds: 6,
    endSeconds: 58,
  },
  hinge: {
    title: 'Romanian Deadlift - short form clip',
    videoId: 'o_UD5VkV4oU',
    thumbnail: workoutThumbnail('o_UD5VkV4oU'),
    startSeconds: 5,
    endSeconds: 58,
  },
  squat: {
    title: 'Goblet Squat - short form clip',
    videoId: 'iFIkKKqRaD8',
    thumbnail: workoutThumbnail('iFIkKKqRaD8'),
    startSeconds: 6,
    endSeconds: 58,
  },
  pull: {
    title: 'Pull-Up - short form clip',
    videoId: 'Ir8IrbYcM8w',
    thumbnail: workoutThumbnail('Ir8IrbYcM8w'),
    startSeconds: 6,
    endSeconds: 58,
  },
  twist: {
    title: 'Russian Twist - short form clip',
    videoId: 'wkD8rjkodUI',
    thumbnail: workoutThumbnail('wkD8rjkodUI'),
    startSeconds: 6,
    endSeconds: 58,
  },
  plank: {
    title: 'Forearm Plank - short form clip',
    videoId: 'mH5Sfb_KTGg',
    thumbnail: workoutThumbnail('mH5Sfb_KTGg'),
    startSeconds: 5,
    endSeconds: 55,
  },
  wristCurl: {
    title: 'Wrist Curl - short form clip',
    videoId: '3VLTzIrnb5g',
    thumbnail: workoutThumbnail('3VLTzIrnb5g'),
    startSeconds: 3,
    endSeconds: 45,
  },
  reverseWristCurl: {
    title: 'Reverse Wrist Curl - short form clip',
    videoId: 'FW7URAaC-vE',
    thumbnail: workoutThumbnail('FW7URAaC-vE'),
    startSeconds: 8,
    endSeconds: 58,
  },
  chairDips: {
    title: 'Bench / Chair Dip - short form clip',
    videoId: 'lPXJMzFXFvc',
    thumbnail: workoutThumbnail('lPXJMzFXFvc'),
    startSeconds: 6,
    endSeconds: 55,
  },
  tricepsExtension: {
    title: 'Triceps Extension - short form clip',
    videoId: '_gsUck-7M74',
    thumbnail: workoutThumbnail('_gsUck-7M74'),
    startSeconds: 6,
    endSeconds: 58,
  },
  gobletSquat: {
    title: 'Goblet Squat - short form clip',
    videoId: 'iFIkKKqRaD8',
    thumbnail: workoutThumbnail('iFIkKKqRaD8'),
    startSeconds: 6,
    endSeconds: 58,
  },
  romanianDeadlift: {
    title: 'Romanian Deadlift - short form clip',
    videoId: 'o_UD5VkV4oU',
    thumbnail: workoutThumbnail('o_UD5VkV4oU'),
    startSeconds: 5,
    endSeconds: 58,
  },
  pushUp: {
    title: 'Push-Up - short form clip',
    videoId: 'JyCG_5l3XLk',
    thumbnail: workoutThumbnail('JyCG_5l3XLk'),
    startSeconds: 6,
    endSeconds: 58,
  },
  floorPress: {
    title: 'Dumbbell Floor Press - short form clip',
    videoId: 'T0Y3OBF1bNI',
    thumbnail: workoutThumbnail('T0Y3OBF1bNI'),
    startSeconds: 3,
    endSeconds: 45,
  },
  bentOverRow: {
    title: 'Bent-Over Row - short form clip',
    videoId: 'B1T6ZYrPAy4',
    thumbnail: workoutThumbnail('B1T6ZYrPAy4'),
    startSeconds: 6,
    endSeconds: 58,
  },
  superman: {
    title: 'Superman Exercise - short form clip',
    videoId: 'cc6UVRS7PW4',
    thumbnail: workoutThumbnail('cc6UVRS7PW4'),
    startSeconds: 4,
    endSeconds: 45,
  },
  overheadPress: {
    title: 'Overhead Shoulder Press - short form clip',
    videoId: 'flpBXsHSVDk',
    thumbnail: workoutThumbnail('flpBXsHSVDk'),
    startSeconds: 6,
    endSeconds: 58,
  },
  lateralRaise: {
    title: 'Dumbbell Lateral Raise - short form clip',
    videoId: 'XPPfnSEATJA',
    thumbnail: workoutThumbnail('XPPfnSEATJA'),
    startSeconds: 3,
    endSeconds: 45,
  },
  deadBug: {
    title: 'Dead Bug - short form clip',
    videoId: 'kwWZBbkXtg4',
    thumbnail: workoutThumbnail('kwWZBbkXtg4'),
    startSeconds: 5,
    endSeconds: 55,
  },
  forearmPlank: {
    title: 'Forearm Plank - short form clip',
    videoId: 'mH5Sfb_KTGg',
    thumbnail: workoutThumbnail('mH5Sfb_KTGg'),
    startSeconds: 5,
    endSeconds: 55,
  },
  russianTwist: {
    title: 'Russian Twist - short form clip',
    videoId: 'wkD8rjkodUI',
    thumbnail: workoutThumbnail('wkD8rjkodUI'),
    startSeconds: 6,
    endSeconds: 58,
  },
  pullUp: {
    title: 'Pull-Up - short form clip',
    videoId: 'Ir8IrbYcM8w',
    thumbnail: workoutThumbnail('Ir8IrbYcM8w'),
    startSeconds: 6,
    endSeconds: 58,
  },
};

type Screen = 'home' | 'kitchen' | 'health';
type Language = 'tr' | 'en' | 'de' | 'es';
type ThemeColor =
  | 'obsidian'
  | 'ivory'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'rose';
type ProfileAvatarColor = 'mint' | 'sky' | 'rose' | 'amber' | 'violet';
type RecipeSource = 'generated' | 'recommended';
type MacroKey = keyof typeof MACRO_TARGETS;
type PlanDuration = 'daily' | 'weekly' | 'monthly';
type BodyRegion =
  | 'forearm'
  | 'triceps'
  | 'legs'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'core';
type MotionStyle =
  | 'curl'
  | 'press'
  | 'hinge'
  | 'squat'
  | 'pull'
  | 'twist'
  | 'plank';
type ShareTarget = 'system' | 'whatsapp' | 'facebook' | 'instagram';
type AuthMode = 'login' | 'register';
type RecipeNutrition = { protein: string; fat: string; carbs: string };
type Recipe = {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  imageUrl?: string;
  youtubeUrl?: string;
  sourceUrl?: string;
  cookTime?: string;
  calories?: string;
  summary?: string;
  nutrition?: RecipeNutrition;
  source: RecipeSource;
  locale?: Language;
  note?: string;
  completedAt?: string;
  savedAt?: string;
};
type MacroTotals = Record<MacroKey, number>;
type Exercise = {
  id: string;
  name: string;
  region: BodyRegion;
  sets: string;
  reps: string;
  rest: string;
  summary: string;
  instructions: string[];
  animationCue: string;
  motionStyle: MotionStyle;
  youtubeUrl?: string;
  sourceUrl?: string;
};
type WorkoutDay = {
  id: string;
  title: string;
  focus: string;
  exercises: Exercise[];
};
type WorkoutPlan = {
  id: string;
  title: string;
  summary: string;
  duration: PlanDuration;
  regions: BodyRegion[];
  createdAt: string;
  days: WorkoutDay[];
};
type UserProfile = {
  displayName: string;
  language: Language;
  themeColor: ThemeColor;
  avatarColor?: ProfileAvatarColor;
  photoUri?: string;
  weight?: number;
  height?: number;
  age?: number;
  gender?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active';
  fitnessGoal?: 'lose' | 'maintain' | 'gain' | 'muscle';
};
type UserRole = 'user' | 'admin';
type UserAccount = {
  id: string;
  email: string;
  createdAt: string;
  profile: UserProfile;
  role?: UserRole;
};
type NutritionLogItem = {
  id: string;
  title: string;
  completedAt: string;
  calories?: string;
  nutrition?: RecipeNutrition;
};
type NutritionLogEntry = {
  date: string;
  totals: MacroTotals;
  items: NutritionLogItem[];
};
type AdminButton = {
  id: string;
  label: string;
  url: string;
  active: boolean;
};
type AppConfig = {
  adminButtons: AdminButton[];
  updatedAt?: string;
};
type UserDataPayload = {
  latestRecipe: Recipe | null;
  history: Recipe[];
  favorites: Recipe[];
  consumedMacros: MacroTotals;
  nutritionLog: NutritionLogEntry[];
  savedWorkoutPlans: WorkoutPlan[];
};
type Session = {
  token: string;
  user: UserAccount;
};
type SharePayload = {
  title: string;
  message: string;
};
type AiRecipeVariant = {
  provider: string;
  label: string;
  model?: string;
  available: boolean;
  recipe?: Recipe;
  warning?: string;
};
type AssistantMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};
type OperationState = {
  visible: boolean;
  label: string;
  progress: number;
};
type ThemePalette = {
  key: 'obsidian' | 'ivory';
  isDark: boolean;
  stage: [string, string];
  background: [string, string];
  hero: [string, string];
  surface: string;
  surfaceAlt: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentGhost: string;
  overlay: string;
  shadow: string;
  depthA: string;
  depthB: string;
  depthC: string;
  input: string;
  inputBorder: string;
  ringTrack: string;
  inverseText: string;
  chip: string;
  chipText: string;
  frame: string;
  placeholder: string;
};

const EN_COPY = {
  homeGreeting: 'Hello',
  guestName: 'Guest',
  homeHeroTitle: 'Smart kitchen, web recipes, and sports support',
  homeHeroSubtitle:
    'Recipes, nutrition, favorites, history, and real exercise videos stay connected in one polished flow.',
  appTalk: 'App guide',
  appTalkTitle: 'App Guide',
  appTalkSubtitle:
    'Ask about the app, recipes, nutrition, sport plans, or settings.',
  appTalkPlaceholder: 'Example: How should I balance protein today?',
  appTalkScope:
    'Answers are served from the app guide and cached on the server for repeated questions.',
  quickUsage: 'How do I use it?',
  quickAi: 'How does search work?',
  quickTheme: 'How does nutrition reset?',
  send: 'Send',
  macroTitle: 'Daily Nutrition Tracker',
  macroSubtitle:
    'Small round bars stay side by side and fill up as you complete recipes.',
  macroHint:
    'Use "Cooked it" in recipe details. The daily totals reset every 24 hours.',
  nutritionHistory: 'Nutrition history',
  nutritionHistoryButton: 'History',
  nutritionHistoryEmpty: 'No previous nutrition day has been saved yet.',
  todayNutrition: 'Today',
  kitchenLabel: 'Smart Kitchen',
  kitchenFeatureTitle: 'Recipe flow with web sources',
  kitchenFeatureText:
    'Create recipes, open details, and keep favorites and history visually organized.',
  healthLabel: 'Sports',
  healthFeatureTitle: 'Plans with real videos',
  healthFeatureText:
    'Workout details use real YouTube exercise videos instead of bundled GIFs.',
  healthCoachTitle: 'Sports and Health Coach',
  healthCoachSubtitle:
    'Build a smooth training plan from your goal, duration, and focus areas.',
  coachMode: 'Coach mode',
  coachReadiness: 'Readiness',
  coachFocus: 'Focus',
  coachLibrary: 'Library',
  coachPlanSignal: 'Plan signal',
  coachRecovery: 'Recovery',
  coachLoad: 'Load',
  coachSavedCount: 'Saved',
  coachSelectedRegions: 'Selected',
  coachNoPlan:
    'Your first coach result will appear here with videos and daily structure.',
  openAssistant: 'Open',
  kitchenScreenTitle: 'Smart Kitchen Assistant',
  kitchenGuideTitle: 'How to use the kitchen assistant',
  kitchenGuideText:
    'Write ingredients, search web recipe sources, and use Details for the full card actions.',
  pantryTitle: 'Today ingredients',
  pantryPlaceholder: 'Example: chicken, yogurt, pepper',
  generateAi: 'Find recipe',
  recommendedRecipes: 'Recommended Recipes',
  refresh: 'Refresh',
  detail: 'Details',
  markDone: 'Cooked it',
  historyTitle: 'Recipe history',
  favoriteTitle: 'Favorite recipes',
  emptyHistory: 'No recipe history yet.',
  emptyFavorites: 'No favorite recipe yet.',
  notePlaceholder: 'Add a note under this recipe',
  shareTitle: 'Share',
  shareWhatsApp: 'WhatsApp',
  shareFacebook: 'Facebook',
  shareInstagram: 'Instagram DM',
  shareSystem: 'Device share',
  aiVariantsButton: 'Other source recipes',
  aiVariantsTitle: 'Source Comparison',
  aiVariantsSubtitle:
    'See recipe alternatives from different web sources in one panel.',
  aiVariantsLoad: 'Load source alternatives',
  aiVariantUnavailable: 'Provider unavailable on server',
  aiVariantApply: 'Open this recipe',
  aiVariantsEmpty: 'No valid recipe returned from additional sources.',
  close: 'Close',
  addFavorite: 'Add favorite',
  removeFavorite: 'Remove favorite',
  healthScreenTitle: 'Sports and Health Coach',
  healthGuideTitle: 'How to use the sports assistant',
  healthGuideText:
    'Pick a duration, choose body regions, build the plan from exercise sources, and open the detail view to watch videos.',
  workoutGoal: 'Program request',
  workoutGoalPlaceholder:
    'Example: chest and triceps focus, medium intensity',
  duration: 'Plan duration',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  regions: 'Body regions',
  generatePlan: 'Create workout plan',
  savePlan: 'Save plan',
  savedPlans: 'Saved plans',
  emptyPlans: 'No saved plan yet.',
  openPlan: 'Open plan',
  gifTitle: 'Exercise video',
  videoTitle: 'Exercise video',
  openVideo: 'Open video',
  recipeVideo: 'Recipe video',
  watchRecipeVideo: 'Watch recipe video',
  profileTitle: 'Profile',
  settingsTitle: 'Settings',
  displayName: 'Display name',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  login: 'Log in',
  register: 'Register',
  currentPassword: 'Current password',
  newPassword: 'New password',
  changePassword: 'Change password',
  logout: 'Log out',
  profileShare: 'Share profile',
  adminPanel: 'Admin panel',
  adminButtonLabel: 'Button label',
  adminButtonUrl: 'Button URL',
  addButton: 'Add button',
  saveAdmin: 'Save admin changes',
  adminSaved: 'Admin changes saved.',
  adminOnly: 'Only admin users can update app buttons.',
  language: 'Language',
  themeColor: 'Theme',
  avatarColor: 'Profile color',
  memberSince: 'Member since',
  saveProfile: 'Save settings',
  photo: 'Profile photo',
  choosePhoto: 'Choose photo',
  weight: 'Weight (kg)',
  height: 'Height (cm)',
  age: 'Age',
  gender: 'Gender',
  genderMale: 'Male',
  genderFemale: 'Female',
  activityLevel: 'Activity level',
  activitySedentary: 'Sedentary',
  activityLight: 'Lightly Active',
  activityModerate: 'Moderately Active',
  activityActive: 'Very Active',
  fitnessGoal: 'Fitness goal',
  goalLose: 'Weight Loss',
  goalMaintain: 'Maintain Weight',
  goalGain: 'Weight Gain',
  goalMuscle: 'Build Muscle',
  personalizedTargetHint: 'Targets calculated based on your profile',
  coachCommentsTitle: 'Nutritional Coach Insights',
  authSubtitle:
    'Log in to keep favorites, recipe history, and workout plans separate for each user.',
  passwordMismatch: 'Passwords must match.',
  loginRequired: 'Login required',
  loginRequiredText:
    'This item is saved per user. Please log in before saving it.',
  passwordChanged: 'Password updated.',
  profileSaved: 'Settings saved.',
  generatedRecipe: 'Web recipe',
  recommendedRecipe: 'Recommended',
  caloriesShort: 'kcal',
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
  calories: 'Calories',
  unknownTime: 'Time unknown',
  unknownCalories: 'Calories unknown',
  ingredientsSection: 'Ingredients',
  stepsSection: 'Steps',
  emptyIngredients: 'Please enter ingredients first.',
  aiFallback:
    'No strong web match was found, so a safe fallback recipe was created instead.',
  refreshFailed: 'Recommended recipes could not be loaded.',
  workoutFallback:
    'No strong exercise-source match was found, so a safe workout plan was created.',
  authError: 'Something went wrong. Please try again.',
  changePasswordHint:
    'Use your current password once, then enter the new password twice.',
  latestRecipe: 'Latest recipe',
  latestPlan: 'Latest plan',
  noLatestRecipe: 'Create a recipe or mark one as cooked to see it here.',
  noLatestPlan: 'Create a workout plan to see it here.',
  regionForearm: 'Forearm',
  regionTriceps: 'Triceps',
  regionLegs: 'Legs',
  regionChest: 'Chest',
  regionBack: 'Back',
  regionShoulders: 'Shoulders',
  regionCore: 'Core',
  saveSuccess: 'Saved',
  planSavedText: 'Workout plan saved to your account.',
  memberProfileText: 'Kitchen and sports profile summary',
  shareFallback:
    'That app is unavailable right now, so device sharing opened instead.',
  doneAndAdd: 'Cooked it + add macros',
  aboutTitle: 'About',
  aboutSummary:
    'This app focuses on smart recipes, visual history, nutrition tracking, and sports plans with real exercise videos.',
  aboutDateLabel: 'Created',
  aboutAuthorLabel: 'Built by',
  aboutThemeLabel: 'Theme update',
  aboutThemeSummary:
    'The background now has layered depth in both black and white modes.',
  updateTitle: 'Update',
  versionLabel: 'Version',
  latestUpdateLabel: 'Last update',
  latestUpdateSummary:
    'The home screen is now more compact, with kitchen first and nutrition plus sports summaries at the bottom. Profile settings now use color avatars and show the latest update with the app version.',
  themeObsidian: 'Black depth',
  themeIvory: 'White depth',
  loadingRecipe: 'Searching recipe sources',
  loadingPlan: 'Searching exercise sources',
  loadingRecommendations: 'Recipes are loading and being localized',
  loadingAppChat: 'App guide is checking details',
  loadingAiVariants: 'Recipe sources are loading alternatives',
  loadingGeneric: 'Processing',
  appOnlyAnswer:
    'I can help with this app, recipes, nutrition, workout plans, videos, settings, themes, and safe usage tips.',
};

const TR_COPY: typeof EN_COPY = {
  homeGreeting: 'Merhaba',
  guestName: 'Misafir',
  homeHeroTitle: 'Akilli mutfak, web tarifleri ve spor destegi',
  homeHeroSubtitle:
    'Tarifler, besin takibi, favoriler, gecmis ve gercek egzersiz videolari tek akista bagli kalir.',
  appTalk: 'Uygulama rehberi',
  appTalkTitle: 'Uygulama Rehberi',
  appTalkSubtitle:
    'Uygulama, tarifler, besin takibi, spor plani veya ayarlar hakkinda sor.',
  appTalkPlaceholder: 'Ornek: Bugun proteini nasil dengelerim?',
  appTalkScope:
    'Cevaplar uygulama rehberinden gelir ve ayni soru tekrar gelirse sunucu cacheinden kullanilir.',
  quickUsage: 'Uygulamayi nasil kullanirim?',
  quickAi: 'Arama nasil calisiyor?',
  quickTheme: 'Besin takibi nasil yenilenir?',
  send: 'Gonder',
  macroTitle: 'Gunluk Besin Takibi',
  macroSubtitle:
    'Bugun yaptigin tariflerden gelen makrolar kompakt halkalarda toplanir.',
  macroHint:
    'Tarif detayinda "Yaptim + makrolari ekle"ye basinca bugune eklenir; eski gunler Gecmis icinde kalir.',
  nutritionHistory: 'Besin gecmisi',
  nutritionHistoryButton: 'Gecmis',
  nutritionHistoryEmpty: 'Henuz onceki gunlerden besin verisi kaydedilmedi.',
  todayNutrition: 'Bugun',
  kitchenLabel: 'Akilli Mutfak',
  kitchenFeatureTitle: 'Kaynak destekli tarif akisi',
  kitchenFeatureText:
    'Malzemeden tarif uret, detaylari ac ve favori ile gecmis kartlarini duzenli tut.',
  healthLabel: 'Spor',
  healthFeatureTitle: 'Gercek videolu planlar',
  healthFeatureText:
    'Spor sayfasinda hedefe gore plan olustur, hareket detaylarini ve videolari ayni yerde ac.',
  healthCoachTitle: 'Spor ve Saglik Kocu',
  healthCoachSubtitle:
    'Hedef, sure ve odak bolgelerine gore akici bir antrenman plani kur.',
  coachMode: 'Koc modu',
  coachReadiness: 'Hazirlik',
  coachFocus: 'Odak',
  coachLibrary: 'Kutuphane',
  coachPlanSignal: 'Plan sinyali',
  coachRecovery: 'Toparlanma',
  coachLoad: 'Yuk',
  coachSavedCount: 'Kayitli',
  coachSelectedRegions: 'Secili',
  coachNoPlan:
    'Ilk koc sonucu burada videolar ve gunluk yapi ile gorunecek.',
  openAssistant: 'Ac',
  kitchenScreenTitle: 'Akilli Mutfak Asistani',
  kitchenGuideTitle: 'Akilli mutfak nasil kullanilir?',
  kitchenGuideText:
    'Malzemeleri yaz, yemek sitelerinde tarif ara ve tum aksiyonlari Detaylar icinden yonet.',
  pantryTitle: 'Bugunun malzemeleri',
  pantryPlaceholder: 'Ornek: tavuk, yogurt, biber',
  generateAi: 'Tarif ara',
  recommendedRecipes: 'Önerilen Tarifler',
  refresh: 'Yenile',
  detail: 'Detaylar',
  markDone: 'Yaptim',
  historyTitle: 'Gecmis tarifler',
  favoriteTitle: 'Favori tarifler',
  emptyHistory: 'Henuz gecmis tarif yok.',
  emptyFavorites: 'Henuz favori tarif yok.',
  notePlaceholder: 'Bu tarifin altina not ekle',
  shareTitle: 'Paylas',
  shareWhatsApp: 'WhatsApp',
  shareFacebook: 'Facebook',
  shareInstagram: 'Instagram DM',
  shareSystem: 'Cihaz paylasimi',
  aiVariantsButton: 'Diger kaynak tarifleri',
  aiVariantsTitle: 'Kaynak Karsilastirma',
  aiVariantsSubtitle:
    'Farkli yemek kaynaklarindan bulunan tarifleri tek panelde karsilastir.',
  aiVariantsLoad: 'Kaynak alternatiflerini yukle',
  aiVariantUnavailable: 'Bu saglayici sunucuda aktif degil',
  aiVariantApply: 'Bu tarifi ac',
  aiVariantsEmpty: 'Ek kaynaklardan gecerli tarif donmedi.',
  close: 'Kapat',
  addFavorite: 'Favoriye ekle',
  removeFavorite: 'Favoriden cikar',
  healthScreenTitle: 'Spor ve Saglik Kocu',
  healthGuideTitle: 'Spor asistani nasil kullanilir?',
  healthGuideText:
    'Sure sec, bolge sec, egzersiz kaynaklariyla plani olustur ve detayda videolari izle.',
  workoutGoal: 'Program istegi',
  workoutGoalPlaceholder: 'Ornek: gogus ve arka kol odakli, orta tempo',
  duration: 'Plan suresi',
  daily: 'Gunluk',
  weekly: 'Haftalik',
  monthly: 'Aylik',
  regions: 'Vucut bolgeleri',
  generatePlan: 'Plan olustur',
  savePlan: 'Plani kaydet',
  savedPlans: 'Kayitli planlar',
  emptyPlans: 'Henuz kayitli plan yok.',
  openPlan: 'Plani ac',
  gifTitle: 'Egzersiz videosu',
  videoTitle: 'Egzersiz videosu',
  openVideo: 'Videoyu ac',
  recipeVideo: 'Tarif videosu',
  watchRecipeVideo: 'Tarif videosunu ac',
  profileTitle: 'Profil',
  settingsTitle: 'Ayarlar',
  displayName: 'Gorunen ad',
  email: 'E-posta',
  password: 'Sifre',
  confirmPassword: 'Sifreyi dogrula',
  login: 'Giris yap',
  register: 'Kayit ol',
  currentPassword: 'Mevcut sifre',
  newPassword: 'Yeni sifre',
  changePassword: 'Sifre degistir',
  logout: 'Cikis yap',
  profileShare: 'Profili paylas',
  adminPanel: 'Admin paneli',
  adminButtonLabel: 'Buton adi',
  adminButtonUrl: 'Buton URL',
  addButton: 'Buton ekle',
  saveAdmin: 'Admin degisikliklerini kaydet',
  adminSaved: 'Admin degisiklikleri kaydedildi.',
  adminOnly: 'Uygulama butonlarini sadece admin kullanicilar guncelleyebilir.',
  language: 'Dil',
  themeColor: 'Tema',
  avatarColor: 'Profil rengi',
  memberSince: 'Uyelik tarihi',
  saveProfile: 'Ayarlari kaydet',
  photo: 'Profil fotosu',
  choosePhoto: 'Foto sec',
  weight: 'Kilo (kg)',
  height: 'Boy (cm)',
  age: 'Yaş',
  gender: 'Cinsiyet',
  genderMale: 'Erkek',
  genderFemale: 'Kadın',
  activityLevel: 'Aktivite Seviyesi',
  activitySedentary: 'Hareketsiz',
  activityLight: 'Az Hareketli',
  activityModerate: 'Orta Hareketli',
  activityActive: 'Çok Hareketli',
  fitnessGoal: 'Sağlık Hedefi',
  goalLose: 'Kilo Verme',
  goalMaintain: 'Kiloyu Koruma',
  goalGain: 'Kilo Alma',
  goalMuscle: 'Kas Yapma',
  personalizedTargetHint: 'Profilinize göre hesaplanan günlük hedefleriniz',
  coachCommentsTitle: 'Beslenme Danışmanı Yorumu',
  authSubtitle:
    'Her kullanici icin favori, tarif gecmisi ve spor planlarini ayri tutmak icin giris yap.',
  passwordMismatch: 'Sifreler ayni olmali.',
  loginRequired: 'Giris gerekli',
  loginRequiredText:
    'Bu veri kullanici bazli saklanir. Lutfen kaydetmeden once giris yap.',
  passwordChanged: 'Sifre guncellendi.',
  profileSaved: 'Ayarlar kaydedildi.',
  generatedRecipe: 'Kaynak tarifi',
  recommendedRecipe: 'Onerilen',
  caloriesShort: 'kcal',
  protein: 'Protein',
  carbs: 'Karbonhidrat',
  fat: 'Yag',
  calories: 'Kalori',
  unknownTime: 'Sure bilinmiyor',
  unknownCalories: 'Kalori bilinmiyor',
  ingredientsSection: 'Malzemeler',
  stepsSection: 'Adimlar',
  emptyIngredients: 'Lutfen once malzeme gir.',
  aiFallback:
    'Guclu bir kaynak eslesmesi bulunamadi, bu yuzden guvenli bir yedek tarif olusturuldu.',
  refreshFailed: 'Önerilen tarifler yüklenemedi.',
  workoutFallback:
    'Guclu bir egzersiz kaynagi eslesmesi bulunamadi, bu yuzden guvenli bir spor plani olusturuldu.',
  authError: 'Bir seyler ters gitti. Lutfen tekrar dene.',
  changePasswordHint:
    'Mevcut sifreni bir kez, yeni sifreni ise iki kez gir.',
  latestRecipe: 'Son tarif',
  latestPlan: 'Son plan',
  noLatestRecipe: 'Burada gormek icin tarif olustur veya bir tarifi yaptim olarak isle.',
  noLatestPlan: 'Burada gormek icin bir spor plani olustur.',
  regionForearm: 'On kol',
  regionTriceps: 'Arka kol',
  regionLegs: 'Bacak',
  regionChest: 'Gogus',
  regionBack: 'Sirt',
  regionShoulders: 'Omuz',
  regionCore: 'Merkez',
  saveSuccess: 'Kaydedildi',
  planSavedText: 'Spor plani hesabina kaydedildi.',
  memberProfileText: 'Mutfak ve spor profil ozeti',
  shareFallback:
    'Hedef uygulama su an acilamadi, bu yuzden cihaz paylasimi acildi.',
  doneAndAdd: 'Yaptim + makrolari ekle',
  aboutTitle: 'Hakkinda',
  aboutSummary:
    'Bu uygulama akilli tarifler, gorsel gecmis, besin takibi ve gercek egzersiz videolari olan spor planlarina odaklanir.',
  aboutDateLabel: 'Kurulma tarihi',
  aboutAuthorLabel: 'Yapan',
  aboutThemeLabel: 'Tema guncellemesi',
  aboutThemeSummary:
    'Arka plan artik hem siyah hem beyaz modda katmanli derinlik sunuyor.',
  updateTitle: 'Guncelleme',
  versionLabel: 'Versiyon',
  latestUpdateLabel: 'Son guncelleme',
  latestUpdateSummary:
    'Ana sayfa daha kompakt hale getirildi; akilli mutfak one alindi ve besin ile spor ozetleri en alta tasindi. Profil ayarlarina renkli avatar, son guncelleme ozeti ve uygulama versiyonu eklendi.',
  themeObsidian: 'Siyah derinlik',
  themeIvory: 'Beyaz derinlik',
  loadingRecipe: 'Tarif kaynaklari araniyor',
  loadingPlan: 'Egzersiz kaynaklari araniyor',
  loadingRecommendations: 'Tarifler yukleniyor ve yerlestiriliyor',
  loadingAppChat: 'Uygulama rehberi detaylari kontrol ediyor',
  loadingAiVariants: 'Tarif kaynaklarindan alternatifler aliniyor',
  loadingGeneric: 'Isleniyor',
  appOnlyAnswer:
    'Bu uygulama, tarifler, besin takibi, spor planlari, videolar, ayarlar, tema ve guvenli kullanim hakkinda yardim edebilirim.',
};

const COPY: Record<Language, typeof EN_COPY> = {
  en: EN_COPY,
  tr: TR_COPY,
  de: { ...EN_COPY, themeObsidian: 'Schwarz', themeIvory: 'Weiss' },
  es: { ...EN_COPY, themeObsidian: 'Negro', themeIvory: 'Blanco' },
};

const THEMES: Record<'obsidian' | 'ivory', ThemePalette> = {
  obsidian: {
    key: 'obsidian',
    isDark: true,
    stage: ['#050505', '#0A0A0A'],
    background: ['#080808', '#0F0F0F'],
    hero: ['#1B1B1B', '#333333'],
    surface: 'rgba(28,28,28,0.65)',
    surfaceAlt: 'rgba(255,255,255,0.05)',
    card: 'rgba(32,32,32,0.75)',
    border: 'rgba(255,255,255,0.08)',
    text: '#F5F4EE',
    textMuted: '#D8D7D2',
    textSoft: '#9E9D98',
    accent: '#F7F7F3',
    accentStrong: '#FFFFFF',
    accentSoft: 'rgba(255,255,255,0.10)',
    accentGhost: 'rgba(255,255,255,0.08)',
    overlay: 'rgba(0,0,0,0.46)',
    shadow: '#000000',
    depthA: 'rgba(255,255,255,0.08)',
    depthB: 'rgba(255,255,255,0.04)',
    depthC: 'rgba(255,255,255,0.03)',
    input: '#0E0E0E',
    inputBorder: 'rgba(255,255,255,0.08)',
    ringTrack: 'rgba(255,255,255,0.08)',
    inverseText: '#060606',
    chip: 'rgba(255,255,255,0.08)',
    chipText: '#F5F4EE',
    frame: '#060606',
    placeholder: '#969690',
  },
  ivory: {
    key: 'ivory',
    isDark: false,
    stage: ['#EDEBE5', '#DAD5CC'],
    background: ['#FAF8F2', '#EEE8DD'],
    hero: ['#FFFFFF', '#EEE7DA'],
    surface: 'rgba(255,255,255,0.84)',
    surfaceAlt: 'rgba(17,17,17,0.04)',
    card: 'rgba(255,255,255,0.96)',
    border: 'rgba(17,17,17,0.10)',
    text: '#111111',
    textMuted: '#373737',
    textSoft: '#6E6C66',
    accent: '#111111',
    accentStrong: '#000000',
    accentSoft: 'rgba(17,17,17,0.08)',
    accentGhost: 'rgba(17,17,17,0.05)',
    overlay: 'rgba(10,10,10,0.22)',
    shadow: '#7D786F',
    depthA: 'rgba(255,255,255,0.56)',
    depthB: 'rgba(17,17,17,0.06)',
    depthC: 'rgba(17,17,17,0.04)',
    input: '#FFFFFF',
    inputBorder: 'rgba(17,17,17,0.08)',
    ringTrack: 'rgba(17,17,17,0.08)',
    inverseText: '#FFFFFF',
    chip: 'rgba(17,17,17,0.06)',
    chipText: '#111111',
    frame: '#F0ECE4',
    placeholder: '#8E8A82',
  },
};

const LANGUAGE_OPTIONS: { key: Language; label: string }[] = [
  { key: 'tr', label: 'Turkce' },
  { key: 'en', label: 'English' },
  { key: 'de', label: 'Deutsch' },
  { key: 'es', label: 'Espanol' },
];
const THEME_OPTIONS: ThemeColor[] = ['obsidian', 'ivory'];
const BODY_REGIONS: BodyRegion[] = [
  'forearm',
  'triceps',
  'legs',
  'chest',
  'back',
  'shoulders',
  'core',
];
const PROFILE_AVATAR_OPTIONS: {
  key: ProfileAvatarColor;
  color: string;
  soft: string;
}[] = [
  { key: 'mint', color: '#7CFFB2', soft: 'rgba(124,255,178,0.22)' },
  { key: 'sky', color: '#7DD3FC', soft: 'rgba(125,211,252,0.22)' },
  { key: 'rose', color: '#FDA4AF', soft: 'rgba(253,164,175,0.22)' },
  { key: 'amber', color: '#FCD34D', soft: 'rgba(252,211,77,0.22)' },
  { key: 'violet', color: '#C4B5FD', soft: 'rgba(196,181,253,0.22)' },
];

const textFor = (language: Language) => COPY[language];
const emptyMacros = (): MacroTotals => ({
  protein: 0,
  carbs: 0,
  fat: 0,
  calories: 0,
});

const parseNumber = (value?: string) =>
  Number(value?.match(/(\d+(?:\.\d+)?)/)?.[1] ?? 0);

const macroTotalsFromRecipe = (recipe: Recipe): MacroTotals => ({
  protein: parseNumber(recipe.nutrition?.protein),
  carbs: parseNumber(recipe.nutrition?.carbs),
  fat: parseNumber(recipe.nutrition?.fat),
  calories: parseNumber(recipe.calories),
});

const addMacros = (left: MacroTotals, right: MacroTotals): MacroTotals => ({
  protein: left.protein + right.protein,
  carbs: left.carbs + right.carbs,
  fat: left.fat + right.fat,
  calories: left.calories + right.calories,
});

const normalizeMacroTotals = (value: Partial<MacroTotals> | undefined): MacroTotals => ({
  protein: Number(value?.protein || 0),
  carbs: Number(value?.carbs || 0),
  fat: Number(value?.fat || 0),
  calories: Number(value?.calories || 0),
});

const localDateKey = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

const nutritionLogItemFromRecipe = (recipe: Recipe): NutritionLogItem => ({
  id: recipe.id,
  title: recipe.title,
  completedAt: recipe.completedAt || new Date().toISOString(),
  calories: recipe.calories,
  nutrition: recipe.nutrition,
});

const macrosForDate = (log: NutritionLogEntry[], dateKey = localDateKey()) =>
  log.find((entry) => entry.date === dateKey)?.totals ?? emptyMacros();

const normalizeNutritionLog = (value: unknown): NutritionLogEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value.map<NutritionLogEntry | null>((entry) => {
      const date = String((entry as NutritionLogEntry)?.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return null;
      }
      const items: NutritionLogItem[] = Array.isArray((entry as NutritionLogEntry).items)
        ? (entry as NutritionLogEntry).items
            .map((item) => ({
              id: String(item.id || Date.now()),
              title: String(item.title || '').trim(),
              completedAt: String(item.completedAt || new Date().toISOString()),
              calories: item.calories ? String(item.calories) : undefined,
              nutrition: item.nutrition,
            }))
            .filter((item) => item.title)
        : [];
      return {
        date,
        totals: normalizeMacroTotals((entry as NutritionLogEntry).totals),
        items,
      };
    });

  return normalized
    .filter((entry): entry is NutritionLogEntry => Boolean(entry))
    .sort((left, right) => (left.date < right.date ? 1 : -1));
};

const addRecipeToNutritionLog = (
  log: NutritionLogEntry[],
  recipe: Recipe,
  dateKey = localDateKey()
) => {
  const nextItem = nutritionLogItemFromRecipe(recipe);
  const nextMacros = macroTotalsFromRecipe(recipe);
  const existing = log.find((entry) => entry.date === dateKey);
  const updatedEntry: NutritionLogEntry = existing
    ? {
        ...existing,
        totals: addMacros(existing.totals, nextMacros),
        items: [
          nextItem,
          ...existing.items.filter((item) => item.id !== nextItem.id),
        ],
      }
    : {
        date: dateKey,
        totals: nextMacros,
        items: [nextItem],
      };

  return [
    updatedEntry,
    ...log.filter((entry) => entry.date !== dateKey),
  ].sort((left, right) => (left.date < right.date ? 1 : -1));
};

const isUnsupportedImageUri = (uri?: string) =>
  !uri || uri.startsWith('blob:') || uri.startsWith('file://localhost/');

const safeImageUri = (uri?: string) => {
  const value = String(uri || '').trim();
  if (isUnsupportedImageUri(value)) {
    return undefined;
  }
  if (value.startsWith('data:')) {
    return /^data:image\/(png|jpe?g|webp);base64,/i.test(value) &&
      value.length <= PROFILE_PHOTO_DATA_URI_LIMIT
      ? value
      : undefined;
  }
  if (/^https:\/\//i.test(value)) {
    return value;
  }
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(value)) {
    return value;
  }
  return undefined;
};

const normalizeAdminButton = (button: Partial<AdminButton>): AdminButton => ({
  id: String(button.id || Date.now()),
  label: String(button.label || '').trim().slice(0, 28),
  url: String(button.url || '').trim(),
  active: button.active !== false,
});

const normalizeAppConfig = (config?: Partial<AppConfig> | null): AppConfig => ({
  adminButtons: Array.isArray(config?.adminButtons)
    ? config.adminButtons
        .map(normalizeAdminButton)
        .filter((button) => button.label && /^https?:\/\//i.test(button.url))
        .slice(0, 8)
    : [],
  updatedAt: config?.updatedAt ? String(config.updatedAt) : undefined,
});

const stepLines = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return lines;
  }
  return text
    .split(/\.\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.endsWith('.') ? line : `${line}.`));
};

const toSeed = (value: string) =>
  value
    .split('')
    .reduce(
      (accumulator, character, index) =>
        accumulator + character.charCodeAt(0) * (index + 1),
      0
    );

const nutritionFromSeed = (seed: number): RecipeNutrition => ({
  protein: `${18 + (seed % 20)} g`,
  fat: `${8 + ((seed * 3) % 12)} g`,
  carbs: `${28 + ((seed * 5) % 24)} g`,
});

const withRecipeMeta = (recipe: Recipe, seedSource: string): Recipe => {
  const seed = toSeed(seedSource || recipe.title || recipe.id);
  const hasNutrition =
    Boolean(recipe.nutrition?.protein?.trim()) ||
    Boolean(recipe.nutrition?.fat?.trim()) ||
    Boolean(recipe.nutrition?.carbs?.trim());
  return {
    ...recipe,
    cookTime: recipe.cookTime?.trim() || `${15 + (seed % 21)} dk`,
    calories: recipe.calories?.trim() || `${290 + ((seed * 3) % 260)} kcal`,
    nutrition: hasNutrition ? recipe.nutrition : nutritionFromSeed(seed),
  };
};

function normalizeLanguage(value: unknown): Language {
  if (value === 'en' || value === 'de' || value === 'es') {
    return value;
  }
  return 'tr';
}

function languageLabel(language: Language) {
  return (
    {
      tr: 'Turkish',
      en: 'English',
      de: 'German',
      es: 'Spanish',
    }[language] || 'Turkish'
  );
}

function normalizeThemeColor(value: unknown): ThemeColor {
  if (
    value === 'obsidian' ||
    value === 'ivory' ||
    value === 'sunset' ||
    value === 'ocean' ||
    value === 'forest' ||
    value === 'rose'
  ) {
    return value;
  }
  return 'obsidian';
}

function normalizeProfileAvatarColor(value: unknown): ProfileAvatarColor {
  return PROFILE_AVATAR_OPTIONS.some((option) => option.key === value)
    ? (value as ProfileAvatarColor)
    : 'mint';
}

function profileAvatarPalette(value: unknown) {
  const avatarColor = normalizeProfileAvatarColor(value);
  return (
    PROFILE_AVATAR_OPTIONS.find((option) => option.key === avatarColor) ||
    PROFILE_AVATAR_OPTIONS[0]
  );
}

function resolveThemePalette(themeColor: ThemeColor | undefined): ThemePalette {
  return themeColor === 'ivory' ||
    themeColor === 'sunset' ||
    themeColor === 'ocean' ||
    themeColor === 'rose'
    ? THEMES.ivory
    : THEMES.obsidian;
}

function macroLabel(key: MacroKey, language: Language) {
  const text = textFor(language);
  return key === 'protein'
    ? text.protein
    : key === 'carbs'
      ? text.carbs
      : key === 'fat'
        ? text.fat
        : text.calories;
}

function macroValue(value: number, key: MacroKey, language: Language) {
  return key === 'calories'
    ? `${Math.round(value)} ${textFor(language).caloriesShort}`
    : `${Math.round(value)} g`;
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(
    language === 'tr'
      ? 'tr-TR'
      : language === 'de'
        ? 'de-DE'
        : language === 'es'
          ? 'es-ES'
          : 'en-US',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  ).format(new Date(value));
}

function createdAtLabel(language: Language) {
  return formatDate(APP_CREATED_AT, language);
}

function latestUpdateLabel(language: Language) {
  return formatDate(LATEST_UPDATE_AT, language);
}

function avatarInitials(user: UserAccount | null, fallback: string) {
  const source = user?.profile.displayName || user?.email || fallback;
  const parts = source
    .replace(/@.*/, '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const letters = parts.length > 1
    ? `${parts[0][0] || ''}${parts[1][0] || ''}`
    : source.slice(0, 2);
  return letters.toLocaleUpperCase('tr-TR');
}

const BLOCKED_SUMMARY_PATTERNS = [
  'cevrim ici servis gecici olarak ulasilamaz',
  'online recipe service was temporarily unreachable',
  'kaynak eslesmesi bulunamadi',
  'no strong web match',
  'fallback workout plan',
  'yedek spor plani',
  'yedek tarif',
];

function cleanCardSummary(summary?: string) {
  const value = String(summary || '').trim();
  if (!value) {
    return '';
  }
  const normalized = value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return BLOCKED_SUMMARY_PATTERNS.some((pattern) =>
    normalized.includes(pattern)
  )
    ? ''
    : value;
}

const STATIC_RECIPE_SUMMARY_TRANSLATIONS: Record<
  'recommended' | 'matched' | 'closest' | 'random' | 'fallback',
  Record<Language, string>
> = {
  recommended: {
    tr: 'Onerilen tarif',
    en: 'Recommended recipe',
    de: 'Empfohlenes Rezept',
    es: 'Receta recomendada',
  },
  matched: {
    tr: 'Tarif, cevrim ici yemek arsivinden malzemelerine gore eslestirildi.',
    en: 'Matched from the online recipe library using your ingredients.',
    de: 'Das Rezept wurde anhand deiner Zutaten aus der Online-Rezeptbibliothek gefunden.',
    es: 'La receta se encontro en la biblioteca en linea segun tus ingredientes.',
  },
  closest: {
    tr: 'Tam birebir eslesme bulunamadi, bu nedenle cevrim ici arsivden en yakin tarif secildi.',
    en: 'No exact online match was found, so a close online recipe was selected.',
    de: 'Es wurde keine exakte Ubereinstimmung gefunden, daher wurde ein ahnliches Online-Rezept ausgewahlt.',
    es: 'No se encontro una coincidencia exacta, por eso se eligio una receta en linea parecida.',
  },
  random: {
    tr: 'Cevrim ici arsivden taze bir tarif secildi.',
    en: 'A fresh recipe was selected from the online recipe library.',
    de: 'Ein frisches Rezept wurde aus der Online-Rezeptbibliothek ausgewahlt.',
    es: 'Se eligio una receta nueva de la biblioteca en linea.',
  },
  fallback: {
    tr: 'Cevrim ici servis gecici olarak ulasilamaz oldugu icin guvenli bir yedek tarif hazirlandi.',
    en: 'The online recipe service was temporarily unreachable, so a safe fallback recipe was prepared.',
    de: 'Der Online-Rezeptdienst war vorubergehend nicht erreichbar, daher wurde ein sicheres Ersatzrezept vorbereitet.',
    es: 'El servicio de recetas en linea no estaba disponible temporalmente, por eso se preparo una receta alternativa segura.',
  },
};

const INGREDIENT_ALIASES: Record<string, string> = {
  tavuk: 'chicken',
  'tavuk gogsu': 'chicken breast',
  yogurt: 'yogurt',
  yogourt: 'yogurt',
  domates: 'tomato',
  sogan: 'onion',
  sarimsak: 'garlic',
  biber: 'pepper',
  patates: 'potato',
  makarna: 'pasta',
  peynir: 'cheese',
  kasar: 'cheese',
  yumurta: 'egg',
  sucuk: 'sausage',
  sosis: 'sausage',
  ekmek: 'bread',
  sut: 'milk',
  un: 'flour',
  pirinc: 'rice',
  pilav: 'rice',
  et: 'beef',
  dana: 'beef',
  kiyma: 'beef',
  balik: 'fish',
  somon: 'salmon',
  ton: 'tuna',
  mantar: 'mushroom',
  salatalik: 'cucumber',
  limon: 'lemon',
  maydanoz: 'parsley',
  nane: 'mint',
  fasulye: 'beans',
  nohut: 'chickpeas',
  mercimek: 'lentils',
  ispanak: 'spinach',
  brokoli: 'broccoli',
  kabak: 'zucchini',
  patlican: 'eggplant',
  havuc: 'carrot',
  zeytinyagi: 'olive oil',
  egg: 'egg',
  sausage: 'sausage',
  bread: 'bread',
};

function normalizeLookupText(value: unknown) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0131/g, 'i')
    .replace(/\u0130/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function translateStaticRecipeSummary(summary: string | undefined, language: Language) {
  const normalizedSummary = normalizeLookupText(summary);
  if (!normalizedSummary) {
    return '';
  }

  for (const translations of Object.values(STATIC_RECIPE_SUMMARY_TRANSLATIONS)) {
    const matchesKnownSummary = Object.values(translations).some(
      (candidate) => normalizeLookupText(candidate) === normalizedSummary
    );
    if (matchesKnownSummary) {
      return translations[language];
    }
  }

  return String(summary || '').trim();
}

function splitFreeTextIngredients(ingredientsText: string) {
  const normalized = normalizeLookupText(ingredientsText);
  const words = normalized.split(' ').filter(Boolean);
  if (words.length < 2) {
    return [];
  }

  const knownTerms = new Set(
    [
      ...Object.keys(INGREDIENT_ALIASES),
      ...Object.values(INGREDIENT_ALIASES),
    ].map((value) => normalizeLookupText(value))
  );
  const items: string[] = [];
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

    items.push(words[index]);
    index += 1;
  }

  return knownCount >= 2 ? Array.from(new Set(items)) : [];
}

function splitIngredientInput(ingredientsText: string) {
  const delimiterItems = ingredientsText
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (delimiterItems.length > 1) {
    return delimiterItems;
  }
  const freeTextItems = splitFreeTextIngredients(ingredientsText);
  return freeTextItems.length ? freeTextItems : delimiterItems;
}

function cleanIngredientHint(value: string) {
  return normalizeLookupText(value)
    .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
    .replace(
      /\b(gr|g|kg|ml|lt|l|adet|tane|cup|cups|tbsp|tsp|tablespoon|teaspoon|kasik|bardak|dilim)\b/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function ingredientCandidates(value: string) {
  const cleaned = cleanIngredientHint(value);
  if (!cleaned) {
    return [];
  }
  const alias = INGREDIENT_ALIASES[cleaned];
  const words = cleaned.split(' ').filter((word) => word.length >= 3);
  return Array.from(new Set([cleaned, alias, ...words].filter(Boolean)));
}

function ingredientCoverageRatio(recipe: Recipe, ingredientsText: string) {
  const requested = splitIngredientInput(ingredientsText)
    .map(ingredientCandidates)
    .filter((candidates) => candidates.length);

  if (!requested.length) {
    return 1;
  }

  const recipeBlob = normalizeLookupText(
    [
      recipe.title,
      recipe.summary || '',
      ...(recipe.ingredients || []),
      ...(recipe.steps || []),
    ].join(' ')
  );

  const matched = requested.filter((candidates) =>
    candidates.some((candidate) => recipeBlob.includes(normalizeLookupText(candidate)))
  ).length;

  return matched / requested.length;
}

function requiredIngredientCoverage(ingredientsText: string) {
  const requestedCount = new Set(
    splitIngredientInput(ingredientsText)
      .map(cleanIngredientHint)
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

function recipeLooksAlignedWithIngredients(recipe: Recipe, ingredientsText: string) {
  const hasTitle = Boolean(recipe.title.trim());
  const hasIngredients = recipe.ingredients.length >= 3;
  const hasSteps = recipe.steps.length >= 3;
  const coverage = ingredientCoverageRatio(recipe, ingredientsText);
  return hasTitle && hasIngredients && hasSteps && coverage >= requiredIngredientCoverage(ingredientsText);
}

async function generatePublicRecipeOrFallback(
  ingredientsText: string,
  language: Language
): Promise<Recipe> {
  const recipe = await generateRecipeFromPublicWeb(ingredientsText, language);
  return recipeLooksAlignedWithIngredients(recipe, ingredientsText)
    ? recipe
    : fallbackRecipe(ingredientsText, language);
}

function localizedRecipeCopy(recipe: Recipe, language: Language): Recipe {
  return withRecipeYoutubeUrl(
    withRecipeMeta(
      normalizeRecipe({
        ...recipe,
        summary: translateStaticRecipeSummary(recipe.summary, language),
        locale: language,
      }),
      `${recipe.id}-${language}`
    ),
    language
  );
}

type ShadowSpec = {
  blur: number;
  elevation: number;
  opacity: number;
  x?: number;
  y: number;
};

function colorWithOpacity(color: string, opacity: number) {
  const value = color.trim();
  if (value.startsWith('#')) {
    const hex = value.slice(1);
    const expanded =
      hex.length === 3
        ? hex
            .split('')
            .map((char) => `${char}${char}`)
            .join('')
        : hex;

    if (expanded.length === 6) {
      const red = Number.parseInt(expanded.slice(0, 2), 16);
      const green = Number.parseInt(expanded.slice(2, 4), 16);
      const blue = Number.parseInt(expanded.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
    }
  }

  const rgbMatch = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => part.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
    }
  }

  return value;
}

function shadowStyle(color: string, spec: ShadowSpec): ViewStyle {
  const x = spec.x ?? 0;
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${x}px ${spec.y}px ${spec.blur}px ${colorWithOpacity(
        color,
        spec.opacity
      )}`,
    } as ViewStyle;
  }

  return {
    shadowColor: color,
    shadowOpacity: spec.opacity,
    shadowRadius: spec.blur,
    shadowOffset: { width: x, height: spec.y },
    elevation: spec.elevation,
  };
}

const BEZEL_SHADOW: ShadowSpec = {
  blur: 28,
  elevation: 14,
  opacity: 0.35,
  y: 18,
};
const DEPTH_BUBBLE_SHADOW: ShadowSpec = {
  blur: 24,
  elevation: 10,
  opacity: 0.3,
  y: 14,
};
const PROGRESS_CARD_SHADOW: ShadowSpec = {
  blur: 16,
  elevation: 4,
  opacity: 0.16,
  y: 10,
};
const SECTION_CARD_SHADOW: ShadowSpec = {
  blur: 16,
  elevation: 3,
  opacity: 0.1,
  y: 10,
};
const FEATURE_CARD_SHADOW: ShadowSpec = {
  blur: 14,
  elevation: 3,
  opacity: 0.1,
  y: 10,
};

function mixColor(from: number, to: number, ratio: number) {
  return Math.round(from + (to - from) * ratio);
}

function macroFillColor(progress: number, theme: ThemePalette) {
  const ratio = Math.max(0, Math.min(progress, 1));
  const start = theme.isDark
    ? { r: 90, g: 90, b: 90 }
    : { r: 204, g: 202, b: 194 };
  const end = theme.isDark
    ? { r: 255, g: 255, b: 255 }
    : { r: 17, g: 17, b: 17 };
  return `rgb(${mixColor(start.r, end.r, ratio)}, ${mixColor(
    start.g,
    end.g,
    ratio
  )}, ${mixColor(start.b, end.b, ratio)})`;
}

function regionLabel(region: BodyRegion, language: Language) {
  const text = textFor(language);
  return region === 'forearm'
    ? text.regionForearm
    : region === 'triceps'
      ? text.regionTriceps
      : region === 'legs'
        ? text.regionLegs
        : region === 'chest'
          ? text.regionChest
          : region === 'back'
            ? text.regionBack
            : region === 'shoulders'
              ? text.regionShoulders
              : text.regionCore;
}

function recipeSourceLabel(recipe: Recipe, language: Language) {
  return recipe.source === 'generated'
    ? textFor(language).generatedRecipe
    : textFor(language).recommendedRecipe;
}

function extractJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

function sanitizeYoutubeUrl(value: unknown) {
  const url = String(value || '').trim();
  if (!url) {
    return undefined;
  }
  if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
    return undefined;
  }
  return url.replace(/^http:\/\//i, 'https://');
}

function youtubeVideoId(value: unknown) {
  const url = sanitizeYoutubeUrl(value);
  if (!url) {
    return undefined;
  }
  const direct = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i)?.[1];
  const query = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/i)?.[1];
  const embed = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/i)?.[1];
  return direct || query || embed;
}

function recipeYoutubeSearchUrl(recipe: Pick<Recipe, 'title' | 'ingredients'>, language: Language) {
  const title = String(recipe.title || '').trim();
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients.slice(0, 6).join(' ')
    : '';
  const suffix =
    language === 'tr'
      ? 'yemek tarifi yapilisi'
      : language === 'de'
        ? 'rezept zubereitung'
        : language === 'es'
          ? 'receta paso a paso'
          : 'recipe step by step';
  const query = [title, ingredients, suffix]
    .filter(Boolean)
    .join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query || 'easy recipe step by step'
  )}`;
}

function recipeYoutubeUrl(recipe: Recipe, language: Language) {
  return recipeYoutubeSearchUrl(recipe, language);
}

function withRecipeYoutubeUrl(recipe: Recipe, language: Language): Recipe {
  return {
    ...recipe,
    youtubeUrl: recipeYoutubeUrl(recipe, language),
  };
}

function normalizeRecipe(recipe: Partial<Recipe> | null | undefined): Recipe {
  if (!recipe || typeof recipe !== 'object') {
    return {
      id: makeClientId('recipe'),
      title: '',
      ingredients: [],
      steps: [],
      source: 'generated',
      locale: 'tr',
      note: '',
    };
  }

  return {
    id: String(recipe.id || makeClientId('recipe')),
    title: String(recipe.title || '').trim(),
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients.map((item) => String(item).trim()).filter(Boolean)
      : [],
    steps: Array.isArray(recipe.steps)
      ? recipe.steps.map((item) => String(item).trim()).filter(Boolean)
      : [],
    imageUrl: recipe.imageUrl ? String(recipe.imageUrl) : undefined,
    youtubeUrl: sanitizeYoutubeUrl(recipe.youtubeUrl),
    sourceUrl: recipe.sourceUrl ? String(recipe.sourceUrl).trim() : undefined,
    cookTime: recipe.cookTime ? String(recipe.cookTime).trim() : '',
    calories: recipe.calories ? String(recipe.calories).trim() : '',
    summary: recipe.summary ? String(recipe.summary).trim() : '',
    nutrition: {
      protein: String(recipe.nutrition?.protein || '').trim(),
      fat: String(recipe.nutrition?.fat || '').trim(),
      carbs: String(recipe.nutrition?.carbs || '').trim(),
    },
    source: recipe.source === 'recommended' ? 'recommended' : 'generated',
    locale: normalizeLanguage(recipe.locale),
    note: recipe.note ? String(recipe.note).trim() : '',
    completedAt: recipe.completedAt ? String(recipe.completedAt) : undefined,
    savedAt: recipe.savedAt ? String(recipe.savedAt) : undefined,
  };
}

function isMotionStyle(value: unknown): value is MotionStyle {
  return typeof value === 'string' && MOTION_STYLES.includes(value as MotionStyle);
}

function normalizeWorkoutLookupText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u0131/g, 'i')
    .replace(/\u0130/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function workoutTextIncludes(lookupText: string, phrases: string[]) {
  return phrases.some((phrase) => lookupText.includes(phrase));
}

function workoutInstructionLanguage(
  exerciseText: string,
  instructions: string[]
): 'tr' | 'en' {
  const lookupText = normalizeWorkoutLookupText(
    `${exerciseText} ${instructions.join(' ')}`
  );
  return workoutTextIncludes(lookupText, [
    'bilek',
    'ters',
    'sandalye',
    'romen',
    'gogus',
    'sirt',
    'kalca',
    'karin',
    'baslangic',
    'hareketi',
    'kontrollu',
    'tekrar',
    'dinlen',
  ])
    ? 'tr'
    : 'en';
}

function workoutInstructionsAreGeneric(instructions: string[]) {
  if (!instructions.length) {
    return true;
  }

  const lookupText = normalizeWorkoutLookupText(instructions.join(' '));
  return (
    workoutTextIncludes(lookupText, [
      'baslangic pozisyonunu kur',
      'ana hareketi kontrollu uygula',
      'tepe noktada durup yavasca don',
      'set your start position',
      'move through the main action with control',
      'pause at the top and return slowly',
      'startposition aufbauen',
      'bewegung kontrolliert ausfuehren',
      'define la posicion inicial',
      'haz el movimiento con control',
    ]) || instructions.length < 2
  );
}

function workoutSummaryIsGeneric(summary: string) {
  if (!summary.trim()) {
    return true;
  }

  const lookupText = normalizeWorkoutLookupText(summary);
  return workoutTextIncludes(lookupText, [
    'bolgesini kontrollu guclendir',
    'build controlled',
    'guclendir',
    'calistir',
    'aktive et',
    'dengesini',
    'control',
    'strength',
    'endurance',
    'posterior chain',
  ]);
}

function workoutSpecificSummary(videoKey: WorkoutVideoKey, language: Language | 'en') {
  const tr = language === 'tr';
  const summaries: Record<WorkoutVideoKey, { tr: string; en: string }> = {
    curl: {
      tr: 'Dirsegi sabit tutup agirligi omuza dogru bukerek biceps kasini calistir.',
      en: 'Keep the elbow still and curl the weight toward the shoulder.',
    },
    press: {
      tr: 'Vucudu tek cizgide tutup avuclardan iterek kontrollu push-up yap.',
      en: 'Keep one body line and press through the palms for a controlled push-up.',
    },
    hinge: {
      tr: 'Kalcalari geriye itip sirti duz tutarak kalca menteşe hareketini yap.',
      en: 'Push the hips back with a flat back to perform the hip hinge.',
    },
    squat: {
      tr: 'Gogsu dik tutup kalcayi geriye alarak kontrollu squat yap.',
      en: 'Keep the chest tall, send the hips back, and squat with control.',
    },
    pull: {
      tr: 'Dirsekleri geriye cekip kurek kemiklerini yaklastirarak sirt cekisi yap.',
      en: 'Pull the elbows back and squeeze the shoulder blades for a back pull.',
    },
    twist: {
      tr: 'Karni sikarak govdeyi sag ve sola kontrollu cevir.',
      en: 'Brace the core and rotate the torso side to side with control.',
    },
    plank: {
      tr: 'Dirsekleri omuz altinda tutup vucudu tek cizgide sabitle.',
      en: 'Keep elbows under shoulders and hold the body in one straight line.',
    },
    wristCurl: {
      tr: 'On kol sabitken bilegi bukup agirligi yukari yuvarla.',
      en: 'Keep the forearm still and curl the wrist upward.',
    },
    reverseWristCurl: {
      tr: 'Avuc ici asagi bakarken el sirtini yukari kaldir.',
      en: 'With the palm facing down, lift the back of the hand upward.',
    },
    chairDips: {
      tr: 'Eller sandalyede, dirsekleri geriye kirarak arka kol dips yap.',
      en: 'Place hands on a chair and bend the elbows back for a triceps dip.',
    },
    tricepsExtension: {
      tr: 'Dirsekleri sabit tutup agirligi enseye indirerek arka kolu uzat.',
      en: 'Keep elbows still, lower the weight behind the head, then extend.',
    },
    gobletSquat: {
      tr: 'Agirligi gogse yakin tutup kalcayi geriye alarak cok ve kalk.',
      en: 'Hold the weight close to the chest, sit back, then stand tall.',
    },
    romanianDeadlift: {
      tr: 'Dizleri hafif kirip kalcadan egilerek arka bacaklari calistir.',
      en: 'Soften the knees and hinge at the hips to train the hamstrings.',
    },
    pushUp: {
      tr: 'Vucut tek cizgideyken gogsu yere indirip avuclardan iterek kalk.',
      en: 'Hold one body line, lower the chest, then press back up.',
    },
    floorPress: {
      tr: 'Sirt ustu yatip dirsekleri yere indirerek gogus presi yap.',
      en: 'Lie on your back, lower elbows to the floor, then press up.',
    },
    bentOverRow: {
      tr: 'Kalçadan egil, dirsekleri kalcaya cekerek sirt kaslarini sik.',
      en: 'Hinge forward and pull the elbows toward the hips.',
    },
    superman: {
      tr: 'Yuzustu pozisyonda gogus ve bacaklari hafifce kaldirip tut.',
      en: 'Lie face down and gently lift the chest and legs.',
    },
    overheadPress: {
      tr: 'Agirliklari omuzdan bas ustune kontrollu sekilde it.',
      en: 'Press the weights from shoulder level to overhead with control.',
    },
    lateralRaise: {
      tr: 'Dirsekler hafif kirik, kollari yana omuz hizasina kaldir.',
      en: 'With soft elbows, raise the arms out to shoulder height.',
    },
    deadBug: {
      tr: 'Bel yere sabitken zit kol ve bacagi kontrollu uzat.',
      en: 'Keep the low back down while extending opposite arm and leg.',
    },
    forearmPlank: {
      tr: 'On kollarda destek alıp karni sikarak vucudu sabit tut.',
      en: 'Support on the forearms and brace the core to hold steady.',
    },
    russianTwist: {
      tr: 'Oturup govdeyi hafif geriye al, karni sikarak sag-sol don.',
      en: 'Sit back slightly and rotate side to side with a braced core.',
    },
    pullUp: {
      tr: 'Bardan tutunup dirsekleri asagi cekerek gogsu bara yaklastir.',
      en: 'Hang from the bar and pull elbows down to bring the chest up.',
    },
  };

  return tr ? summaries[videoKey].tr : summaries[videoKey].en;
}

function workoutSpecificInstructions(
  videoKey: WorkoutVideoKey,
  language: Language | 'en'
) {
  const tr = language === 'tr';
  const instructions: Record<WorkoutVideoKey, { tr: string[]; en: string[] }> = {
    curl: {
      tr: [
        'Dirsegi govdeye yakin ve sabit tut.',
        'Agirligi omuza dogru bukerken bilegi duz tut.',
        'Tepe noktada kisa durup yavasca indir.',
      ],
      en: [
        'Keep the elbow close to the body and still.',
        'Curl the weight toward the shoulder with a straight wrist.',
        'Pause briefly at the top, then lower slowly.',
      ],
    },
    press: {
      tr: [
        'Eller omuz hizasinda, vucut bas-topuk tek cizgi olsun.',
        'Dirsekleri 45 dereceyle kirip gogsunu yere yaklastir.',
        'Karni sikarak avuclardan it ve baslangica don.',
      ],
      en: [
        'Set hands under the shoulders and keep head-to-heel alignment.',
        'Bend elbows around 45 degrees and lower the chest.',
        'Brace the core, press through the palms, and return.',
      ],
    },
    hinge: {
      tr: [
        'Ayaklari kalca genisliginde tut, dizleri hafif kir.',
        'Kalcalari geriye iterek govdeyi one eg.',
        'Sirt duz kalirken kalcayi one alıp dikles.',
      ],
      en: [
        'Stand hip-width with soft knees.',
        'Push the hips back as the torso tips forward.',
        'Keep the back flat and drive the hips forward to stand.',
      ],
    },
    squat: {
      tr: [
        'Ayaklari omuz genisliginde ac ve gogsu dik tut.',
        'Kalcalari geriye gonderip dizleri ayak yonunde buk.',
        'Topuklardan iterek kalk, dizleri ice dusurme.',
      ],
      en: [
        'Stand shoulder-width and keep the chest tall.',
        'Send hips back and bend knees in line with the feet.',
        'Press through the heels to stand without knees caving in.',
      ],
    },
    pull: {
      tr: [
        'Kalçadan egil, sirt duz ve karni sikili tut.',
        'Dirsekleri kalcaya dogru cek, kurek kemiklerini yaklastir.',
        'Agirligi yavasca indir, belini yuvarlama.',
      ],
      en: [
        'Hinge forward with a flat back and braced core.',
        'Pull elbows toward the hips and squeeze shoulder blades.',
        'Lower slowly without rounding the low back.',
      ],
    },
    twist: {
      tr: [
        'Otur, govdeyi hafif geriye al ve karni sik.',
        'Gogsu uzun tutarak govdeyi sag-sol cevir.',
        'Belden savurma yapmadan kontrollu tekrar et.',
      ],
      en: [
        'Sit tall, lean back slightly, and brace the core.',
        'Rotate the torso side to side with the chest lifted.',
        'Move under control without swinging from the low back.',
      ],
    },
    plank: {
      tr: [
        'Dirsekleri omuz altina koy ve ayak ucuna yuksel.',
        'Bas, kalca ve topuklari tek cizgide tut.',
        'Karni ve kalcayi sik, kalcanin dusmesine izin verme.',
      ],
      en: [
        'Place elbows under shoulders and rise onto the toes.',
        'Keep head, hips, and heels in one line.',
        'Brace abs and glutes so the hips do not drop.',
      ],
    },
    wristCurl: {
      tr: [
        'On kolu diz veya sehpa uzerine sabitle, avuc ici yukari baksin.',
        'Sadece bilekten bukerek agirligi yukari yuvarla.',
        'Bilegi yavasca asagi indir, on kolu oynatma.',
      ],
      en: [
        'Rest the forearm on a knee or bench with palm facing up.',
        'Curl only from the wrist to roll the weight upward.',
        'Lower the wrist slowly without moving the forearm.',
      ],
    },
    reverseWristCurl: {
      tr: [
        'On kolu sabitle, avuc ici yere baksin.',
        'El sirtini tavana dogru kaldir.',
        'Kontrollu indir, bilegi savurma.',
      ],
      en: [
        'Anchor the forearm with the palm facing down.',
        'Lift the back of the hand toward the ceiling.',
        'Lower with control without swinging the wrist.',
      ],
    },
    chairDips: {
      tr: [
        'Eller sandalyede omuz genisliginde, kalca sandalyeye yakin olsun.',
        'Dirsekleri geriye kirarak govdeyi asagi indir.',
        'Avuclardan itip dirsekleri kilitlemeden yukari don.',
      ],
      en: [
        'Place hands shoulder-width on the chair with hips close to it.',
        'Bend elbows backward and lower the body.',
        'Press through the palms and return without locking elbows hard.',
      ],
    },
    tricepsExtension: {
      tr: [
        'Agirligi iki elle bas ustunde tut, dirsekler ileri baksin.',
        'Dirsekleri sabit tutup agirligi enseye dogru indir.',
        'Arka kolu sikarak kollari tekrar yukari uzat.',
      ],
      en: [
        'Hold the weight overhead with elbows pointing forward.',
        'Keep elbows still and lower the weight behind the head.',
        'Squeeze the triceps to extend the arms overhead again.',
      ],
    },
    gobletSquat: {
      tr: [
        'Agirligi gogse yakin tut, ayaklar omuz genisliginde olsun.',
        'Kalcalari geriye gonderip dizleri ayak yonunde buk.',
        'Topuklardan itip gogsu dik tutarak kalk.',
      ],
      en: [
        'Hold the weight close to the chest with feet shoulder-width.',
        'Send hips back and bend knees in line with the feet.',
        'Drive through the heels and stand with the chest tall.',
      ],
    },
    romanianDeadlift: {
      tr: [
        'Ayaklari kalca genisliginde tut, dizleri hafif kir.',
        'Kalcalari geriye iterek agirligi bacak boyunca indir.',
        'Arka bacak gerilince kalcayi one alıp dikles.',
      ],
      en: [
        'Stand hip-width with a slight knee bend.',
        'Push hips back and lower the weight along the legs.',
        'When hamstrings stretch, drive hips forward to stand.',
      ],
    },
    pushUp: {
      tr: [
        'Eller omuz hizasinda, vucut bas-topuk tek cizgi olsun.',
        'Dirsekleri 45 dereceyle kirip gogsunu yere indir.',
        'Karni sik, avuclardan iterek baslangica don.',
      ],
      en: [
        'Set hands under shoulders and keep head-to-heel alignment.',
        'Bend elbows around 45 degrees and lower the chest.',
        'Brace the core and press through the palms to return.',
      ],
    },
    floorPress: {
      tr: [
        'Sirt ustu yat, dizleri kir ve agirliklari gogus hizasinda tut.',
        'Dirsekler yere kontrollu degene kadar agirliklari indir.',
        'Gogsu sikarak yukari it, omuzlari yerden koparma.',
      ],
      en: [
        'Lie on your back with knees bent and weights at chest level.',
        'Lower until elbows lightly touch the floor.',
        'Press up through the chest without lifting shoulders off the floor.',
      ],
    },
    bentOverRow: {
      tr: [
        'Kalçadan egil, sirt duz ve agirliklar omuz altinda olsun.',
        'Dirsekleri kalcaya dogru cek, kurek kemiklerini yaklastir.',
        'Agirliklari yavasca indir, belini yuvarlama.',
      ],
      en: [
        'Hinge forward with a flat back and weights under shoulders.',
        'Pull elbows toward the hips and squeeze shoulder blades.',
        'Lower the weights slowly without rounding the back.',
      ],
    },
    superman: {
      tr: [
        'Yuzustu uzan, kollar ileri ve boyun rahat olsun.',
        'Gogus ve bacaklari ayni anda hafifce kaldir.',
        'Belini sıkistirmadan kisa tutup kontrollu indir.',
      ],
      en: [
        'Lie face down with arms forward and neck relaxed.',
        'Lift chest and legs slightly at the same time.',
        'Hold briefly, then lower without pinching the low back.',
      ],
    },
    overheadPress: {
      tr: [
        'Agirliklari omuz hizasinda tut, karni sik.',
        'Dirsekleri hafif onde tutarak agirliklari yukari it.',
        'Bas ustunde kontrol et, sonra omuza yavasca indir.',
      ],
      en: [
        'Hold weights at shoulder level and brace the core.',
        'Keep elbows slightly forward and press overhead.',
        'Control at the top, then lower slowly to the shoulders.',
      ],
    },
    lateralRaise: {
      tr: [
        'Agirliklar yanda, dirsekler hafif kirik olsun.',
        'Kollari omuz hizasina kadar yana kaldir.',
        'Omuzlari kulaga cekmeden yavasca indir.',
      ],
      en: [
        'Hold weights by the sides with soft elbows.',
        'Raise arms out to shoulder height.',
        'Lower slowly without shrugging the shoulders.',
      ],
    },
    deadBug: {
      tr: [
        'Sirt ustu yat, bel boslugunu yere bastir.',
        'Zit kol ve bacagi yavasca uzat.',
        'Bel kalkmadan merkeze don ve taraf degistir.',
      ],
      en: [
        'Lie on your back and press the low back into the floor.',
        'Slowly extend the opposite arm and leg.',
        'Return without the back lifting, then switch sides.',
      ],
    },
    forearmPlank: {
      tr: [
        'Dirsekleri omuz altina koy, ayak ucuna yuksel.',
        'Bas, kalca ve topuklari tek cizgide tut.',
        'Karni ve kalcayi sik, kalcanin dusmesine izin verme.',
      ],
      en: [
        'Place elbows under shoulders and rise onto the toes.',
        'Keep head, hips, and heels aligned.',
        'Brace abs and glutes so the hips do not drop.',
      ],
    },
    russianTwist: {
      tr: [
        'Otur, govdeyi hafif geriye al ve karni sik.',
        'Gogsu uzun tutarak govdeyi sag-sol cevir.',
        'Hareketi belden savurmadan kontrollu yap.',
      ],
      en: [
        'Sit down, lean back slightly, and brace the core.',
        'Keep the chest long and rotate side to side.',
        'Move with control instead of swinging from the low back.',
      ],
    },
    pullUp: {
      tr: [
        'Bari omuzdan biraz genis tut, omuzlari kulaktan uzaklastir.',
        'Dirsekleri asagi cekerek gogsu bara yaklastir.',
        'Sallanma yapmadan kontrollu sekilde asagi in.',
      ],
      en: [
        'Grip the bar slightly wider than shoulders and set shoulders down.',
        'Pull elbows down to bring the chest toward the bar.',
        'Lower under control without swinging.',
      ],
    },
  };

  return tr ? instructions[videoKey].tr : instructions[videoKey].en;
}

function fallbackVideoKeyForMotionStyle(
  motionStyle: MotionStyle,
  region: BodyRegion
): WorkoutVideoKey {
  if (motionStyle === 'curl') {
    return region === 'forearm' ? 'wristCurl' : 'curl';
  }
  if (motionStyle === 'press') {
    if (region === 'shoulders') {
      return 'overheadPress';
    }
    if (region === 'triceps') {
      return 'chairDips';
    }
    if (region === 'chest') {
      return 'pushUp';
    }
    if (region === 'back') {
      return 'bentOverRow';
    }
    if (region === 'legs') {
      return 'gobletSquat';
    }
    if (region === 'core') {
      return 'forearmPlank';
    }
    return 'press';
  }
  if (motionStyle === 'hinge') {
    return 'romanianDeadlift';
  }
  if (motionStyle === 'squat') {
    return 'gobletSquat';
  }
  if (motionStyle === 'pull') {
    if (region === 'back') {
      return 'bentOverRow';
    }
    if (region === 'forearm') {
      return 'reverseWristCurl';
    }
    return 'pullUp';
  }
  if (motionStyle === 'twist') {
    return 'russianTwist';
  }
  return 'forearmPlank';
}

function resolveWorkoutVideoKey(exercise: {
  name?: string;
  region?: BodyRegion;
  summary?: string;
  animationCue?: string;
  motionStyle?: MotionStyle;
}): WorkoutVideoKey {
  const region = exercise.region || 'chest';
  const lookupText = normalizeWorkoutLookupText(
    [
      exercise.name || '',
      exercise.summary || '',
      exercise.animationCue || '',
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
    return 'reverseWristCurl';
  }
  if (workoutTextIncludes(lookupText, ['wrist curl', 'bilek curl'])) {
    return 'wristCurl';
  }
  if (
    workoutTextIncludes(lookupText, [
      'chair dip',
      'bench dip',
      'tricep dip',
      'triceps dip',
      'sandalye dips',
      'dips',
    ])
  ) {
    return 'chairDips';
  }
  if (
    workoutTextIncludes(lookupText, [
      'triceps extension',
      'tricep extension',
      'french press',
    ])
  ) {
    return 'tricepsExtension';
  }
  if (workoutTextIncludes(lookupText, ['goblet squat'])) {
    return 'gobletSquat';
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
    return 'romanianDeadlift';
  }
  if (workoutTextIncludes(lookupText, ['push up', 'pushup', 'sinav'])) {
    return 'pushUp';
  }
  if (workoutTextIncludes(lookupText, ['floor press'])) {
    return 'floorPress';
  }
  if (
    workoutTextIncludes(lookupText, [
      'bent over row',
      'bentover row',
      'barbell row',
      'dumbbell row',
      'row',
    ])
  ) {
    return 'bentOverRow';
  }
  if (workoutTextIncludes(lookupText, ['superman'])) {
    return 'superman';
  }
  if (
    workoutTextIncludes(lookupText, [
      'overhead press',
      'shoulder press',
      'military press',
    ])
  ) {
    return 'overheadPress';
  }
  if (
    workoutTextIncludes(lookupText, [
      'lateral raise',
      'side raise',
      'bent arm lateral',
      'laterals',
      'yana',
    ])
  ) {
    return 'lateralRaise';
  }
  if (workoutTextIncludes(lookupText, ['dead bug', 'deadbug'])) {
    return 'deadBug';
  }
  if (workoutTextIncludes(lookupText, ['russian twist', 'twist'])) {
    return 'russianTwist';
  }
  if (workoutTextIncludes(lookupText, ['pull up', 'pullup', 'barfiks'])) {
    return 'pullUp';
  }
  if (workoutTextIncludes(lookupText, ['plank'])) {
    return 'forearmPlank';
  }
  if (workoutTextIncludes(lookupText, ['squat', 'cok'])) {
    return 'gobletSquat';
  }
  if (workoutTextIncludes(lookupText, ['curl'])) {
    return region === 'forearm' ? 'wristCurl' : 'curl';
  }

  return fallbackVideoKeyForMotionStyle(exercise.motionStyle || 'press', region);
}

function motionStyleForVideoKey(videoKey: WorkoutVideoKey): MotionStyle {
  if (
    videoKey === 'curl' ||
    videoKey === 'wristCurl' ||
    videoKey === 'reverseWristCurl'
  ) {
    return 'curl';
  }
  if (
    videoKey === 'press' ||
    videoKey === 'chairDips' ||
    videoKey === 'tricepsExtension' ||
    videoKey === 'pushUp' ||
    videoKey === 'floorPress' ||
    videoKey === 'overheadPress' ||
    videoKey === 'lateralRaise'
  ) {
    return 'press';
  }
  if (videoKey === 'hinge' || videoKey === 'romanianDeadlift') {
    return 'hinge';
  }
  if (videoKey === 'squat' || videoKey === 'gobletSquat') {
    return 'squat';
  }
  if (videoKey === 'pull' || videoKey === 'bentOverRow' || videoKey === 'pullUp') {
    return 'pull';
  }
  if (videoKey === 'twist' || videoKey === 'russianTwist' || videoKey === 'deadBug') {
    return 'twist';
  }
  return 'plank';
}

function resolveWorkoutVideo(exercise: {
  name?: string;
  region?: BodyRegion;
  summary?: string;
  animationCue?: string;
  motionStyle?: MotionStyle;
  youtubeUrl?: string;
}) {
  const customId = youtubeVideoId(exercise.youtubeUrl);
  if (customId) {
    return {
      title: exercise.name || 'Exercise video',
      videoId: customId,
      thumbnail: workoutThumbnail(customId),
      watchUrl: sanitizeYoutubeUrl(exercise.youtubeUrl),
    };
  }
  return WORKOUT_VIDEOS[resolveWorkoutVideoKey(exercise)];
}

function resolveWorkoutMotionStyle(exercise: {
  name?: string;
  region?: BodyRegion;
  summary?: string;
  animationCue?: string;
  motionStyle?: MotionStyle;
}) {
  return motionStyleForVideoKey(resolveWorkoutVideoKey(exercise));
}

function workoutVideoForMotionStyle(motionStyle: MotionStyle) {
  return WORKOUT_VIDEOS[fallbackVideoKeyForMotionStyle(motionStyle, 'chest')];
}

function workoutVideoEmbedUrl(video: WorkoutVideo) {
  const params = ['playsinline=1', 'rel=0', 'modestbranding=1'];
  if (typeof video.startSeconds === 'number') {
    params.push(`start=${video.startSeconds}`);
  }
  if (typeof video.endSeconds === 'number') {
    params.push(`end=${video.endSeconds}`);
  }
  return `https://www.youtube-nocookie.com/embed/${video.videoId}?${params.join('&')}`;
}

function workoutVideoWatchUrl(video: WorkoutVideo) {
  if (video.watchUrl) {
    return video.watchUrl;
  }
  const timeParam =
    typeof video.startSeconds === 'number' ? `&t=${video.startSeconds}s` : '';
  return `https://www.youtube.com/watch?v=${video.videoId}${timeParam}`;
}

function normalizeExercise(exercise: Partial<Exercise> | null | undefined): Exercise {
  const name = String(exercise?.name || '').trim();
  const region =
    exercise?.region &&
    BODY_REGIONS.includes(exercise.region as BodyRegion)
      ? (exercise.region as BodyRegion)
      : 'chest';
  const summary = String(exercise?.summary || '').trim();
  const animationCue = String(exercise?.animationCue || '').trim();
  const incomingMotionStyle = isMotionStyle(exercise?.motionStyle)
    ? exercise.motionStyle
    : 'press';
  const rawInstructions = Array.isArray(exercise?.instructions)
    ? exercise.instructions
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
  const videoKey = resolveWorkoutVideoKey({
    name,
    region,
    summary,
    animationCue,
    motionStyle: incomingMotionStyle,
  });
  const motionStyle = motionStyleForVideoKey(videoKey);
  const instructionLanguage = workoutInstructionLanguage(
    `${name} ${summary} ${animationCue}`,
    rawInstructions
  );
  const finalSummary = workoutSummaryIsGeneric(summary)
    ? workoutSpecificSummary(videoKey, instructionLanguage)
    : summary;
  const finalInstructions = workoutInstructionsAreGeneric(rawInstructions)
    ? workoutSpecificInstructions(videoKey, instructionLanguage)
    : rawInstructions;

  return {
    id: String(exercise?.id || `exercise-${Date.now()}-${Math.random()}`),
    name,
    region,
    sets: String(exercise?.sets || '').trim(),
    reps: String(exercise?.reps || '').trim(),
    rest: String(exercise?.rest || '').trim(),
    summary: finalSummary,
    instructions: finalInstructions,
    animationCue,
    motionStyle,
    youtubeUrl: sanitizeYoutubeUrl(exercise?.youtubeUrl),
    sourceUrl: exercise?.sourceUrl ? String(exercise.sourceUrl).trim() : undefined,
  };
}

function normalizeWorkoutPlan(
  plan: Partial<WorkoutPlan> | null | undefined,
  fallbackDuration: PlanDuration = 'weekly'
): WorkoutPlan {
  const duration =
    plan?.duration === 'daily' ||
    plan?.duration === 'weekly' ||
    plan?.duration === 'monthly'
      ? plan.duration
      : fallbackDuration;

  return {
    id: String(plan?.id || `plan-${Date.now()}`),
    title: String(plan?.title || '').trim(),
    summary: String(plan?.summary || '').trim(),
    duration,
    regions: Array.isArray(plan?.regions)
      ? plan.regions.filter((region) =>
          BODY_REGIONS.includes(region as BodyRegion)
        ) as BodyRegion[]
      : [],
    createdAt: String(plan?.createdAt || new Date().toISOString()),
    days: Array.isArray(plan?.days)
      ? plan.days
          .map((day) => ({
            id: String(day?.id || `day-${Date.now()}-${Math.random()}`),
            title: String(day?.title || '').trim(),
            focus: String(day?.focus || '').trim(),
            exercises: Array.isArray(day?.exercises)
              ? day.exercises
                  .map((exercise) => normalizeExercise(exercise))
                  .filter((exercise) => exercise.name)
              : [],
          }))
          .filter((day) => day.title && day.exercises.length)
      : [],
  };
}

function fallbackRecipe(ingredientsText: string, language: Language): Recipe {
  const fallbackCopy: Record<
    Language,
    {
      defaultIngredients: string[];
      pantry: string[];
      title: (name: string) => string;
      summary: (name: string) => string;
      prepare: (items: string) => string;
      heat: string;
      start: (item: string) => string;
      combine: (items: string) => string;
      safeCue: string;
      finish: string;
    }
  > = {
    tr: {
      defaultIngredients: ['2 domates', '1 sogan', '1 yesil biber'],
      pantry: ['1 yemek kasigi zeytinyagi', '1 tutam tuz', '1 tutam karabiber'],
      title: (name) => `${name} ile Pratik Tava`,
      summary: (name) =>
        `${name} malzemelerini merkeze alan, adimlari birbirine bagli pratik bir tarif.`,
      prepare: (items) => `${items} malzemelerini yika, temizle ve esit boyutta dogra.`,
      heat: 'Tavayi orta ateste isit, zeytinyagini ekle ve kokusu cikana kadar 30 saniye bekle.',
      start: (item) =>
        `Once ${item} ekle; orta ateste 3-4 dakika karistirarak hafif renk aldir.`,
      combine: (items) =>
        `Kalan malzemeleri (${items}) ekle; kapagi yarim kapatip 8-12 dakika pisir ve arada karistir.`,
      safeCue:
        'Tavuk, et, balik veya yumurta kullandiysan ic kismi cig kalmayana, rengi donene ve suyu berraklasana kadar pisirmeye devam et.',
      finish:
        'Tuz ve karabiberle tatlandir, kivam yogunlasinca ocaktan al ve 2 dakika dinlendir.',
    },
    en: {
      defaultIngredients: ['2 tomatoes', '1 onion', '1 green pepper'],
      pantry: ['1 tbsp olive oil', '1 pinch salt', '1 pinch black pepper'],
      title: (name) => `Quick Skillet with ${name}`,
      summary: (name) =>
        `A practical recipe built around ${name}, with ingredients and steps kept aligned.`,
      prepare: (items) => `Wash, trim, and cut ${items} into even pieces.`,
      heat:
        'Warm a skillet over medium heat, add olive oil, and let it shimmer for 30 seconds.',
      start: (item) =>
        `Add ${item} first; cook for 3-4 minutes over medium heat until lightly colored.`,
      combine: (items) =>
        `Add the remaining ingredients (${items}); cook partly covered for 8-12 minutes, stirring occasionally.`,
      safeCue:
        'If using chicken, meat, fish, or eggs, keep cooking until the center is no longer raw and the juices run clear.',
      finish:
        'Season with salt and pepper, remove from heat when the texture thickens, and rest for 2 minutes.',
    },
    de: {
      defaultIngredients: ['2 Tomaten', '1 Zwiebel', '1 grune Paprika'],
      pantry: ['1 EL Olivenol', '1 Prise Salz', '1 Prise schwarzer Pfeffer'],
      title: (name) => `Schnelle Pfanne mit ${name}`,
      summary: (name) =>
        `Ein praktisches Rezept rund um ${name}, bei dem Zutaten und Schritte zusammenpassen.`,
      prepare: (items) => `${items} waschen, putzen und in gleich grosse Stucke schneiden.`,
      heat:
        'Eine Pfanne bei mittlerer Hitze erwarmen, Olivenol zugeben und 30 Sekunden heiss werden lassen.',
      start: (item) =>
        `${item} zuerst zugeben und 3-4 Minuten bei mittlerer Hitze leicht Farbe nehmen lassen.`,
      combine: (items) =>
        `Die restlichen Zutaten (${items}) zugeben, halb abgedeckt 8-12 Minuten garen und gelegentlich ruhren.`,
      safeCue:
        'Bei Huhn, Fleisch, Fisch oder Ei weitergaren, bis die Mitte nicht mehr roh ist und der Saft klar austritt.',
      finish:
        'Mit Salz und Pfeffer abschmecken, vom Herd nehmen wenn die Konsistenz dichter wird, dann 2 Minuten ruhen lassen.',
    },
    es: {
      defaultIngredients: ['2 tomates', '1 cebolla', '1 pimiento verde'],
      pantry: ['1 cda de aceite de oliva', '1 pizca de sal', '1 pizca de pimienta negra'],
      title: (name) => `Sarten rapido con ${name}`,
      summary: (name) =>
        `Una receta practica basada en ${name}, con ingredientes y pasos coherentes.`,
      prepare: (items) => `Lava, limpia y corta ${items} en piezas similares.`,
      heat:
        'Calienta una sarten a fuego medio, agrega aceite de oliva y espera 30 segundos.',
      start: (item) =>
        `Agrega primero ${item}; cocina 3-4 minutos a fuego medio hasta que tome color suave.`,
      combine: (items) =>
        `Agrega el resto (${items}); cocina semi tapado 8-12 minutos y remueve de vez en cuando.`,
      safeCue:
        'Si usas pollo, carne, pescado o huevo, cocina hasta que el centro no este crudo y los jugos salgan claros.',
      finish:
        'Ajusta sal y pimienta, retira cuando la textura espese y deja reposar 2 minutos.',
    },
  };
  const copy = fallbackCopy[language];
  const items = splitIngredientInput(ingredientsText).slice(0, 8);
  const mainItems = items.length ? items : copy.defaultIngredients;
  const mainName = mainItems.slice(0, 3).join(', ');
  const remainingItems = mainItems.slice(1).join(', ') || mainItems[0];
  const hasSafetySensitiveIngredient = mainItems.some((item) =>
    /\b(chicken|tavuk|beef|dana|kiyma|meat|et|fish|balik|salmon|somon|tuna|ton|egg|yumurta)\b/i.test(
      normalizeLookupText(item)
    )
  );
  const recipe = normalizeRecipe({
    id: makeClientId('fallback'),
    title: copy.title(mainName),
    ingredients: [...mainItems, ...copy.pantry],
    steps: [
      copy.prepare(mainItems.join(', ')),
      copy.heat,
      copy.start(mainItems[0]),
      copy.combine(remainingItems),
      ...(hasSafetySensitiveIngredient ? [copy.safeCue] : []),
      copy.finish,
    ],
    summary: copy.summary(mainName),
    source: 'generated',
    locale: language,
  });
  return withRecipeYoutubeUrl(
    withRecipeMeta(recipe, `${language}-${ingredientsText || 'fallback'}`),
    language
  );
}

function fallbackAppAnswer(question: string, language: Language) {
  const text = textFor(language);
  const normalized = question.toLowerCase();

  if (
    normalized.includes('besin') ||
    normalized.includes('nutrition') ||
    normalized.includes('macro') ||
    normalized.includes('kalori') ||
    normalized.includes('protein') ||
    normalized.includes('reset') ||
    normalized.includes('yenilen')
  ) {
    return language === 'tr'
      ? 'Gunluk Besin Takibi 24 saatte bir yeni gune gecer. Onceki gunlerin toplam ve tarif kayitlari kullanici hesabinda saklanir; ana ekrandaki Gecmis butonundan acilir.'
      : 'Daily Nutrition Tracker starts a fresh day every 24 hours. Previous totals and completed recipes are stored per user and open from the History button on the home card.';
  }

  if (
    normalized.includes('tarif') ||
    normalized.includes('malzeme') ||
    normalized.includes('yemek') ||
    normalized.includes('recipe') ||
    normalized.includes('ingredient')
  ) {
    return language === 'tr'
      ? 'Akilli Mutfak ekraninda malzemeleri virgulle veya satir satir yazip "Tarif ara" butonuna bas. Uygulama yemek siteleri ve YouTube uzerinden uygun tarif arar; sonuc zayifsa malzemelere uygun guvenli bir yedek tarif gosterir.'
      : 'Open Smart Kitchen, enter ingredients separated by commas or lines, then tap "Find recipe". The app searches cooking sites and YouTube; if the result is weak, it shows a safe ingredient-aligned fallback recipe.';
  }

  if (
    normalized.includes('arama') ||
    normalized.includes('kaynak') ||
    normalized.includes('internet') ||
    normalized.includes('web') ||
    normalized.includes('cache') ||
    normalized.includes('mobile') ||
    normalized.includes('mobil')
  ) {
    return language === 'tr'
      ? 'Tarif ve spor akisi web kaynaklarini tarar, uygun bilgiyi toparlar ve tekrarlanan sonuclari sunucudaki yerel cacheten getirir.'
      : 'The recipe and sports flows search web sources, organize the matching information, and reuse repeated results from the local server cache.';
  }

  if (
    normalized.includes('tema') ||
    normalized.includes('theme') ||
    normalized.includes('siyah') ||
    normalized.includes('beyaz') ||
    normalized.includes('black') ||
    normalized.includes('white')
  ) {
    return language === 'tr'
      ? 'Tema kisminda artik siyah derinlik ve beyaz derinlik secenekleri var. Her iki secenekte de arka planda katmanli bir derinlik, yumusak isik alanlari ve daha canli kart yuzeyleri kullaniliyor.'
      : 'The theme area now has black-depth and white-depth options. Both add layered background depth, soft light surfaces, and stronger card contrast.';
  }

  if (
    normalized.includes('gif') ||
    normalized.includes('video') ||
    normalized.includes('youtube') ||
    normalized.includes('spor') ||
    normalized.includes('workout') ||
    normalized.includes('exercise')
  ) {
    return language === 'tr'
      ? 'Spor plan detayinda yerel GIF yerine YouTube egzersiz videosu gosterilir. Webde iframe, mobilde WebView ile ayni kart icinde acilir.'
      : 'Workout plan details now show YouTube exercise videos instead of local GIFs. Web uses an iframe and mobile uses WebView in the same card layout.';
  }

  if (
    normalized.includes('favori') ||
    normalized.includes('gecmis') ||
    normalized.includes('favorite') ||
    normalized.includes('history')
  ) {
    return language === 'tr'
      ? 'Favori tarifler ve gecmis tarifler kisminda gorsel kolaj geri getirildi. Kartlari actiginda detay, paylasim ve not alanlari da korunuyor.'
      : 'The favorites and history areas now bring back a visual collage layout. Opening them still keeps detail, sharing, and note actions.';
  }

  if (
    normalized.includes('kurul') ||
    normalized.includes('yapan') ||
    normalized.includes('kim') ||
    normalized.includes('built') ||
    normalized.includes('created')
  ) {
    return language === 'tr'
      ? `Bu uygulamanin kurulum tarihi ${createdAtLabel(language)} olarak gosteriliyor ve yapan kisi ${APP_AUTHOR} olarak Hakkinda alanina eklendi.`
      : `This app shows ${createdAtLabel(language)} as its creation date and lists ${APP_AUTHOR} in the About area.`;
  }

  return text.appOnlyAnswer;
}

function serverBaseUrl() {
  const configured =
    process.env.EXPO_PUBLIC_APP_SERVER_URL?.trim() ||
    expoExtraValue('EXPO_PUBLIC_APP_SERVER_URL') ||
    expoExtraValue('APP_PUBLIC_SERVER_URL');
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  const expoGoHost =
    (
      Constants as unknown as {
        expoGoConfig?: { debuggerHost?: string };
      }
    ).expoGoConfig?.debuggerHost || Constants.expoConfig?.hostUri;

  return expoGoHost ? `http://${expoGoHost.split(':')[0]}:3001` : null;
}

const isGenericRecipeImageUri = (uri?: string) =>
  /source\.unsplash\.com|photo-1546069901-ba9599a7e63c/i.test(String(uri || ''));

function recipeArtworkUrl(
  recipe: Partial<Recipe> | null | undefined,
  language: Language
) {
  const baseUrl = serverBaseUrl();
  if (!baseUrl) {
    return undefined;
  }
  const params = new URLSearchParams({
    title: String(recipe?.title || '').slice(0, 90),
    ingredients: (recipe?.ingredients || []).join(', ').slice(0, 160),
    language: normalizeLanguage(language),
  });
  return `${baseUrl}/api/recipe-image.svg?${params.toString()}`;
}

function recipeDisplayImageUri(
  recipe: Partial<Recipe> | null | undefined,
  language: Language
) {
  const current = safeImageUri(recipe?.imageUrl);
  if (current && !isGenericRecipeImageUri(current)) {
    return current;
  }
  return recipeArtworkUrl(recipe, language);
}

function recipeArtworkSource(
  recipe: Partial<Recipe> | null | undefined,
  language: Language
): ImageSourcePropType {
  const uri = recipeArtworkUrl(recipe, language);
  return uri ? { uri } : FALLBACK_IMAGE;
}

async function apiRequest<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT';
    body?: unknown;
    token?: string;
  }
): Promise<T> {
  const baseUrl = serverBaseUrl();
  if (!baseUrl) {
    throw new Error('Server URL missing');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  let payload: { error?: string } = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as { error?: string };
    } catch {
      throw new Error(raw);
    }
  }

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }

  return payload as T;
}

async function tryApiRequest<T>(
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT';
    body?: unknown;
    token?: string;
  }
) {
  try {
    return await apiRequest<T>(path, options);
  } catch {
    return null;
  }
}

async function fetchAppConfig() {
  const response = await tryApiRequest<{ config: AppConfig }>('/api/app/config');
  return normalizeAppConfig(response?.config || EMPTY_APP_CONFIG);
}

async function saveRemoteAppConfig(config: AppConfig, token: string) {
  const response = await apiRequest<{ config: AppConfig }>('/api/admin/app-config', {
    method: 'PUT',
    body: { config },
    token,
  });
  return normalizeAppConfig(response.config);
}

async function translateRecipe(recipe: Recipe, language: Language): Promise<Recipe> {
  if (language === 'en') {
    return localizedRecipeCopy({ ...recipe, locale: 'en' }, 'en');
  }

  const serverRecipe = await tryApiRequest<{ recipe: Recipe }>(
    '/api/search/translate-recipe',
    {
      method: 'POST',
      body: { recipe, language },
    }
  );

  if (serverRecipe?.recipe) {
    return withRecipeYoutubeUrl(
      withRecipeMeta(
        normalizeRecipe({
          ...recipe,
          ...serverRecipe.recipe,
          id: recipe.id,
          imageUrl: recipe.imageUrl ?? serverRecipe.recipe.imageUrl,
          youtubeUrl: recipe.youtubeUrl ?? serverRecipe.recipe.youtubeUrl,
          summary: translateStaticRecipeSummary(
            serverRecipe.recipe.summary ?? recipe.summary,
            language
          ),
          source: recipe.source,
          locale: language,
          note: recipe.note ?? serverRecipe.recipe.note,
          completedAt: recipe.completedAt,
          savedAt: recipe.savedAt,
        }),
        `${recipe.id}-${language}`
      ),
      language
    );
  }

  return withRecipeYoutubeUrl(
    withRecipeMeta(
      normalizeRecipe({
        ...recipe,
        summary: translateStaticRecipeSummary(recipe.summary, language),
        locale: language,
      }),
      `${recipe.id}-${language}`
    ),
    language
  );
}

async function fetchRecommendations(language: Language): Promise<Recipe[]> {
  const response = await tryApiRequest<{ recipes: Recipe[] }>(
    `/api/search/recommendations?language=${encodeURIComponent(language)}`
  );
  return (response?.recipes || []).map((recipe) => normalizeRecipe(recipe));
}

async function generateRecipe(
  ingredientsText: string,
  language: Language
): Promise<Recipe> {
  const serverRecipe = await tryApiRequest<{ recipe: Recipe }>('/api/search/recipe', {
    method: 'POST',
    body: { ingredientsText, language },
  });

  if (serverRecipe?.recipe) {
    const recipe = withRecipeMeta(
      normalizeRecipe({
        ...serverRecipe.recipe,
        id: makeClientId('recipe'),
        source: 'generated',
        locale: language,
      }),
      `${ingredientsText}-${language}`
    );
    return recipeLooksAlignedWithIngredients(recipe, ingredientsText)
      ? withRecipeYoutubeUrl(recipe, language)
      : generatePublicRecipeOrFallback(ingredientsText, language);
  }

  return generatePublicRecipeOrFallback(ingredientsText, language);
}

async function fetchSearchRecommendations(
  ingredientsText: string,
  language: Language,
  primaryRecipe: Recipe
): Promise<Recipe[]> {
  const seen = new Set<string>();
  const recipes: Recipe[] = [];
  const pushRecipe = (candidate: Recipe | undefined) => {
    if (!candidate) {
      return;
    }
    const normalized = withRecipeYoutubeUrl(
      withRecipeMeta(
        normalizeRecipe({
          ...candidate,
          id: makeClientId('search-rec'),
          locale: language,
        }),
        `${candidate.id}-${ingredientsText}-${language}`
      ),
      language
    );
    if (!recipeLooksAlignedWithIngredients(normalized, ingredientsText)) {
      return;
    }
    const key = normalizeLookupText(normalized.title);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    recipes.push(normalized);
  };

  pushRecipe(primaryRecipe);

  const variantsResponse = await tryApiRequest<{ variants: AiRecipeVariant[] }>(
    '/api/search/recipe-variants',
    {
      method: 'POST',
      body: { ingredientsText, language },
    }
  );
  for (const variant of variantsResponse?.variants || []) {
    pushRecipe(variant.recipe);
  }

  if (!recipes.length) {
    pushRecipe(fallbackRecipe(ingredientsText, language));
  }

  return recipes.slice(0, 6);
}

async function fetchRecipeVariants(ingredientsText: string, language: Language): Promise<AiRecipeVariant[]> {
  // AI (Yapay Zeka) isteği kaldırıldı -> Yerine teslim için yerel akıllı algoritma bağlandı
  return [
    {
      provider: 'dietary',
      label: language === 'tr' ? 'Diyet Alternatifi' : 'Dietary Alternative',
      available: true,
      recipe: {
        id: makeClientId('rec-diyet'),
        title: language === 'tr' ? 'Hafif & Fit Versiyon' : 'Light & Fit Version',
        ingredients: splitIngredientInput(
          ingredientsText + (language === 'tr' ? ', zeytinyağı (az)' : ', olive oil (light)')
        ),
        steps: [
          language === 'tr' 
            ? 'Yağ miktarını azaltarak, haşlama veya fırınlama yöntemlerini tercih ederek daha hafif bir şekilde hazırlayın.' 
            : 'Prepare in a lighter way by reducing the amount of oil and choosing boiling or baking methods.'
        ],
        source: 'generated',
        locale: language
      }
    }
  ];
}

// --- YAPAY ZEKASIZ CANLI İNTERNET TARİF ALGORİTMASI ---
async function generateRecipeFromPublicWeb(ingredientsText: string, language: Language): Promise<Recipe> {
  try {
    const rawItems = splitIngredientInput(ingredientsText);
    const cleanedItems = rawItems.map(item => cleanIngredientHint(item)).filter(Boolean);
    const searchWord = cleanedItems[0] || 'chicken';
    
    // Normalize and translate to English
    const normalizedInput = normalizeLookupText(searchWord);
    const englishIngredient = INGREDIENT_ALIASES[normalizedInput] || normalizedInput;
    const fetchMealDb = async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`TheMealDB request failed: ${response.status}`);
      }
      return await response.json();
    };

    const listeData = await fetchMealDb(
      `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(englishIngredient)}`
    );

    // Custom hashing to choose a deterministic index based on the input text
    const hashCode = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    };
    const hashVal = Math.abs(hashCode(ingredientsText.trim().toLowerCase()));

    let secilenYemekId = '';
    if (listeData && listeData.meals && listeData.meals.length > 0) {
      const chosenMeal = listeData.meals[hashVal % listeData.meals.length];
      secilenYemekId = chosenMeal.idMeal;
    } else {
      // Try with general search for first keyword
      const searchWordEng = INGREDIENT_ALIASES[normalizeLookupText(cleanedItems[0])] || 'pasta';
      const fallbackData = await fetchMealDb(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchWordEng)}`
      );
      if (fallbackData && fallbackData.meals && fallbackData.meals.length > 0) {
        const chosenMeal = fallbackData.meals[hashVal % fallbackData.meals.length];
        secilenYemekId = chosenMeal.idMeal;
      } else {
        const pastaData = await fetchMealDb(
          'https://www.themealdb.com/api/json/v1/1/search.php?s=pasta'
        );
        if (!pastaData?.meals?.length) {
          throw new Error('TheMealDB fallback returned no meals');
        }
        const chosenMeal = pastaData.meals[hashVal % pastaData.meals.length];
        secilenYemekId = chosenMeal.idMeal;
      }
    }

    if (!secilenYemekId) {
      throw new Error('TheMealDB returned no matching meal id');
    }

    const detayData = await fetchMealDb(
      `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${secilenYemekId}`
    );
    if (!detayData?.meals?.length) {
      throw new Error('TheMealDB lookup returned no meal details');
    }
    const yemek = detayData.meals[0];

    // Create reverse aliases for English to Turkish mapping
    const REVERSE_ALIASES: Record<string, string> = {
      'chicken': 'tavuk',
      'chicken breast': 'tavuk göğsü',
      'yogurt': 'yoğurt',
      'tomato': 'domates',
      'onion': 'soğan',
      'garlic': 'sarımsak',
      'pepper': 'biber',
      'potato': 'patates',
      'pasta': 'makarna',
      'cheese': 'peynir',
      'egg': 'yumurta',
      'milk': 'süt',
      'flour': 'un',
      'rice': 'pirinç',
      'beef': 'et',
      'fish': 'balık',
      'salmon': 'somon',
      'tuna': 'ton balığı',
      'mushroom': 'mantar',
      'cucumber': 'salatalık',
      'lemon': 'limon',
      'parsley': 'maydanoz',
      'mint': 'nane',
      'beans': 'fasulye',
      'chickpeas': 'nohut',
      'lentils': 'mercimek',
      'spinach': 'ıspanak',
      'broccoli': 'brokoli',
      'zucchini': 'kabak',
      'eggplant': 'patlıcan',
      'carrot': 'havuç',
      'olive oil': 'zeytinyağı',
      'butter': 'tereyağı',
      'salt': 'tuz',
      'sugar': 'şeker',
      'bread': 'ekmek',
      'water': 'su',
      'sauce': 'sos',
      'cream': 'krema',
      'oil': 'yağ',
      'spaghetti': 'spagetti',
      'ginger': 'zencefil',
      'cinnamon': 'tarçın',
      'honey': 'bal',
      'mustard': 'hardal',
      'vinegar': 'sirke'
    };

    const bilesenler: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const malzeme = yemek[`strIngredient${i}`];
      const olcu = yemek[`strMeasure${i}`];
      if (malzeme && malzeme.trim() !== "") {
        let malzemeTr = malzeme.trim();
        let olcuTr = olcu ? olcu.trim() : '';

        if (language === 'tr') {
          // Translate ingredient name
          const lookup = malzemeTr.toLowerCase();
          if (REVERSE_ALIASES[lookup]) {
            malzemeTr = REVERSE_ALIASES[lookup];
          } else {
            const words = lookup.split(/\s+/);
            const translatedWords = words.map((w: string) => REVERSE_ALIASES[w] || w);
            malzemeTr = translatedWords.join(' ');
          }

          // Translate measurements
          olcuTr = olcuTr
            .replace(/\bcup\b/gi, 'bardak')
            .replace(/\bcups\b/gi, 'bardak')
            .replace(/\btbsp\b/gi, 'yemek kaşığı')
            .replace(/\btbsps\b/gi, 'yemek kaşığı')
            .replace(/\btsp\b/gi, 'tatlı kaşığı')
            .replace(/\btsps\b/gi, 'tatlı kaşığı')
            .replace(/\bteaspoon\b/gi, 'tatlı kaşığı')
            .replace(/\bteaspoons\b/gi, 'tatlı kaşığı')
            .replace(/\btablespoon\b/gi, 'yemek kaşığı')
            .replace(/\btablespoons\b/gi, 'yemek kaşığı')
            .replace(/\bclove\b/gi, 'diş')
            .replace(/\bcloves\b/gi, 'diş')
            .replace(/\bpinch\b/gi, 'tutam')
            .replace(/\bpinches\b/gi, 'tutam')
            .replace(/\bslice\b/gi, 'dilim')
            .replace(/\bslices\b/gi, 'dilim')
            .replace(/\bcan\b/gi, 'kutu')
            .replace(/\bcans\b/gi, 'kutu')
            .replace(/\bto serve\b/gi, 'servis için')
            .replace(/\bfor frying\b/gi, 'kızartmak için')
            .replace(/\bg\b/gi, 'gr')
            .replace(/\bkg\b/gi, 'kg');
        }

        bilesenler.push(`${olcuTr} ${malzemeTr}`.trim());
      }
    }

    return {
      id: `public-recipe-${yemek.idMeal}-${makeClientId('mealdb')}`,
      title: language === 'tr' ? `İnternetten: ${yemek.strMeal}` : yemek.strMeal, 
      ingredients: bilesenler,
      steps: yemek.strInstructions ? yemek.strInstructions.split('\n').map((s: string) => s.trim()).filter(Boolean) : [], 
      source: 'generated', 
      locale: language
    };
  } catch (error) {
    console.error("Hata oluştu, güvenli tarife geçiliyor:", error);
    return fallbackRecipe(ingredientsText, language);
  }
}


function fallbackWorkoutPlan(
  language: Language,
  duration: PlanDuration,
  regions: BodyRegion[],
  goalText: string
): WorkoutPlan {
  const text = textFor(language);
  const selectedRegions: BodyRegion[] = regions.length
    ? regions
    : ['chest', 'back', 'legs'];

  const dayLabels =
    duration === 'daily'
      ? [language === 'tr' ? 'Bugun' : 'Today']
      : duration === 'weekly'
        ? language === 'tr'
          ? ['Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi', 'Pazar']
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        : language === 'tr'
          ? ['1. Hafta', '2. Hafta', '3. Hafta', '4. Hafta']
          : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  const exerciseLibrary: Record<
    BodyRegion,
    { name: string; summary: string; cue: string; motion: MotionStyle }[]
  > = {
    forearm: [
      {
        name: language === 'tr' ? 'Bilek curl' : 'Wrist curl',
        summary:
          language === 'tr'
            ? 'On kolu kontrollu guclendir.'
            : 'Build forearm control.',
        cue:
          language === 'tr'
            ? 'Bilegi yavasca yukari cek.'
            : 'Roll the wrist up smoothly.',
        motion: 'curl',
      },
      {
        name: language === 'tr' ? 'Ters bilek kaldirma' : 'Reverse wrist raise',
        summary:
          language === 'tr'
            ? 'Ters tutus ile dengele.'
            : 'Balance the forearm with reverse grip.',
        cue:
          language === 'tr'
            ? 'El sirtini tavana cevir.'
            : 'Lift the back of the hand upward.',
        motion: 'pull',
      },
    ],
    triceps: [
      {
        name: language === 'tr' ? 'Sandalye dips' : 'Chair dips',
        summary:
          language === 'tr'
            ? 'Arka kolu vucut agirligi ile calistir.'
            : 'Use bodyweight for triceps.',
        cue:
          language === 'tr'
            ? 'Dirsekleri geriye dogru kir.'
            : 'Bend the elbows backward.',
        motion: 'press',
      },
      {
        name: 'Triceps extension',
        summary:
          language === 'tr'
            ? 'Arka kolu yukaridan ac.'
            : 'Extend the triceps overhead.',
        cue:
          language === 'tr'
            ? 'Kollari yukarida ac-kapat.'
            : 'Extend the arms overhead.',
        motion: 'press',
      },
    ],
    legs: [
      {
        name: language === 'tr' ? 'Goblet squat' : 'Goblet squat',
        summary:
          language === 'tr'
            ? 'Bacak ve kalca dengesini artir.'
            : 'Improve leg and hip balance.',
        cue:
          language === 'tr'
            ? 'Kalcalari geriye gondererek cok.'
            : 'Sit back before you rise.',
        motion: 'squat',
      },
      {
        name: language === 'tr' ? 'Romen deadlift' : 'Romanian deadlift',
        summary:
          language === 'tr'
            ? 'Arka zinciri aktif et.'
            : 'Target the posterior chain.',
        cue:
          language === 'tr'
            ? 'Kalca kirip sirti sabit tut.'
            : 'Hinge at the hips and keep the back long.',
        motion: 'hinge',
      },
    ],
    chest: [
      {
        name: 'Push-up',
        summary:
          language === 'tr'
            ? 'Gogus ve merkez stabilitesini calistir.'
            : 'Train chest with core stability.',
        cue:
          language === 'tr'
            ? 'Vucudu tek cizgi halinde indir-kaldir.'
            : 'Lower and press in one line.',
        motion: 'press',
      },
      {
        name: language === 'tr' ? 'Floor press' : 'Floor press',
        summary:
          language === 'tr'
            ? 'Yerde kontrollu gogus itisi yap.'
            : 'Controlled chest press on the floor.',
        cue:
          language === 'tr'
            ? 'Dirsekleri 45 derece acida tut.'
            : 'Keep elbows at 45 degrees.',
        motion: 'press',
      },
    ],
    back: [
      {
        name: language === 'tr' ? 'Bent-over row' : 'Bent-over row',
        summary:
          language === 'tr'
            ? 'Sirti cekisle guclendir.'
            : 'Strengthen the back with pulling work.',
        cue:
          language === 'tr'
            ? 'Dirsekleri kalcaya dogru cek.'
            : 'Drive elbows toward the hips.',
        motion: 'pull',
      },
      {
        name: language === 'tr' ? 'Superman hold' : 'Superman hold',
        summary:
          language === 'tr'
            ? 'Bel ve sirt uzaticilarini aktive et.'
            : 'Activate spinal extensors.',
        cue:
          language === 'tr'
            ? 'Govdeyi hafifce yukari kaldir.'
            : 'Lift the chest slightly and hold.',
        motion: 'plank',
      },
    ],
    shoulders: [
      {
        name: language === 'tr' ? 'Overhead press' : 'Overhead press',
        summary:
          language === 'tr'
            ? 'Omuz itisini guclendir.'
            : 'Build overhead pressing strength.',
        cue:
          language === 'tr'
            ? 'Kollari kulak hizasindan yukari it.'
            : 'Press upward past ear level.',
        motion: 'press',
      },
      {
        name: language === 'tr' ? 'Lateral raise' : 'Lateral raise',
        summary:
          language === 'tr'
            ? 'Omuz genisligini destekle.'
            : 'Support shoulder width and control.',
        cue:
          language === 'tr'
            ? 'Kollari yana omuz hizasina kadar kaldir.'
            : 'Raise the arms to shoulder height.',
        motion: 'pull',
      },
    ],
    core: [
      {
        name: language === 'tr' ? 'Dead bug' : 'Dead bug',
        summary:
          language === 'tr'
            ? 'Merkezi kontrollu sekilde guclendir.'
            : 'Train the core with control.',
        cue:
          language === 'tr'
            ? 'Bel boslugunu kapatip kol-bacak uzat.'
            : 'Brace, then extend opposite limbs.',
        motion: 'twist',
      },
      {
        name: language === 'tr' ? 'Forearm plank' : 'Forearm plank',
        summary:
          language === 'tr'
            ? 'Karni sabit tutarak dayaniklilik kur.'
            : 'Build endurance with a steady brace.',
        cue:
          language === 'tr'
            ? 'Karni sik, kalcayi sabit tut.'
            : 'Brace the abs and keep hips still.',
        motion: 'plank',
      },
    ],
  };

  const exercisesForRegion = (region: BodyRegion, index: number): Exercise[] =>
    exerciseLibrary[region].map((item, movementIndex) =>
      normalizeExercise({
        id: `${region}-${index}-${movementIndex}-${Date.now()}`,
        name: item.name,
        region,
        sets:
          duration === 'daily'
            ? '3 set'
            : duration === 'weekly'
              ? '4 set'
              : `${3 + (index % 2)} set`,
        reps:
          item.motion === 'plank'
            ? language === 'tr'
              ? '35-45 sn'
              : '35-45 sec'
            : language === 'tr'
              ? '10-14 tekrar'
              : '10-14 reps',
        rest: language === 'tr' ? '45-60 sn dinlen' : 'Rest 45-60 sec',
        summary: item.summary,
        instructions:
          language === 'tr'
            ? [
                'Baslangic pozisyonunu kur.',
                'Ana hareketi kontrollu uygula.',
                'Tepe noktada durup yavasca don.',
              ]
            : [
                'Set your start position.',
                'Move through the main action with control.',
                'Pause at the top and return slowly.',
              ],
        animationCue: item.cue,
        motionStyle: item.motion,
      })
    );

  const days = dayLabels.map((label, index) => {
    const activeRegion = selectedRegions[index % selectedRegions.length];
    return {
      id: `day-${index}-${Date.now()}`,
      title: label,
      focus: `${
        regionLabel(activeRegion, language)
      } ${language === 'tr' ? 'odakli akilli blok' : 'focused smart block'}`,
      exercises: exercisesForRegion(activeRegion, index)
        .concat(exercisesForRegion(selectedRegions[(index + 1) % selectedRegions.length], index))
        .slice(0, 4),
    };
  });

  return normalizeWorkoutPlan(
    {
      id: `fallback-plan-${Date.now()}`,
      title:
        goalText.trim() ||
        (language === 'tr'
          ? 'Kaynak destekli yedek spor plani'
          : 'Source-backed fallback workout plan'),
      summary: text.workoutFallback,
      duration,
      regions: selectedRegions,
      createdAt: new Date().toISOString(),
      days,
    },
    duration
  );
}

async function generateWorkoutPlan(
  goalText: string,
  duration: PlanDuration,
  regions: BodyRegion[],
  language: Language
): Promise<WorkoutPlan> {
  const serverPlan = await tryApiRequest<{ plan: WorkoutPlan }>(
    '/api/search/workout-plan',
    {
      method: 'POST',
      body: { goalText, duration, regions, language },
    }
  );

  if (serverPlan?.plan) {
    return normalizeWorkoutPlan(
      {
        ...serverPlan.plan,
        id: `plan-${Date.now()}`,
        duration,
        regions,
        createdAt: serverPlan.plan.createdAt || new Date().toISOString(),
      },
      duration
    );
  }

  return fallbackWorkoutPlan(language, duration, regions, goalText);
}

async function answerAppQuestion(question: string, language: Language) {
  const serverAnswer = await tryApiRequest<{ answer: string }>('/api/search/app-help', {
    method: 'POST',
    body: { question, language },
  });

  if (serverAnswer?.answer?.trim()) {
    return serverAnswer.answer.trim();
  }

  return fallbackAppAnswer(question, language);
}

function recipeShareMessage(recipe: Recipe, language: Language) {
  const text = textFor(language);
  const videoUrl = recipeYoutubeUrl(recipe, language);
  return [
    recipe.title,
    recipe.summary || '',
    `${text.recipeVideo}: ${videoUrl}`,
    '',
    `${text.ingredientsSection}:`,
    ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
    '',
    `${text.stepsSection}:`,
    ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `${text.protein}: ${recipe.nutrition?.protein || '0 g'} | ${text.carbs}: ${
      recipe.nutrition?.carbs || '0 g'
    } | ${text.fat}: ${recipe.nutrition?.fat || '0 g'} | ${text.calories}: ${
      recipe.calories || '0 kcal'
    }`,
    recipe.note ? `${text.notePlaceholder}: ${recipe.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function workoutPlanShareMessage(plan: WorkoutPlan, language: Language) {
  const text = textFor(language);
  const durationLabel =
    plan.duration === 'daily'
      ? text.daily
      : plan.duration === 'weekly'
        ? text.weekly
        : text.monthly;
  const planLines = plan.days.flatMap((day) => [
    '',
    `${day.title} - ${day.focus}`,
    ...day.exercises.map(
      (exercise) =>
        `- ${exercise.name}: ${exercise.sets}, ${exercise.reps}, ${exercise.rest}`
    ),
  ]);

  return [
    plan.title,
    plan.summary,
    `${text.duration}: ${durationLabel}`,
    `${text.regions}: ${plan.regions
      .map((region) => regionLabel(region, language))
      .join(', ')}`,
    ...planLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function profileShareMessage(
  user: UserAccount,
  data: UserDataPayload,
  language: Language
) {
  const text = textFor(language);
  return [
    `${user.profile.displayName || text.guestName} - ${text.memberProfileText}`,
    `${text.email}: ${user.email}`,
    `${text.memberSince}: ${formatDate(user.createdAt, language)}`,
    `${text.latestRecipe}: ${data.latestRecipe?.title || text.noLatestRecipe}`,
    `${text.savedPlans}: ${data.savedWorkoutPlans.length}`,
    `${text.favoriteTitle}: ${data.favorites.length}`,
  ].join('\n');
}

async function shareToTarget(
  payload: SharePayload,
  target: ShareTarget,
  language: Language
) {
  const text = textFor(language);
  const encoded = encodeURIComponent(payload.message);
  const shareData = { title: payload.title, text: payload.message };
  const webNavigator = (
    globalThis as unknown as {
      navigator?: {
        share?: (data: { title?: string; text?: string }) => Promise<void>;
        clipboard?: { writeText?: (text: string) => Promise<void> };
      };
    }
  ).navigator;
  const openWebUrl = (url: string) => {
    const webWindow = (
      globalThis as unknown as {
        window?: { open?: (url: string, target?: string, features?: string) => unknown };
      }
    ).window;
    if (typeof webWindow?.open === 'function') {
      webWindow.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    void Linking.openURL(url);
  };
  const copyShareText = async () => {
    if (typeof webNavigator?.clipboard?.writeText === 'function') {
      await webNavigator.clipboard.writeText(payload.message);
      return true;
    }
    return false;
  };

  if (Platform.OS === 'web') {
    if (target === 'system') {
      if (typeof webNavigator?.share === 'function') {
        try {
          await webNavigator.share(shareData);
          return;
        } catch (error) {
          if ((error as Error)?.name === 'AbortError') {
            return;
          }
        }
      }
      if (await copyShareText()) {
        Alert.alert(text.shareTitle, text.shareFallback);
      }
      return;
    }

    if (target === 'whatsapp') {
      openWebUrl(`https://wa.me/?text=${encoded}`);
      return;
    }

    if (target === 'instagram') {
      await copyShareText().catch(() => false);
      openWebUrl('https://www.instagram.com/direct/inbox/');
      return;
    }

    if (target === 'facebook') {
      openWebUrl(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}`);
      return;
    }
  }

  if (target === 'system') {
    await Share.share({ title: payload.title, message: payload.message });
    return;
  }

  if (target === 'whatsapp') {
    const url = `https://wa.me/?text=${encoded}`;
    if (await Linking.canOpenURL(url)) {
      await Linking.openURL(url);
      return;
    }
  }

  if (target === 'instagram') {
    const deepLink =
      Platform.OS === 'web'
        ? 'https://www.instagram.com/direct/inbox/'
        : 'instagram://direct-inbox';
    if (await Linking.canOpenURL(deepLink)) {
      await Linking.openURL(deepLink);
      await Share.share({ title: payload.title, message: payload.message });
      return;
    }
  }

  if (target === 'facebook') {
    await Share.share({ title: payload.title, message: payload.message });
    return;
  }

  Alert.alert(text.shareTitle, text.shareFallback);
  await Share.share({ title: payload.title, message: payload.message });
}

function SmartImage({
  sourceUri,
  fallbackSource,
  style,
  resizeMode = 'cover',
}: {
  sourceUri?: string;
  fallbackSource: ImageSourcePropType;
  style: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [sourceUri]);

  return (
    <Image
      source={!failed && sourceUri ? { uri: sourceUri } : fallbackSource}
      style={style}
      resizeMode={resizeMode}
      onError={() => setFailed(true)}
    />
  );
}

function WorkoutVideoFrame({
  exercise,
  motionStyle,
  theme,
}: {
  exercise?: Exercise;
  motionStyle?: MotionStyle;
  theme: ThemePalette;
}) {
  const video = exercise
    ? resolveWorkoutVideo(exercise)
    : workoutVideoForMotionStyle(motionStyle || 'press');
  const embedUrl = workoutVideoEmbedUrl(video);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.videoFrame, { borderColor: theme.border }]}>
        {createElement('iframe', {
          src: embedUrl,
          title: video.title,
          style: {
            border: 0,
            width: '100%',
            height: '100%',
            display: 'block',
          },
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowFullScreen: true,
        })}
      </View>
    );
  }

  return (
    <View style={[styles.videoFrame, { borderColor: theme.border }]}>
      <WebView
        source={{ uri: embedUrl }}
        style={styles.videoWebView}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

function WorkoutVideoThumb({
  exercise,
  motionStyle,
  theme,
  style,
  openVideo = true,
}: {
  exercise?: Exercise;
  motionStyle?: MotionStyle;
  theme: ThemePalette;
  style: StyleProp<ImageStyle>;
  openVideo?: boolean;
}) {
  const video = exercise
    ? resolveWorkoutVideo(exercise)
    : workoutVideoForMotionStyle(motionStyle || 'press');

  const content = (
    <>
      <SmartImage
        sourceUri={video.thumbnail}
        fallbackSource={FALLBACK_IMAGE}
        style={style}
      />
      <View
        style={[
          styles.videoPlayBadge,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        <Ionicons name="play" size={14} color={theme.text} />
      </View>
    </>
  );

  if (!openVideo) {
    return <View style={styles.videoThumbButton}>{content}</View>;
  }

  return (
    <Pressable
      onPress={() => void Linking.openURL(workoutVideoWatchUrl(video))}
      style={styles.videoThumbButton}
    >
      {content}
    </Pressable>
  );
}

function HolographicButton({
  label,
  onPress,
  busy,
  theme,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  theme: ThemePalette;
}) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [styles.hologramContainer, pressed && styles.scalePress]}>
      <LinearGradient
        colors={['#C4B5FD', '#FDA4AF', '#7DD3FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hologramGradient}
      >
        <View style={styles.hologramInner}>
          {busy ? <ActivityIndicator color="#111" /> : <><Ionicons name="flash" size={18} color="#111" /><Text style={styles.hologramText}>{label}</Text></>}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function DepthBackdrop({ theme }: { theme: ThemePalette }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.pointerEventsNone]}>
      <LinearGradient
        colors={theme.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.depthBubble,
          styles.depthBubbleA,
          { backgroundColor: theme.depthA },
          shadowStyle(theme.shadow, DEPTH_BUBBLE_SHADOW),
        ]}
      />
      <View
        style={[
          styles.depthBubble,
          styles.depthBubbleB,
          { backgroundColor: theme.depthB },
          shadowStyle(theme.shadow, DEPTH_BUBBLE_SHADOW),
        ]}
      />
      <View
        style={[
          styles.depthBubble,
          styles.depthBubbleC,
          { backgroundColor: theme.depthC },
          shadowStyle(theme.shadow, DEPTH_BUBBLE_SHADOW),
        ]}
      />
      <View
        style={[
          styles.depthPlate,
          {
            borderColor: theme.border,
            backgroundColor: theme.accentGhost,
          },
        ]}
      />
    </View>
  );
}

function ProgressOverlay({
  state,
  theme,
}: {
  state: OperationState;
  theme: ThemePalette;
}) {
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(-10);
  const fillProgress = useSharedValue(Math.max(state.progress, 0.08));
  const shimmer = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!state.visible) {
      cancelAnimation(shimmer);
      cancelAnimation(pulse);
      cardOpacity.value = 0;
      cardTranslateY.value = -10;
      return;
    }

    cardOpacity.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    cardTranslateY.value = withTiming(0, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
    });
    shimmer.value = 0;
    shimmer.value = withRepeat(
      withTiming(1, {
        duration: 1350,
        easing: Easing.out(Easing.cubic),
      }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 620,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(0, {
          duration: 620,
          easing: Easing.out(Easing.cubic),
        })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(shimmer);
      cancelAnimation(pulse);
    };
  }, [cardOpacity, cardTranslateY, pulse, shimmer, state.visible]);

  useEffect(() => {
    fillProgress.value = withTiming(Math.max(state.progress, 0.08), {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillProgress, state.progress]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateY: cardTranslateY.value },
      { scale: 0.98 + cardOpacity.value * 0.02 },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(fillProgress.value * 100, 8)}%`,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + shimmer.value * 0.22,
    transform: [
      {
        translateX: interpolate(shimmer.value, [0, 1], [-80, 280]),
      },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.value * 0.5,
    transform: [{ scale: 0.92 + pulse.value * 0.12 }],
  }));

  if (!state.visible) {
    return null;
  }

  return (
    <View style={[styles.progressOverlay, styles.pointerEventsNone]}>
      <Animated.View
        style={[
          styles.progressCard,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
          shadowStyle(theme.shadow, PROGRESS_CARD_SHADOW),
          cardStyle,
        ]}
      >
        <View style={styles.progressHeader}>
          <View style={styles.progressLabelRow}>
            <Animated.View
              style={[
                styles.progressPulse,
                { backgroundColor: theme.accent },
                pulseStyle,
              ]}
            />
            <Text
              numberOfLines={1}
              style={[styles.progressLabel, { color: theme.text }]}
            >
              {state.label}
            </Text>
          </View>
          <Text style={[styles.progressMeta, { color: theme.textSoft }]}>
            {Math.round(state.progress * 100)}%
          </Text>
        </View>
        <View
          style={[styles.progressTrack, { backgroundColor: theme.ringTrack }]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.accent,
              },
              fillStyle,
            ]}
          >
            <Animated.View
              style={[
                styles.progressShimmer,
                { backgroundColor: theme.inverseText },
                shimmerStyle,
              ]}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

function MacroOrb({
  macroKey,
  value,
  target,
  language,
  theme,
}: {
  macroKey: MacroKey;
  value: number;
  target: number;
  language: Language;
  theme: ThemePalette;
}) {
  const progress = Math.min(value / target, 1);
  return (
    <View style={styles.macroOrbWrap}>
      <View
        style={[
          styles.macroOrb,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
          shadowStyle(theme.shadow, PROGRESS_CARD_SHADOW),
        ]}
      >
        <View
          style={[
            styles.macroOrbFillTrack,
            { backgroundColor: theme.ringTrack },
          ]}
        >
          <View
            style={[
              styles.macroOrbFill,
              {
                height: `${Math.max(progress * 100, 8)}%`,
                backgroundColor: macroFillColor(progress, theme),
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.macroOrbCenter,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.macroOrbValue, { color: theme.text }]}>
            {macroKey === 'calories' ? Math.round(value) : Math.round(value)}
          </Text>
          <Text style={[styles.macroOrbUnit, { color: theme.textSoft }]}>
            {macroKey === 'calories' ? textFor(language).caloriesShort : 'g'}
          </Text>
        </View>
      </View>
      <Text style={[styles.macroOrbLabel, { color: theme.textMuted }]}>
        {macroLabel(macroKey, language)}
      </Text>
      <Text style={[styles.macroOrbFoot, { color: theme.textSoft }]}>
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
}

function RecipeMosaic({
  recipes,
  language,
  theme,
}: {
  recipes: Recipe[];
  language: Language;
  theme: ThemePalette;
}) {
  const preview = recipes.slice(0, 3);
  if (!preview.length) {
    return (
      <View
        style={[
          styles.collectionVisualEmpty,
          {
            backgroundColor: theme.surfaceAlt,
            borderColor: theme.border,
          },
        ]}
      >
        <Ionicons
          name="images-outline"
          size={26}
          color={theme.isDark ? theme.textMuted : theme.textSoft}
        />
      </View>
    );
  }

  return (
    <View style={styles.collectionVisual}>
      <SmartImage
        sourceUri={recipeDisplayImageUri(preview[0], language)}
        fallbackSource={recipeArtworkSource(preview[0], language)}
        style={styles.collectionVisualMain}
      />
      <View style={styles.collectionVisualSide}>
        <SmartImage
          sourceUri={recipeDisplayImageUri(preview[1], language)}
          fallbackSource={recipeArtworkSource(preview[1], language)}
          style={styles.collectionVisualMini}
        />
        <SmartImage
          sourceUri={recipeDisplayImageUri(preview[2], language)}
          fallbackSource={recipeArtworkSource(preview[2], language)}
          style={styles.collectionVisualMini}
        />
      </View>
    </View>
  );
}

function ShareTargetsModal({
  visible,
  language,
  theme,
  onClose,
  onSelect,
}: {
  visible: boolean;
  language: Language;
  theme: ThemePalette;
  onClose: () => void;
  onSelect: (target: ShareTarget) => void;
}) {
  const text = textFor(language);
  const options: {
    target: ShareTarget;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { target: 'whatsapp', label: text.shareWhatsApp, icon: 'logo-whatsapp' },
    { target: 'facebook', label: text.shareFacebook, icon: 'logo-facebook' },
    { target: 'instagram', label: text.shareInstagram, icon: 'logo-instagram' },
    { target: 'system', label: text.shareSystem, icon: 'share-social-outline' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.modalBackdrop,
          styles.shareModalBackdrop,
          { backgroundColor: theme.overlay },
        ]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {text.shareTitle}
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>
          <View style={styles.shareGrid}>
            {options.map((item) => (
              <Pressable
                key={item.target}
                onPress={() => onSelect(item.target)}
                style={({ pressed }) => [
                  styles.shareButton,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                  pressed && styles.scalePress,
                ]}
              >
                <Ionicons name={item.icon} size={20} color={theme.text} />
                <Text style={[styles.shareButtonText, { color: theme.text }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RecipeModal({
  recipe,
  visible,
  language,
  theme,
  isFavorite,
  onToggleFavorite,
  onMarkDone,
  onShare,
  onOpenAiVariants,
  onClose,
  userProfile,
}: {
  recipe: Recipe | null;
  visible: boolean;
  language: Language;
  theme: ThemePalette;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onMarkDone: () => void;
  onShare: () => void;
  onOpenAiVariants: () => void;
  onClose: () => void;
  userProfile?: UserProfile;
}) {
  const text = textFor(language);
  if (!recipe) {
    return null;
  }

  const videoUrl = recipeYoutubeUrl(recipe, language);

  function generateCoachComments(rec: Recipe, prof: UserProfile | undefined, lang: Language) {
    if (!prof || !prof.weight || !prof.fitnessGoal) {
      return null;
    }
    const isTr = lang === 'tr';
    const goal = prof.fitnessGoal;
    
    const calStr = rec.calories || '';
    const calVal = parseInt(calStr.replace(/[^0-9]/g, '')) || 0;
    
    const protStr = rec.nutrition?.protein || '';
    const protVal = parseInt(protStr.replace(/[^0-9]/g, '')) || 0;
    
    const userMacros = getPersonalizedMacros(prof);
    const targetCal = userMacros.calories;
    const pct = targetCal ? Math.round((calVal / targetCal) * 100) : 0;
    
    let commentText = '';
    let status: 'good' | 'info' | 'warning' = 'info';

    if (goal === 'lose') {
      if (calVal > 700) {
        status = 'warning';
        commentText = isTr 
          ? `⚠️ Kilo Verme hedefindesiniz. Bu tarif tek başına oldukça yüksek kalorilidir (${calVal} kcal) ve günlük bütçenizin %${pct}'sini kaplar. Porsiyon kontrolü yapmanız önerilir.`
          : `⚠️ You are on a Weight Loss goal. This recipe is quite high in calories (${calVal} kcal), taking up ${pct}% of your daily budget. Portion control is recommended.`;
      } else if (protVal >= 25) {
        status = 'good';
        commentText = isTr
          ? `🎯 Hedefiniz için harika! Yüksek protein içeriği (${protVal}g) sayesinde yağ yakımını destekler ve kas kütlenizi korur.`
          : `🎯 Great for your goal! High protein content (${protVal}g) helps support fat loss and preserves muscle mass.`;
      } else {
        status = 'good';
        commentText = isTr
          ? `👍 Bu hafif tarif kilo kontrolü hedefinize uygundur. Günlük kalori bütçenizin sadece %${pct}'sini tüketir.`
          : `👍 This light recipe fits your weight control goal. It consumes only ${pct}% of your daily calorie budget.`;
      }
    } else if (goal === 'muscle') {
      if (protVal >= 30) {
        status = 'good';
        commentText = isTr
          ? `💪 Kas Yapma hedefiniz için mükemmel bir tarif! Zengin protein içeriği (${protVal}g) kas onarımını ve gelişimini hızlandırır.`
          : `💪 Excellent recipe for your Muscle Building goal! Rich protein content (${protVal}g) accelerates muscle repair and hypertrophy.`;
      } else {
        status = 'info';
        commentText = isTr
          ? `ℹ️ Kas gelişimi için bu öğünün yanına protein değeri yüksek ek bir besin (yoğurt, yumurta vb.) eklemeyi düşünebilirsiniz.`
          : `ℹ️ For optimal muscle building, consider adding a protein-rich side (yogurt, egg, etc.) to this meal.`;
      }
    } else if (goal === 'gain') {
      if (calVal > 600) {
        status = 'good';
        commentText = isTr
          ? `📈 Kilo Alma / Hacim kazanma hedefiniz için çok uygun! Kalori yoğunluğu yüksek bir tarif (${calVal} kcal) sağlıklı bir kalori fazlası oluşturmanıza yardımcı olur.`
          : `📈 Great for your Weight Gain / Bulking goal! High calorie density (${calVal} kcal) helps you maintain a healthy caloric surplus.`;
      } else {
        status = 'info';
        commentText = isTr
          ? `ℹ️ Kilo alma hedefinizi desteklemek için bu yemeği kuruyemiş, zeytinyağı veya sağlıklı karbonhidrat ekleyerek daha kalori yoğun hale getirebilirsiniz.`
          : `ℹ️ To support weight gain, you can make this meal more calorie-dense by adding nuts, olive oil, or healthy carbohydrates.`;
      }
    } else {
      commentText = isTr
        ? `👍 Dengeli beslenme ve formunuzu koruma hedefinize uygundur. Günlük kalori bütçenizin %${pct}'sini karşılar.`
        : `👍 Fits your balanced nutrition and weight maintenance goal, covering ${pct}% of your daily calorie budget.`;
    }

    return { commentText, status };
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <SmartImage
              sourceUri={recipeDisplayImageUri(recipe, language)}
              fallbackSource={recipeArtworkSource(recipe, language)}
              style={styles.modalHeroImage}
            />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {recipe.title}
            </Text>
            <Text style={[styles.modalMeta, { color: theme.textSoft }]}>
              {recipe.cookTime ?? text.unknownTime} •{' '}
              {recipe.calories ?? text.unknownCalories}
            </Text>
            {recipe.summary ? (
              <Text style={[styles.modalSummary, { color: theme.textMuted }]}>
                {recipe.summary}
              </Text>
            ) : null}
            <Pressable
              onPress={() => void Linking.openURL(videoUrl)}
              style={({ pressed }) => [
                styles.recipeVideoButton,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
                pressed && styles.scalePress,
              ]}
            >
              <Ionicons name="play-circle-outline" size={18} color={theme.text} />
              <Text style={[styles.recipeVideoButtonText, { color: theme.text }]}>
                {text.watchRecipeVideo}
              </Text>
            </Pressable>
            
            {/* Coach Comments Block */}
            {(() => {
              const coach = generateCoachComments(recipe, userProfile, language);
              if (!coach) return null;
              const statusColor = 
                coach.status === 'good' ? '#D4EDDA' : 
                coach.status === 'warning' ? '#FFF3CD' : 
                '#E2E3E5';
              const textColor = 
                coach.status === 'good' ? '#155724' : 
                coach.status === 'warning' ? '#856404' : 
                '#383D41';
              const borderColor = 
                coach.status === 'good' ? '#C3E6CB' : 
                coach.status === 'warning' ? '#FFEEBA' : 
                '#D6D8DB';
              const iconName = 
                coach.status === 'good' ? 'checkmark-circle-outline' : 
                coach.status === 'warning' ? 'warning-outline' : 
                'information-circle-outline';

              return (
                <View
                  style={{
                    backgroundColor: statusColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                    marginVertical: 12,
                    flexDirection: 'row',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name={iconName as any} size={20} color={textColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: textColor, marginBottom: 2 }}>
                      {text.coachCommentsTitle}
                    </Text>
                    <Text style={{ fontSize: 12, color: textColor, lineHeight: 17 }}>
                      {coach.commentText}
                    </Text>
                  </View>
                </View>
              );
            })()}

            <View style={styles.modalNutritionRow}>
              <Text
                style={[
                  styles.modalNutritionChip,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                  },
                ]}
              >
                {text.protein}: {recipe.nutrition?.protein || '0 g'}
              </Text>
              <Text
                style={[
                  styles.modalNutritionChip,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                  },
                ]}
              >
                {text.carbs}: {recipe.nutrition?.carbs || '0 g'}
              </Text>
              <Text
                style={[
                  styles.modalNutritionChip,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                  },
                ]}
              >
                {text.fat}: {recipe.nutrition?.fat || '0 g'}
              </Text>
              <Text
                style={[
                  styles.modalNutritionChip,
                  {
                    backgroundColor: theme.surfaceAlt,
                    color: theme.text,
                  },
                ]}
              >
                {text.calories}: {recipe.calories || '0 kcal'}
              </Text>
            </View>

            <Text style={[styles.modalSection, { color: theme.text }]}>
              {text.ingredientsSection}
            </Text>
            <View style={styles.glassList}>
              {recipe.ingredients?.map((ingredient, index) => (
                <Text
                  key={`${recipe.id}-ingredient-${index}`}
                  style={[styles.modalItem, { color: theme.textMuted }]}
                >
                  • {ingredient}
                </Text>
              ))}
            </View>

            <Text style={[styles.modalSection, { color: theme.text }]}>
              {text.stepsSection}
            </Text>
            <View style={styles.glassList}>
              {recipe.steps?.map((step, index) => (
                <Text
                  key={`${recipe.id}-step-${index}`}
                  style={[styles.modalItem, { color: theme.textMuted }]}
                >
                  {index + 1}. {step}
                </Text>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalActionColumn}>
            <HolographicButton label={text.doneAndAdd} onPress={onMarkDone} theme={theme} />

            <View style={styles.modalButtonRow}>
              <Pressable
                onPress={onToggleFavorite}
                style={({ pressed }) => [
                  styles.secondaryPillButton,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                  pressed && styles.scalePress,
                ]}
              >
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={16}
                  color={theme.text}
                />
                <Text
                  style={[styles.secondaryPillButtonText, { color: theme.text }]}
                >
                  {isFavorite ? text.removeFavorite : text.addFavorite}
                </Text>
              </Pressable>
              <Pressable
                onPress={onShare}
                style={({ pressed }) => [
                  styles.secondaryPillButton,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                  pressed && styles.scalePress,
                ]}
              >
                <Ionicons
                  name="share-social-outline"
                  size={16}
                  color={theme.text}
                />
                <Text
                  style={[styles.secondaryPillButtonText, { color: theme.text }]}
                >
                  {text.shareTitle}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.darkButton,
                {
                  backgroundColor: theme.isDark ? '#FFFFFF' : '#111111',
                },
                pressed && styles.scalePress,
              ]}
            >
              <Text
                style={[
                  styles.darkButtonText,
                  { color: theme.isDark ? '#050505' : '#FFFFFF' },
                ]}
              >
                {text.close}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AiRecipeVariantsModal({
  visible,
  variants,
  loading,
  error,
  language,
  theme,
  onClose,
  onOpenRecipe,
  onReload,
}: {
  visible: boolean;
  variants: AiRecipeVariant[];
  loading: boolean;
  error: string | null;
  language: Language;
  theme: ThemePalette;
  onClose: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onReload: () => void;
}) {
  const text = textFor(language);
  const hasAnyRecipe = variants.some((variant) => Boolean(variant.recipe));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleWrap}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {text.aiVariantsTitle}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textSoft }]}>
                {text.aiVariantsSubtitle}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.modalButtonRow}>
            <Pressable
              onPress={onReload}
              style={({ pressed }) => [
                styles.secondaryWideButton,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
                pressed && styles.scalePress,
              ]}
            >
              <Ionicons name="refresh-outline" size={16} color={theme.text} />
              <Text style={[styles.secondaryPillButtonText, { color: theme.text }]}>
                {text.aiVariantsLoad}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.aiVariantList}
          >
            {loading ? (
              <View
                style={[
                  styles.aiVariantLoading,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.aiVariantStatus, { color: theme.textSoft }]}>
                  {text.loadingAiVariants}
                </Text>
              </View>
            ) : null}

            {error ? (
              <Text style={[styles.aiVariantStatus, { color: theme.textSoft }]}>
                {error}
              </Text>
            ) : null}

            {!loading && !hasAnyRecipe && !error ? (
              <Text style={[styles.aiVariantStatus, { color: theme.textSoft }]}>
                {text.aiVariantsEmpty}
              </Text>
            ) : null}

            {variants.map((variant, index) => (
              <View
                key={`${variant.provider}-${index}`}
                style={[
                  styles.aiVariantCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.aiVariantHeader}>
                  <Text style={[styles.aiVariantProvider, { color: theme.text }]}>
                    {variant.label}
                  </Text>
                  <Text style={[styles.aiVariantModel, { color: theme.textSoft }]}>
                    {variant.model || variant.provider}
                  </Text>
                </View>

                {!variant.available ? (
                  <Text style={[styles.aiVariantStatus, { color: theme.textSoft }]}>
                    {variant.warning || text.aiVariantUnavailable}
                  </Text>
                ) : variant.recipe ? (
                  <View style={styles.aiVariantRecipeWrap}>
                    <SmartImage
                      sourceUri={recipeDisplayImageUri(variant.recipe, language)}
                      fallbackSource={recipeArtworkSource(variant.recipe, language)}
                      style={styles.aiVariantImage}
                    />
                    <Text style={[styles.aiVariantRecipeTitle, { color: theme.text }]}>
                      {variant.recipe.title}
                    </Text>
                    <Text style={[styles.aiVariantRecipeSummary, { color: theme.textMuted }]}>
                      {variant.recipe.summary || text.generatedRecipe}
                    </Text>
                    {variant.warning ? (
                      <Text style={[styles.aiVariantStatus, { color: theme.textSoft }]}>
                        {variant.warning}
                      </Text>
                    ) : null}
                    <Pressable
                      onPress={() => onOpenRecipe(variant.recipe as Recipe)}
                      style={({ pressed }) => [
                        styles.collectionActionButton,
                        {
                          backgroundColor: theme.surfaceAlt,
                          borderColor: theme.border,
                        },
                        pressed && styles.scalePress,
                      ]}
                    >
                      <Text style={[styles.collectionActionText, { color: theme.text }]}>
                        {text.aiVariantApply}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text style={[styles.aiVariantStatus, { color: theme.textSoft }]}>
                    {variant.warning || text.aiVariantsEmpty}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RecipeCollectionModal({
  visible,
  title,
  recipes,
  editableNotes,
  language,
  theme,
  onClose,
  onSelect,
  onShare,
  onNoteChange,
}: {
  visible: boolean;
  title: string;
  recipes: Recipe[];
  editableNotes?: boolean;
  language: Language;
  theme: ThemePalette;
  onClose: () => void;
  onSelect: (recipe: Recipe) => void;
  onShare: (recipe: Recipe) => void;
  onNoteChange?: (recipeId: string, note: string) => void;
}) {
  const text = textFor(language);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>{title}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          {recipes.length === 0 ? (
            <Text style={[styles.emptyStateText, { color: theme.textSoft }]}>
              {editableNotes ? text.emptyFavorites : text.emptyHistory}
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {recipes.map((recipe, index) => (
                <View
                  key={`${recipe.id}-${index}`}
                  style={[
                    styles.collectionItem,
                    {
                      backgroundColor: theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => onSelect(recipe)}
                    style={styles.collectionMainRow}
                  >
                    <SmartImage
                      sourceUri={recipeDisplayImageUri(recipe, language)}
                      fallbackSource={recipeArtworkSource(recipe, language)}
                      style={styles.collectionThumb}
                    />
                    <View style={styles.collectionTextWrap}>
                      <Text
                        style={[styles.collectionTitle, { color: theme.text }]}
                      >
                        {recipe.title}
                      </Text>
                      <Text
                        style={[
                          styles.collectionMetaText,
                          { color: theme.textSoft },
                        ]}
                        numberOfLines={2}
                      >
                        {recipe.summary || recipe.cookTime || ''}
                      </Text>
                    </View>
                  </Pressable>

                  <View style={styles.collectionActions}>
                    <Pressable
                      onPress={() => onSelect(recipe)}
                      style={[
                        styles.collectionActionButton,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.collectionActionText,
                          { color: theme.text },
                        ]}
                      >
                        {text.detail}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onShare(recipe)}
                      style={[
                        styles.collectionActionButton,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.collectionActionText,
                          { color: theme.text },
                        ]}
                      >
                        {text.shareTitle}
                      </Text>
                    </Pressable>
                  </View>

                  {editableNotes && onNoteChange ? (
                    <TextInput
                      value={recipe.note ?? ''}
                      onChangeText={(value) => onNoteChange(recipe.id, value)}
                      placeholder={text.notePlaceholder}
                      placeholderTextColor={theme.placeholder}
                      style={[
                        styles.noteInput,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          color: theme.text,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function WorkoutPlanModal({
  visible,
  plan,
  language,
  theme,
  isSaved,
  onSave,
  onShare,
  onClose,
}: {
  visible: boolean;
  plan: WorkoutPlan | null;
  language: Language;
  theme: ThemePalette;
  isSaved: boolean;
  onSave: () => void;
  onShare: () => void;
  onClose: () => void;
}) {
  const text = textFor(language);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [plan?.id]);

  if (!plan) {
    return null;
  }

  const activeDay =
    plan.days[Math.min(activeDayIndex, Math.max(plan.days.length - 1, 0))];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {plan.title}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textSoft }]}>
                {plan.summary}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayTabsRow}
          >
            {plan.days.map((day, index) => (
              <Pressable
                key={day.id}
                onPress={() => setActiveDayIndex(index)}
                style={[
                  styles.dayTab,
                  {
                    backgroundColor:
                      index === activeDayIndex ? theme.accent : theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayTabText,
                    {
                      color:
                        index === activeDayIndex
                          ? theme.inverseText
                          : theme.text,
                    },
                  ]}
                >
                  {day.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.activeDayCard,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.activeDayTitle, { color: theme.text }]}>
                {activeDay.title}
              </Text>
              <Text style={[styles.activeDaySubtitle, { color: theme.textSoft }]}>
                {activeDay.focus}
              </Text>
            </View>

            {activeDay.exercises.map((exercise) => {
              const workoutVideo = resolveWorkoutVideo(exercise);

              return (
              <View
                key={exercise.id}
                style={[
                  styles.exerciseCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.exerciseHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exerciseTitle, { color: theme.text }]}>
                      {exercise.name}
                    </Text>
                    <Text
                      style={[styles.exerciseMeta, { color: theme.textSoft }]}
                    >
                      {regionLabel(exercise.region, language)} • {exercise.sets} •{' '}
                      {exercise.reps}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.exerciseRestBadge,
                      { backgroundColor: theme.surfaceAlt },
                    ]}
                  >
                    <Text
                      style={[styles.exerciseRestText, { color: theme.textMuted }]}
                    >
                      {exercise.rest}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.videoPanel,
                    {
                      backgroundColor: theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <WorkoutVideoFrame exercise={exercise} theme={theme} />
                  <View style={styles.videoPanelText}>
                    <Text style={[styles.exerciseCue, { color: theme.text }]}>
                      {text.videoTitle}: {workoutVideo.title}
                    </Text>
                    <Text
                      style={[styles.exerciseInstruction, { color: theme.textSoft }]}
                    >
                      {exercise.animationCue}
                    </Text>
                    <Pressable
                      onPress={() =>
                        void Linking.openURL(workoutVideoWatchUrl(workoutVideo))
                      }
                      style={({ pressed }) => [
                        styles.collectionActionButton,
                        {
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          alignSelf: 'flex-start',
                        },
                        pressed && styles.scalePress,
                      ]}
                    >
                      <Text style={[styles.collectionActionText, { color: theme.text }]}>
                        {text.openVideo}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={[styles.exerciseSummary, { color: theme.textMuted }]}>
                  {exercise.summary}
                </Text>
                {exercise.instructions.map((instruction, index) => (
                  <Text
                    key={`${exercise.id}-${index}`}
                    style={[styles.exerciseInstruction, { color: theme.textSoft }]}
                  >
                    {index + 1}. {instruction}
                  </Text>
                ))}
              </View>
              );
            })}
          </ScrollView>

          <View style={styles.modalActionColumn}>
            {!isSaved ? (
              <HolographicButton label={text.savePlan} onPress={onSave} theme={theme} />
            ) : null}
            <Pressable
              onPress={onShare}
              style={({ pressed }) => [
                styles.secondaryWideButton,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
                pressed && styles.scalePress,
              ]}
            >
              <Ionicons
                name="share-social-outline"
                size={16}
                color={theme.text}
              />
              <Text style={[styles.secondaryPillButtonText, { color: theme.text }]}>
                {text.shareTitle}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AuthModal({
  visible,
  language,
  theme,
  onClose,
  onLogin,
  onRegister,
}: {
  visible: boolean;
  language: Language;
  theme: ThemePalette;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<void>;
}) {
  const text = textFor(language);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMode('login');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const submit = useCallback(async () => {
    try {
      setError(null);
      setSubmitting(true);
      if (mode === 'register' && password !== confirmPassword) {
        setError(text.passwordMismatch);
        return;
      }

      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(email, password, confirmPassword);
      }
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : text.authError);
    } finally {
      setSubmitting(false);
    }
  }, [
    confirmPassword,
    email,
    mode,
    onClose,
    onLogin,
    onRegister,
    password,
    text.authError,
    text.passwordMismatch,
  ]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {mode === 'login' ? text.login : text.register}
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <Text style={[styles.sheetSubtitle, { color: theme.textSoft }]}>
            {text.authSubtitle}
          </Text>

          <View style={styles.authSwitchRow}>
            <Pressable
              onPress={() => setMode('login')}
              style={[
                styles.authSwitchButton,
                {
                  backgroundColor:
                    mode === 'login' ? theme.accent : theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.authSwitchText,
                  {
                    color:
                      mode === 'login' ? theme.inverseText : theme.text,
                  },
                ]}
              >
                {text.login}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('register')}
              style={[
                styles.authSwitchButton,
                {
                  backgroundColor:
                    mode === 'register' ? theme.accent : theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.authSwitchText,
                  {
                    color:
                      mode === 'register' ? theme.inverseText : theme.text,
                  },
                ]}
              >
                {text.register}
              </Text>
            </Pressable>
          </View>

          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder={text.email}
            placeholderTextColor={theme.placeholder}
            style={[
              styles.sheetInput,
              {
                backgroundColor: theme.input,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
          />
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder={text.password}
            placeholderTextColor={theme.placeholder}
            style={[
              styles.sheetInput,
              {
                backgroundColor: theme.input,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
          />
          {mode === 'register' ? (
            <TextInput
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={text.confirmPassword}
              placeholderTextColor={theme.placeholder}
              style={[
                styles.sheetInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
            />
          ) : null}

          {error ? (
            <Text style={[styles.errorText, { color: '#E06B6B' }]}>{error}</Text>
          ) : null}

          <Pressable
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.primaryWideButton,
              { backgroundColor: theme.accent },
              pressed && styles.scalePress,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={theme.inverseText} />
            ) : (
              <Text
                style={[
                  styles.primaryWideButtonText,
                  { color: theme.inverseText },
                ]}
              >
                {mode === 'login' ? text.login : text.register}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ProfileModal({
  visible,
  user,
  theme,
  onClose,
  onSaveProfile,
  onChangePassword,
  onShareProfile,
  onOpenAdmin,
  onLogout,
}: {
  visible: boolean;
  user: UserAccount;
  theme: ThemePalette;
  onClose: () => void;
  onSaveProfile: (profile: Partial<UserProfile>) => Promise<void>;
  onChangePassword: (
    currentPassword: string,
    nextPassword: string,
    confirmPassword: string
  ) => Promise<void>;
  onShareProfile: () => void;
  onOpenAdmin?: () => void;
  onLogout: () => Promise<void>;
}) {
  const text = textFor(user.profile.language);
  const [displayName, setDisplayName] = useState(user.profile.displayName);
  const [language, setLanguage] = useState<Language>(user.profile.language);
  const [themeColor, setThemeColor] = useState<ThemeColor>(user.profile.themeColor);
  const [avatarColor, setAvatarColor] = useState<ProfileAvatarColor>(
    normalizeProfileAvatarColor(user.profile.avatarColor)
  );
  
  const [weight, setWeight] = useState(user.profile.weight ? String(user.profile.weight) : '');
  const [height, setHeight] = useState(user.profile.height ? String(user.profile.height) : '');
  const [age, setAge] = useState(user.profile.age ? String(user.profile.age) : '');
  const [gender, setGender] = useState<'male' | 'female'>(user.profile.gender === 'female' ? 'female' : 'male');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'active'>(
    user.profile.activityLevel || 'sedentary'
  );
  const [fitnessGoal, setFitnessGoal] = useState<'lose' | 'maintain' | 'gain' | 'muscle'>(
    user.profile.fitnessGoal || 'maintain'
  );

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setDisplayName(user.profile.displayName);
    setLanguage(user.profile.language);
    setThemeColor(user.profile.themeColor);
    setAvatarColor(normalizeProfileAvatarColor(user.profile.avatarColor));
    setWeight(user.profile.weight ? String(user.profile.weight) : '');
    setHeight(user.profile.height ? String(user.profile.height) : '');
    setAge(user.profile.age ? String(user.profile.age) : '');
    setGender(user.profile.gender === 'female' ? 'female' : 'male');
    setActivityLevel(user.profile.activityLevel || 'sedentary');
    setFitnessGoal(user.profile.fitnessGoal || 'maintain');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setProfileError(null);
    setPasswordError(null);
  }, [user, visible]);

  const saveProfile = useCallback(async () => {
    try {
      setSavingProfile(true);
      setProfileError(null);
      await onSaveProfile({
        displayName,
        language,
        themeColor,
        avatarColor,
        photoUri: undefined,
        weight: weight.trim() ? Number(weight) : undefined,
        height: height.trim() ? Number(height) : undefined,
        age: age.trim() ? Number(age) : undefined,
        gender,
        activityLevel,
        fitnessGoal,
      });
      Alert.alert(text.settingsTitle, text.profileSaved);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : text.authError);
    } finally {
      setSavingProfile(false);
    }
  }, [
    avatarColor,
    displayName,
    language,
    onSaveProfile,
    text.authError,
    text.profileSaved,
    text.settingsTitle,
    themeColor,
    weight,
    height,
    age,
    gender,
    activityLevel,
    fitnessGoal,
  ]);

  const updatePassword = useCallback(async () => {
    try {
      setSavingPassword(true);
      setPasswordError(null);
      await onChangePassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(text.changePassword, text.passwordChanged);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : text.authError);
    } finally {
      setSavingPassword(false);
    }
  }, [
    confirmPassword,
    currentPassword,
    newPassword,
    onChangePassword,
    text.authError,
    text.changePassword,
    text.passwordChanged,
  ]);

  const avatarPalette = profileAvatarPalette(avatarColor);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: theme.text }]}>
              {text.settingsTitle}
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.profileHeader}>
              <View
                style={[
                  styles.profileAvatarPlaceholder,
                  { backgroundColor: avatarPalette.color },
                ]}
              >
                <Text style={styles.profileAvatarInitials}>
                  {avatarInitials(user, text.guestName)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: theme.text }]}>
                  {displayName || user.email.split('@')[0]}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.textSoft }]}>
                  {user.email}
                </Text>
                <Text style={[styles.profileDate, { color: theme.textSoft }]}>
                  {text.memberSince}: {formatDate(user.createdAt, user.profile.language)}
                </Text>
              </View>
            </View>

            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.avatarColor}
            </Text>
            <View style={styles.avatarSwatchRow}>
              {PROFILE_AVATAR_OPTIONS.map((option) => {
                const selected = avatarColor === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setAvatarColor(option.key)}
                    style={[
                      styles.avatarSwatchButton,
                      {
                        backgroundColor: option.color,
                        borderColor: selected ? theme.text : theme.border,
                      },
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color="#111111" />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.language}
            </Text>
            <View style={styles.pillWrap}>
              {LANGUAGE_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setLanguage(option.key)}
                  style={[
                    styles.selectPill,
                    {
                      backgroundColor:
                        language === option.key ? theme.accent : theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectPillText,
                      {
                        color:
                          language === option.key ? theme.inverseText : theme.text,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.themeColor}
            </Text>
            <View style={styles.pillWrap}>
              {THEME_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setThemeColor(option)}
                  style={[
                    styles.colorPill,
                    {
                      backgroundColor:
                        themeColor === option ? theme.accent : theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.colorPreview,
                      {
                        backgroundColor:
                          option === 'obsidian' ? '#0A0A0A' : '#F4F0E7',
                        borderColor:
                          option === 'obsidian'
                            ? 'rgba(255,255,255,0.15)'
                            : 'rgba(17,17,17,0.12)',
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.selectPillText,
                      {
                        color:
                          themeColor === option ? theme.inverseText : theme.text,
                      },
                    ]}
                  >
                    {option === 'obsidian' ? text.themeObsidian : text.themeIvory}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Display Name Input */}
            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.displayName}
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={text.displayName}
              placeholderTextColor={theme.placeholder}
              style={[
                styles.sheetInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
            />

            {/* Age, Weight, Height Row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: theme.textMuted, marginBottom: 4 }]}>
                  {text.age}
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={age}
                  onChangeText={(val) => setAge(val.replace(/[^0-9]/g, ''))}
                  placeholder="25"
                  placeholderTextColor={theme.placeholder}
                  style={[
                    styles.sheetInput,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                      height: 40,
                    },
                  ]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: theme.textMuted, marginBottom: 4 }]}>
                  {text.weight}
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={(val) => setWeight(val.replace(/[^0-9.]/g, ''))}
                  placeholder="70"
                  placeholderTextColor={theme.placeholder}
                  style={[
                    styles.sheetInput,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                      height: 40,
                    },
                  ]}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.formLabel, { color: theme.textMuted, marginBottom: 4 }]}>
                  {text.height}
                </Text>
                <TextInput
                  keyboardType="numeric"
                  value={height}
                  onChangeText={(val) => setHeight(val.replace(/[^0-9]/g, ''))}
                  placeholder="175"
                  placeholderTextColor={theme.placeholder}
                  style={[
                    styles.sheetInput,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                      height: 40,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Gender Picker */}
            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.gender}
            </Text>
            <View style={styles.pillWrap}>
              <Pressable
                onPress={() => setGender('male')}
                style={[
                  styles.selectPill,
                  {
                    backgroundColor: gender === 'male' ? theme.accent : theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.selectPillText,
                    { color: gender === 'male' ? theme.inverseText : theme.text },
                  ]}
                >
                  {text.genderMale}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setGender('female')}
                style={[
                  styles.selectPill,
                  {
                    backgroundColor: gender === 'female' ? theme.accent : theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.selectPillText,
                    { color: gender === 'female' ? theme.inverseText : theme.text },
                  ]}
                >
                  {text.genderFemale}
                </Text>
              </Pressable>
            </View>

            {/* Activity Level Picker */}
            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.activityLevel}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillWrap}>
              {[
                { key: 'sedentary', label: text.activitySedentary },
                { key: 'light', label: text.activityLight },
                { key: 'moderate', label: text.activityModerate },
                { key: 'active', label: text.activityActive },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setActivityLevel(opt.key as any)}
                  style={[
                    styles.selectPill,
                    {
                      backgroundColor: activityLevel === opt.key ? theme.accent : theme.surfaceAlt,
                      borderColor: theme.border,
                      marginRight: 6,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectPillText,
                      { color: activityLevel === opt.key ? theme.inverseText : theme.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Fitness Goal Picker */}
            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.fitnessGoal}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillWrap}>
              {[
                { key: 'lose', label: text.goalLose },
                { key: 'maintain', label: text.goalMaintain },
                { key: 'gain', label: text.goalGain },
                { key: 'muscle', label: text.goalMuscle },
              ].map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setFitnessGoal(opt.key as any)}
                  style={[
                    styles.selectPill,
                    {
                      backgroundColor: fitnessGoal === opt.key ? theme.accent : theme.surfaceAlt,
                      borderColor: theme.border,
                      marginRight: 6,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectPillText,
                      { color: fitnessGoal === opt.key ? theme.inverseText : theme.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {profileError ? (
              <Text style={[styles.errorText, { color: '#E06B6B' }]}>
                {profileError}
              </Text>
            ) : null}

            <Text style={[styles.formLabel, { color: theme.textMuted }]}>
              {text.changePassword}
            </Text>
            <Text style={[styles.formHint, { color: theme.textSoft }]}>
              {text.changePasswordHint}
            </Text>
            <TextInput
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={text.currentPassword}
              placeholderTextColor={theme.placeholder}
              style={[
                styles.sheetInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
            />
            <TextInput
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={text.newPassword}
              placeholderTextColor={theme.placeholder}
              style={[
                styles.sheetInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
            />
            <TextInput
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={text.confirmPassword}
              placeholderTextColor={theme.placeholder}
              style={[
                styles.sheetInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
            />

            {passwordError ? (
              <Text style={[styles.errorText, { color: '#E06B6B' }]}>
                {passwordError}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void updatePassword()}
              style={[
                styles.lightButton,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              {savingPassword ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <Text style={[styles.lightButtonText, { color: theme.text }]}>
                  {text.changePassword}
                </Text>
              )}
            </Pressable>

            <View
              style={[
                styles.aboutCard,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {text.aboutTitle}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSoft }]}>
                {text.aboutSummary}
              </Text>
              <Text style={[styles.aboutLine, { color: theme.textMuted }]}>
                {text.aboutDateLabel}: {createdAtLabel(language)}
              </Text>
              <Text style={[styles.aboutLine, { color: theme.textMuted }]}>
                {text.aboutAuthorLabel}: {APP_AUTHOR}
              </Text>
              <Text style={[styles.aboutLine, { color: theme.textMuted }]}>
                {text.aboutThemeLabel}: {text.aboutThemeSummary}
              </Text>
              <View
                style={[
                  styles.updateInfoCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.updateInfoTitle, { color: theme.text }]}>
                  {text.updateTitle}
                </Text>
                <Text style={[styles.aboutLine, { color: theme.textMuted }]}>
                  {text.latestUpdateLabel}: {latestUpdateLabel(language)}
                </Text>
                <Text style={[styles.aboutLine, { color: theme.textMuted }]}>
                  {text.versionLabel}: {APP_VERSION}
                </Text>
                <Text style={[styles.aboutLine, { color: theme.textSoft }]}>
                  {text.latestUpdateSummary}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onShareProfile}
              style={({ pressed }) => [
                styles.lightButton,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
                pressed && styles.scalePress,
              ]}
            >
              <Text style={[styles.lightButtonText, { color: theme.text }]}>
                {text.profileShare}
              </Text>
            </Pressable>

            {user.role === 'admin' && onOpenAdmin ? (
              <Pressable
                onPress={onOpenAdmin}
                style={[
                  styles.lightButton,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.lightButtonText, { color: theme.text }]}>
                  {text.adminPanel}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={styles.modalButtonRow}>
            <Pressable
              onPress={() => void saveProfile()}
              style={({ pressed }) => [
                styles.saveSettingsButton,
                pressed && styles.scalePress,
              ]}
            >
              {savingProfile ? (
                <ActivityIndicator color="#071D12" />
              ) : (
                <Text style={styles.saveSettingsButtonText}>
                  {text.saveProfile}
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void onLogout()}
              style={({ pressed }) => [
                styles.darkButton,
                {
                  backgroundColor: theme.isDark ? '#FFFFFF' : '#111111',
                },
                pressed && styles.scalePress,
              ]}
            >
              <Text
                style={[
                  styles.darkButtonText,
                  { color: theme.isDark ? '#050505' : '#FFFFFF' },
                ]}
              >
                {text.logout}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AdminPanelModal({
  visible,
  language,
  theme,
  config,
  onClose,
  onSave,
}: {
  visible: boolean;
  language: Language;
  theme: ThemePalette;
  config: AppConfig;
  onClose: () => void;
  onSave: (config: AppConfig) => Promise<void>;
}) {
  const text = textFor(language);
  const [buttons, setButtons] = useState<AdminButton[]>(config.adminButtons);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setButtons(config.adminButtons);
      setLabel('');
      setUrl('');
      setError(null);
      setSaving(false);
    }
  }, [config, visible]);

  const addButton = useCallback(() => {
    const next = normalizeAdminButton({
      label,
      url,
      active: true,
    });
    if (!next.label || !/^https?:\/\//i.test(next.url)) {
      setError(text.adminButtonUrl);
      return;
    }
    setButtons((previous) => [next, ...previous].slice(0, 8));
    setLabel('');
    setUrl('');
    setError(null);
  }, [label, text.adminButtonUrl, url]);

  const save = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(normalizeAppConfig({ adminButtons: buttons }));
      Alert.alert(text.adminPanel, text.adminSaved);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : text.authError);
    } finally {
      setSaving(false);
    }
  }, [buttons, onClose, onSave, text.adminPanel, text.adminSaved, text.authError]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {text.adminPanel}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textSoft }]}>
                {text.adminOnly}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={text.adminButtonLabel}
              placeholderTextColor={theme.placeholder}
              style={[
                styles.sheetInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
            />
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://"
              placeholderTextColor={theme.placeholder}
              autoCapitalize="none"
              style={[
                styles.sheetInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
            />

            {error ? (
              <Text style={[styles.errorText, { color: '#E06B6B' }]}>{error}</Text>
            ) : null}

            <Pressable
              onPress={addButton}
              style={[
                styles.lightButton,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.lightButtonText, { color: theme.text }]}>
                {text.addButton}
              </Text>
            </Pressable>

            <View style={styles.adminList}>
              {buttons.map((button) => (
                <View
                  key={button.id}
                  style={[
                    styles.adminListItem,
                    {
                      backgroundColor: theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.collectionTitle, { color: theme.text }]}>
                      {button.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.collectionMetaText, { color: theme.textSoft }]}
                    >
                      {button.url}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      setButtons((previous) =>
                        previous.filter((item) => item.id !== button.id)
                      )
                    }
                    style={[
                      styles.circleIconButton,
                      {
                        backgroundColor: theme.card,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.text} />
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>

          <Pressable
            onPress={() => void save()}
            disabled={saving}
            style={({ pressed }) => [
              styles.primaryWideButton,
              { backgroundColor: saving ? theme.surfaceAlt : theme.accent },
              pressed && !saving && styles.scalePress,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <Text
                style={[
                  styles.primaryWideButtonText,
                  { color: theme.inverseText },
                ]}
              >
                {text.saveAdmin}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AppAssistantModal({
  visible,
  language,
  theme,
  messages,
  inputValue,
  busy,
  onChangeInput,
  onSend,
  onAskQuickQuestion,
  onClose,
}: {
  visible: boolean;
  language: Language;
  theme: ThemePalette;
  messages: AssistantMessage[];
  inputValue: string;
  busy: boolean;
  onChangeInput: (value: string) => void;
  onSend: (question?: string) => Promise<void>;
  onAskQuickQuestion: (question: string) => Promise<void>;
  onClose: () => void;
}) {
  const text = textFor(language);
  const quickQuestions = [text.quickUsage, text.quickAi, text.quickTheme];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {text.appTalkTitle}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textSoft }]}>
                {text.appTalkSubtitle}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.assistantMessages}
          >
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.assistantBubble,
                  message.role === 'user'
                    ? [
                        styles.assistantBubbleUser,
                        { backgroundColor: theme.accent },
                      ]
                    : [
                        styles.assistantBubbleAssistant,
                        {
                          backgroundColor: theme.surfaceAlt,
                          borderColor: theme.border,
                        },
                      ],
                ]}
              >
                <Text
                  style={[
                    styles.assistantBubbleText,
                    {
                      color:
                        message.role === 'user' ? theme.inverseText : theme.text,
                    },
                  ]}
                >
                  {message.content}
                </Text>
              </View>
            ))}

            {busy ? (
              <View
                style={[
                  styles.assistantBubble,
                  styles.assistantBubbleAssistant,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  },
                ]}
              >
                <ActivityIndicator color={theme.text} />
                <Text style={[styles.assistantBubbleText, { color: theme.text }]}>
                  {text.loadingAppChat}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.assistantQuickRow}>
            {quickQuestions.map((question) => (
              <Pressable
                key={question}
                onPress={() => void onAskQuickQuestion(question)}
                style={[
                  styles.assistantQuickChip,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.collectionActionText, { color: theme.text }]}>
                  {question}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.assistantInputRow}>
            <TextInput
              value={inputValue}
              onChangeText={onChangeInput}
              placeholder={text.appTalkPlaceholder}
              placeholderTextColor={theme.placeholder}
              style={[
                styles.assistantInput,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.inputBorder,
                  color: theme.text,
                },
              ]}
              editable={!busy}
              multiline
            />
            <Pressable
              onPress={() => void onSend()}
              disabled={busy}
              style={({ pressed }) => [
                styles.assistantSendButton,
                {
                  backgroundColor: busy ? theme.surfaceAlt : theme.accent,
                  borderColor: theme.border,
                },
                pressed && !busy && styles.scalePress,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.text} />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={busy ? theme.text : theme.inverseText}
                />
              )}
            </Pressable>
          </View>
          <Text style={[styles.helperText, { color: theme.textSoft }]}>
            {text.appTalkScope}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function NutritionHistoryModal({
  visible,
  language,
  theme,
  nutritionLog,
  onClose,
}: {
  visible: boolean;
  language: Language;
  theme: ThemePalette;
  nutritionLog: NutritionLogEntry[];
  onClose: () => void;
}) {
  const text = textFor(language);
  const today = localDateKey();
  const entries = nutritionLog.filter(
    (entry) =>
      entry.date !== today &&
      (entry.items.length ||
        entry.totals.protein ||
        entry.totals.carbs ||
        entry.totals.fat ||
        entry.totals.calories)
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View
          style={[
            styles.largeSheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>
                {text.nutritionHistory}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.textSoft }]}>
                {text.macroHint}
              </Text>
            </View>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {entries.length ? (
              entries.map((entry) => (
                <View
                  key={entry.date}
                  style={[
                    styles.nutritionHistoryCard,
                    {
                      backgroundColor: theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.collectionTitle, { color: theme.text }]}>
                    {formatDate(entry.date, language)}
                  </Text>
                  <View style={styles.nutritionHistoryGrid}>
                    {(Object.keys(MACRO_TARGETS) as MacroKey[]).map((macroKey) => (
                      <View key={`${entry.date}-${macroKey}`} style={styles.nutritionHistoryMetric}>
                        <Text style={[styles.recipeNutritionText, { color: theme.textSoft }]}>
                          {macroLabel(macroKey, language)}
                        </Text>
                        <Text style={[styles.collectionActionText, { color: theme.text }]}>
                          {macroValue(entry.totals[macroKey], macroKey, language)}
                        </Text>
                      </View>
                    ))}
                  </View>
                  {entry.items.slice(0, 4).map((item) => (
                    <Text
                      key={`${entry.date}-${item.id}-${item.completedAt}`}
                      style={[styles.collectionMetaText, { color: theme.textSoft }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                  ))}
                </View>
              ))
            ) : (
              <Text style={[styles.emptyStateText, { color: theme.textSoft }]}>
                {text.nutritionHistoryEmpty}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function HomeScreen({
  language,
  theme,
  user,
  latestPlan,
  macros,
  nutritionLog,
  onOpenKitchen,
  onOpenHealth,
  onOpenProfile,
  onOpenAssistant,
}: {
  language: Language;
  theme: ThemePalette;
  user: UserAccount | null;
  latestPlan: WorkoutPlan | null;
  macros: MacroTotals;
  nutritionLog: NutritionLogEntry[];
  onOpenKitchen: () => void;
  onOpenHealth: () => void;
  onOpenProfile: () => void;
  onOpenAssistant: () => void;
}) {
  const text = textFor(language);
  const personalizedTargets = getPersonalizedMacros(user?.profile);
  const [nutritionHistoryVisible, setNutritionHistoryVisible] = useState(false);
  const latestExercise = latestPlan?.days[0]?.exercises[0];
  const planSummary = cleanCardSummary(latestPlan?.summary);
  const kitchenCardTitle = text.kitchenFeatureTitle || text.kitchenLabel;
  const kitchenCardSummary = text.kitchenFeatureText || '';
  const sportCardTitle =
    latestPlan?.title || text.healthFeatureTitle || text.healthLabel;
  const sportCardSummary = planSummary || text.healthFeatureText || '';
  const glassBackground = theme.isDark
    ? 'rgba(61,61,55,0.58)'
    : theme.surface;
  const glassBackgroundStrong = theme.isDark
    ? 'rgba(52,52,47,0.72)'
    : theme.card;
  const glassBorder = theme.isDark
    ? 'rgba(255,255,255,0.58)'
    : theme.border;
  const glassBorderSoft = theme.isDark
    ? 'rgba(255,255,255,0.38)'
    : theme.border;
  const chipBackground = theme.isDark
    ? 'rgba(255,255,255,0.14)'
    : theme.chip;
  const heroTags = ['Web recipe', 'Round macros', 'Video workout'];

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenContent, styles.homeContent]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={onOpenProfile}
            style={({ pressed }) => [
              styles.avatarTapArea,
              pressed && styles.scalePress,
            ]}
          >
            <View
              style={[
                styles.avatarButton,
                {
                  backgroundColor: chipBackground,
                  borderColor: glassBorder,
                },
              ]}
            >
              {user?.profile.photoUri ? (
                <Image
                  source={{ uri: user.profile.photoUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person-outline" size={25} color={theme.text} />
              )}
            </View>
            {!user ? (
              <Text
                numberOfLines={1}
                style={[styles.avatarLoginLabel, { color: theme.textSoft }]}
              >
                {text.login}
              </Text>
            ) : null}
          </Pressable>

          <View style={styles.topGreetingWrap}>
            <Text style={[styles.topGreeting, { color: theme.text }]}>
              {text.homeGreeting}
            </Text>
            <Text
              style={[styles.topSubGreeting, { color: theme.textSoft }]}
            >
              {text.homeHeroSubtitle}
            </Text>
          </View>

          <Pressable
            onPress={onOpenAssistant}
            style={({ pressed }) => [
              styles.assistantTopButton,
              {
                backgroundColor: chipBackground,
                borderColor: glassBorder,
              },
              pressed && styles.scalePress,
            ]}
          >
            <Ionicons name="sparkles-outline" size={16} color={theme.text} />
            <Text style={[styles.collectionActionText, { color: theme.text }]}>
              {text.appTalk}
            </Text>
          </Pressable>
        </View>

        <LinearGradient
          colors={theme.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <ImageBackground
            source={HERO_IMAGE}
            style={styles.heroImage}
            imageStyle={styles.heroImageStyle}
          >
            <View
              style={[
                styles.heroOverlay,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(0,0,0,0.22)'
                    : 'rgba(0,0,0,0.16)',
                },
              ]}
            />
            <View style={styles.heroContent}>
              <Text
                numberOfLines={2}
                style={[styles.heroTitle, { color: theme.accentStrong }]}
              >
                {text.homeHeroTitle}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.heroSubtitle, { color: theme.chipText }]}
              >
                {text.homeHeroSubtitle}
              </Text>
              <View style={styles.heroChipRow}>
                {heroTags.map((tag) => (
                  <View
                    key={tag}
                    style={[
                      styles.heroChip,
                      { backgroundColor: 'rgba(255,255,255,0.16)' },
                    ]}
                  >
                    <Text style={[styles.heroChipText, { color: theme.chipText }]}>
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ImageBackground>
        </LinearGradient>

        <View
          style={[
            styles.homeNutritionCard,
            {
              backgroundColor: glassBackgroundStrong,
              borderColor: glassBorder,
            },
            shadowStyle(theme.shadow, SECTION_CARD_SHADOW),
          ]}
        >
          <View style={styles.homeSummaryHeader}>
            <Text
              numberOfLines={1}
              style={[styles.homeSummaryTitle, { color: theme.text }]}
            >
              {text.macroTitle}
            </Text>
            <Pressable
              onPress={() => setNutritionHistoryVisible(true)}
              style={({ pressed }) => [
                styles.homeMiniAction,
                {
                  backgroundColor: chipBackground,
                  borderColor: glassBorder,
                },
                pressed && styles.scalePress,
              ]}
            >
              <Text style={[styles.homeMiniActionText, { color: theme.text }]}>
                {text.nutritionHistoryButton}
              </Text>
            </Pressable>
          </View>
          <View style={styles.macroRow}>
            {(Object.keys(MACRO_TARGETS) as MacroKey[]).map((macroKey) => (
              <MacroOrb
                key={macroKey}
                macroKey={macroKey}
                value={macros[macroKey]}
                target={personalizedTargets[macroKey]}
                language={language}
                theme={theme}
              />
            ))}
          </View>
        </View>

        <View style={styles.featureRow}>
          <Pressable
            onPress={onOpenKitchen}
            style={({ pressed }) => [
              styles.featureCard,
              {
                backgroundColor: glassBackground,
                borderColor: glassBorder,
              },
              shadowStyle(theme.shadow, FEATURE_CARD_SHADOW),
            pressed && styles.scalePress,
          ]}
        >
            <SmartImage
              sourceUri={recipeArtworkUrl(
                { title: kitchenCardTitle, ingredients: [] },
                language
              )}
              fallbackSource={recipeArtworkSource(
                { title: kitchenCardTitle, ingredients: [] },
                language
              )}
              style={styles.featureCardImage}
            />
            <Text style={[styles.featureLabel, { color: theme.text }]}>
              {text.kitchenLabel}
            </Text>
            <Text
              numberOfLines={3}
              style={[styles.featureTitle, { color: theme.text }]}
            >
              {kitchenCardTitle}
            </Text>
            {kitchenCardSummary ? (
              <Text
                numberOfLines={4}
                style={[styles.featureSummary, { color: theme.text }]}
              >
                {kitchenCardSummary}
              </Text>
            ) : null}
            <View style={styles.featureSpacer} />
            <View
              style={[
                styles.featureRoundAction,
                { backgroundColor: theme.accent, borderColor: glassBorderSoft },
              ]}
            >
              <Text style={[styles.collectionActionText, { color: theme.inverseText }]}>
                {text.openAssistant}
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={onOpenHealth}
            style={({ pressed }) => [
              styles.featureCard,
              {
                backgroundColor: glassBackground,
                borderColor: glassBorder,
              },
              shadowStyle(theme.shadow, FEATURE_CARD_SHADOW),
              pressed && styles.scalePress,
            ]}
          >
            <WorkoutVideoThumb
              exercise={latestExercise}
              motionStyle={latestExercise?.motionStyle || 'press'}
              theme={theme}
              style={styles.featureCardImage}
              openVideo={false}
            />
            <Text style={[styles.featureLabel, { color: theme.text }]}>
              {text.healthLabel}
            </Text>
            <Text
              numberOfLines={3}
              style={[styles.featureTitle, { color: theme.text }]}
            >
              {sportCardTitle}
            </Text>
            {sportCardSummary ? (
              <Text
                numberOfLines={4}
                style={[styles.featureSummary, { color: theme.text }]}
              >
                {sportCardSummary}
              </Text>
            ) : null}
            <View style={styles.featureSpacer} />
            <View
              style={[
                styles.featureRoundAction,
                { backgroundColor: theme.accent, borderColor: glassBorderSoft },
              ]}
            >
              <Text style={[styles.collectionActionText, { color: theme.inverseText }]}>
                {text.openAssistant}
              </Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <NutritionHistoryModal
        visible={nutritionHistoryVisible}
        language={language}
        theme={theme}
        nutritionLog={nutritionLog}
        onClose={() => setNutritionHistoryVisible(false)}
      />
    </View>
  );
}

function KitchenScreen({
  language,
  theme,
  recommendations,
  isRefreshing,
  recommendationError,
  favorites,
  history,
  onBack,
  onOpenRecipe,
  onGenerateRecipe,
  onUpdateFavoriteNote,
  onShareRecipe,
  onRefreshRecommendations,
}: {
  language: Language;
  theme: ThemePalette;
  recommendations: Recipe[];
  isRefreshing: boolean;
  recommendationError: string | null;
  favorites: Recipe[];
  history: Recipe[];
  onBack: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onGenerateRecipe: (ingredientsText: string) => Promise<void>;
  onUpdateFavoriteNote: (recipeId: string, note: string) => void;
  onShareRecipe: (recipe: Recipe) => void;
  onRefreshRecommendations: () => void;
}) {
  const text = textFor(language);
  const [ingredients, setIngredients] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [favoritesVisible, setFavoritesVisible] = useState(false);

  const submit = useCallback(async () => {
    if (!ingredients.trim()) {
      setError(text.emptyIngredients);
      return;
    }

    try {
      setError(null);
      setIsGenerating(true);
      await onGenerateRecipe(ingredients);
      setIngredients('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : text.authError);
    } finally {
      setIsGenerating(false);
    }
  }, [ingredients, onGenerateRecipe, text.authError, text.emptyIngredients]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={onBack}
            style={[
              styles.circleIconButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <Text style={[styles.screenTitle, { color: theme.text }]}>
            {text.kitchenScreenTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            shadowStyle(theme.shadow, SECTION_CARD_SHADOW),
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {text.kitchenGuideTitle}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSoft }]}>
            {text.kitchenGuideText}
          </Text>
        </View>

        <View
          style={[
            styles.inputCard,
            styles.kitchenInputCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
            shadowStyle(theme.shadow, SECTION_CARD_SHADOW),
          ]}
        >
          <Text style={[styles.inputLabel, { color: theme.textSoft }]}>
            {text.pantryTitle}
          </Text>
          <TextInput
            value={ingredients}
            onChangeText={setIngredients}
            placeholder={text.pantryPlaceholder}
            placeholderTextColor={theme.placeholder}
            style={[
              styles.heroInput,
              styles.kitchenHeroInput,
              {
                backgroundColor: theme.input,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            multiline
          />
          {error ? (
            <Text style={[styles.errorText, { color: '#E06B6B' }]}>{error}</Text>
          ) : null}
          <HolographicButton label={text.generateAi} onPress={() => void submit()} busy={isGenerating} theme={theme} />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {text.recommendedRecipes}
          </Text>
          <Pressable onPress={onRefreshRecommendations} style={styles.inlineLinkButton}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={theme.text} />
            ) : (
              <Text style={[styles.inlineLinkText, { color: theme.text }]}>
                {text.refresh}
              </Text>
            )}
          </Pressable>
        </View>

        {recommendationError ? (
          <Text style={[styles.errorText, { color: '#E06B6B' }]}>
            {recommendationError}
          </Text>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalCardRow}
        >
          {recommendations.map((recipe, index) => (
            <View
              key={`${recipe.id}-${index}`}
              style={[
                styles.recipeCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <SmartImage
                sourceUri={recipeDisplayImageUri(recipe, language)}
                fallbackSource={recipeArtworkSource(recipe, language)}
                style={styles.recipeImage}
              />
              <Text style={[styles.recipeLabel, { color: theme.textSoft }]}>
                {recipeSourceLabel(recipe, language)}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.recipeTitle, { color: theme.text }]}
              >
                {recipe.title}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.recipeSummary, { color: theme.textSoft }]}
              >
                {cleanCardSummary(recipe.summary) || recipe.cookTime || ''}
              </Text>
              <View style={styles.recipeNutritionRow}>
                <Text style={[styles.recipeNutritionText, { color: theme.textSoft }]}>
                  {recipe.nutrition?.protein || '0 g'}
                </Text>
                <Text style={[styles.recipeNutritionText, { color: theme.textSoft }]}>
                  {recipe.calories || '0 kcal'}
                </Text>
              </View>
              <Pressable
                onPress={() => onOpenRecipe(recipe)}
                style={({ pressed }) => [
                  styles.darkActionButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.scalePress,
                ]}
              >
                <Text
                  style={[
                    styles.darkActionText,
                    { color: theme.inverseText },
                  ]}
                >
                  {text.detail}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <View style={styles.collectionRow}>
          <Pressable
            onPress={() => setFavoritesVisible(true)}
            style={({ pressed }) => [
              styles.collectionCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              pressed && styles.scalePress,
            ]}
          >
            <RecipeMosaic recipes={favorites} language={language} theme={theme} />
            <Text style={[styles.collectionHeading, { color: theme.text }]}>
              {text.favoriteTitle}
            </Text>
            <Text style={[styles.collectionCount, { color: theme.text }]}>
              {favorites.length}
            </Text>
            <Text
              style={[styles.collectionPreviewText, { color: theme.textSoft }]}
              numberOfLines={3}
            >
              {favorites.length
                ? favorites.slice(0, 3).map((recipe) => recipe.title).join('\n')
                : text.emptyFavorites}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setHistoryVisible(true)}
            style={({ pressed }) => [
              styles.collectionCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              pressed && styles.scalePress,
            ]}
          >
            <RecipeMosaic recipes={history} language={language} theme={theme} />
            <Text style={[styles.collectionHeading, { color: theme.text }]}>
              {text.historyTitle}
            </Text>
            <Text style={[styles.collectionCount, { color: theme.text }]}>
              {history.length}
            </Text>
            <Text
              style={[styles.collectionPreviewText, { color: theme.textSoft }]}
              numberOfLines={3}
            >
              {history.length
                ? history.slice(0, 3).map((recipe) => recipe.title).join('\n')
                : text.emptyHistory}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <RecipeCollectionModal
        visible={favoritesVisible}
        title={text.favoriteTitle}
        recipes={favorites}
        editableNotes
        language={language}
        theme={theme}
        onClose={() => setFavoritesVisible(false)}
        onSelect={onOpenRecipe}
        onShare={onShareRecipe}
        onNoteChange={onUpdateFavoriteNote}
      />
      <RecipeCollectionModal
        visible={historyVisible}
        title={text.historyTitle}
        recipes={history}
        language={language}
        theme={theme}
        onClose={() => setHistoryVisible(false)}
        onSelect={onOpenRecipe}
        onShare={onShareRecipe}
      />
    </View>
  );
}

function HealthScreen({
  language,
  theme,
  savedPlans,
  onBack,
  onGeneratePlan,
  onOpenPlan,
}: {
  language: Language;
  theme: ThemePalette;
  savedPlans: WorkoutPlan[];
  onBack: () => void;
  onGeneratePlan: (
    goalText: string,
    duration: PlanDuration,
    regions: BodyRegion[]
  ) => Promise<WorkoutPlan>;
  onOpenPlan: (plan: WorkoutPlan) => void;
}) {
  const text = textFor(language);
  const [goalText, setGoalText] = useState('');
  const [duration, setDuration] = useState<PlanDuration>('weekly');
  const [regions, setRegions] = useState<BodyRegion[]>(['chest', 'triceps', 'back']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestGenerated, setLatestGenerated] = useState<WorkoutPlan | null>(
    savedPlans[0] ?? null
  );

  useEffect(() => {
    if (!latestGenerated && savedPlans.length) {
      setLatestGenerated(savedPlans[0]);
    }
  }, [latestGenerated, savedPlans]);

  const toggleRegion = useCallback((region: BodyRegion) => {
    setRegions((previous) =>
      previous.includes(region)
        ? previous.filter((item) => item !== region)
        : [...previous, region]
    );
  }, []);

  const durationLabel = useCallback(
    (value: PlanDuration) =>
      value === 'daily' ? text.daily : value === 'weekly' ? text.weekly : text.monthly,
    [text.daily, text.monthly, text.weekly]
  );

  const submit = useCallback(async () => {
    try {
      setError(null);
      setIsGenerating(true);
      const plan = await onGeneratePlan(goalText, duration, regions);
      setLatestGenerated(plan);
      onOpenPlan(plan);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : text.authError);
    } finally {
      setIsGenerating(false);
    }
  }, [duration, goalText, onGeneratePlan, onOpenPlan, regions, text.authError]);

  const latestExercise = latestGenerated?.days[0]?.exercises[0];
  const dayCount = latestGenerated?.days.length ?? 0;
  const exerciseCount =
    latestGenerated?.days.reduce(
      (total, day) => total + day.exercises.length,
      0
    ) ?? 0;
  const selectedRegionLabel = regions.length
    ? regions.map((region) => regionLabel(region, language)).join(' / ')
    : text.coachFocus;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={onBack}
            style={[
              styles.circleIconButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </Pressable>
          <Text style={[styles.screenTitle, { color: theme.text }]}>
            {text.healthScreenTitle}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View
          style={[
            styles.coachBentoCard,
            styles.coachComposerCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
            },
            shadowStyle(theme.shadow, SECTION_CARD_SHADOW),
          ]}
        >
          <View style={styles.coachBentoHeader}>
            <Ionicons name="pulse-outline" size={18} color={theme.text} />
            <Text style={[styles.coachBentoTitle, { color: theme.text }]}>
              {text.workoutGoal}
            </Text>
          </View>
          <Text style={[styles.coachHeroSubtitle, { color: theme.textSoft }]}>
            {text.healthCoachSubtitle}
          </Text>
          <TextInput
            value={goalText}
            onChangeText={setGoalText}
            placeholder={text.workoutGoalPlaceholder}
            placeholderTextColor={theme.placeholder}
            style={[
              styles.coachInput,
              styles.coachInputCompact,
              {
                backgroundColor: theme.input,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            multiline
          />

          <Text style={[styles.coachInlineLabel, { color: theme.textSoft }]}>
            {text.duration}
          </Text>
          <View style={styles.coachDurationRow}>
            {(['daily', 'weekly', 'monthly'] as PlanDuration[]).map((option) => {
              const selected = duration === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setDuration(option)}
                  style={[
                    styles.coachSegmentButton,
                    styles.coachDurationButton,
                    {
                      backgroundColor: selected ? theme.accent : theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.coachSegmentText,
                      { color: selected ? theme.inverseText : theme.text },
                    ]}
                  >
                    {durationLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.coachSelectedRow}>
            <Text style={[styles.coachInlineLabel, { color: theme.textSoft }]}>
              {text.regions}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.coachSelectedText, { color: theme.text }]}
            >
              {selectedRegionLabel}
            </Text>
          </View>
          <View style={styles.coachRegionGrid}>
            {BODY_REGIONS.map((region) => {
              const selected = regions.includes(region);
              return (
                <Pressable
                  key={region}
                  onPress={() => toggleRegion(region)}
                  style={({ pressed }) => [
                    styles.coachRegionTile,
                    {
                      backgroundColor: selected ? theme.accent : theme.surfaceAlt,
                      borderColor: theme.border,
                    },
                    pressed && styles.scalePress,
                  ]}
                >
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={selected ? theme.inverseText : theme.textSoft}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.coachRegionText,
                      { color: selected ? theme.inverseText : theme.text },
                    ]}
                  >
                    {regionLabel(region, language)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {error ? (
            <Text style={[styles.errorText, { color: '#E06B6B' }]}>{error}</Text>
          ) : null}
          <HolographicButton label={text.generatePlan} onPress={() => void submit()} busy={isGenerating} theme={theme} />
        </View>

        {latestGenerated ? (
          <View
            style={[
              styles.coachResultCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
              shadowStyle(theme.shadow, SECTION_CARD_SHADOW),
            ]}
          >
            <View style={styles.coachResultTop}>
              <View style={styles.coachResultCopy}>
                <Text style={[styles.recipeLabel, { color: theme.textSoft }]}>
                  {text.latestPlan}
                </Text>
                <Text style={[styles.planTitle, { color: theme.text }]}>
                  {latestGenerated.title}
                </Text>
                {cleanCardSummary(latestGenerated.summary) ? (
                  <Text style={[styles.planSummary, { color: theme.textSoft }]}>
                    {cleanCardSummary(latestGenerated.summary)}
                  </Text>
                ) : null}
              </View>
              <WorkoutVideoThumb
                exercise={latestExercise}
                motionStyle={latestExercise?.motionStyle || 'press'}
                theme={theme}
                style={styles.coachResultVideo}
              />
            </View>
            <View style={styles.coachPlanStats}>
              <View
                style={[
                  styles.coachPlanStat,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.coachMetricValue, { color: theme.text }]}>
                  {dayCount}
                </Text>
                <Text style={[styles.coachMetricLabel, { color: theme.textSoft }]}>
                  {text.duration}
                </Text>
              </View>
              <View
                style={[
                  styles.coachPlanStat,
                  {
                    backgroundColor: theme.surfaceAlt,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.coachMetricValue, { color: theme.text }]}>
                  {exerciseCount}
                </Text>
                <Text style={[styles.coachMetricLabel, { color: theme.textSoft }]}>
                  {text.coachLoad}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => onOpenPlan(latestGenerated)}
              style={[
                styles.coachSecondaryButton,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons name="open-outline" size={16} color={theme.text} />
              <Text style={[styles.lightButtonText, { color: theme.text }]}>
                {text.openPlan}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.coachEmptyCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="sparkles-outline" size={20} color={theme.textSoft} />
            <Text style={[styles.emptyStateText, { color: theme.textSoft }]}>
              {text.coachNoPlan}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          {text.savedPlans}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalCardRow}
        >
          {savedPlans.length ? (
            savedPlans.map((plan) => (
              <Pressable
                key={plan.id}
                onPress={() => onOpenPlan(plan)}
                style={({ pressed }) => [
                  styles.planCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                  pressed && styles.scalePress,
                ]}
              >
                <WorkoutVideoThumb
                  exercise={plan.days[0]?.exercises[0]}
                  motionStyle={plan.days[0]?.exercises[0]?.motionStyle || 'press'}
                  theme={theme}
                  style={styles.planCardVideo}
                  openVideo={false}
                />
                <Text style={[styles.recipeLabel, { color: theme.textSoft }]}>
                  {text.latestPlan}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[styles.planCardTitle, { color: theme.text }]}
                >
                  {plan.title}
                </Text>
                <Text
                  numberOfLines={3}
                  style={[styles.planCardSummary, { color: theme.textSoft }]}
                >
                  {plan.summary}
                </Text>
                <Text style={[styles.planCardMeta, { color: theme.textSoft }]}>
                  {formatDate(plan.createdAt, language)}
                </Text>
              </Pressable>
            ))
          ) : (
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.emptyStateText, { color: theme.textSoft }]}>
                {text.emptyPlans}
              </Text>
            </View>
          )}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

export default function App() {
  const window = useWindowDimensions();
  const [screen, setScreen] = useState<Screen>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [latestRecipe, setLatestRecipe] = useState<Recipe | null>(null);
  const [history, setHistory] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Recipe[]>([]);
  const [recommendations, setRecommendations] = useState<Recipe[]>([]);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [consumedMacros, setConsumedMacros] = useState<MacroTotals>(emptyMacros());
  const [nutritionLog, setNutritionLog] = useState<NutritionLogEntry[]>([]);
  const [currentNutritionDate, setCurrentNutritionDate] = useState(localDateKey());
  const [savedWorkoutPlans, setSavedWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [appConfig, setAppConfig] = useState<AppConfig>(EMPTY_APP_CONFIG);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [aiVariantsVisible, setAiVariantsVisible] = useState(false);
  const [aiVariants, setAiVariants] = useState<AiRecipeVariant[]>([]);
  const [aiVariantsLoading, setAiVariantsLoading] = useState(false);
  const [aiVariantsError, setAiVariantsError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);
  const [adminVisible, setAdminVisible] = useState(false);
  const [assistantVisible, setAssistantVisible] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [operationState, setOperationState] = useState<OperationState>({
    visible: false,
    label: '',
    progress: 0,
  });
  const hideProgressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRecipeSearchId = useRef(0);
  const [remoteDataReady, setRemoteDataReady] = useState(false);

  const effectiveLanguage = session?.user.profile.language ?? 'tr';
  const effectiveTheme = normalizeThemeColor(
    session?.user.profile.themeColor ?? 'obsidian'
  );
  const theme = resolveThemePalette(effectiveTheme);
  const text = textFor(effectiveLanguage);
  const personalizedTargets = useMemo(() => {
    return getPersonalizedMacros(session?.user?.profile);
  }, [session?.user?.profile]);
  const userData = useMemo<UserDataPayload>(
    () => ({
      latestRecipe,
      history,
      favorites,
      consumedMacros,
      nutritionLog,
      savedWorkoutPlans,
    }),
    [consumedMacros, favorites, history, latestRecipe, nutritionLog, savedWorkoutPlans]
  );
  const latestPlan = savedWorkoutPlans[0] ?? null;
  const isSelectedRecipeFavorite = selectedRecipe
    ? favorites.some((recipe) => recipe.id === selectedRecipe.id)
    : false;
  const isSelectedPlanSaved = selectedPlan
    ? savedWorkoutPlans.some((plan) => plan.id === selectedPlan.id)
    : false;

  useEffect(() => {
    return () => {
      if (hideProgressTimeout.current) {
        clearTimeout(hideProgressTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    setAssistantMessages([
      {
        id: `assistant-intro-${effectiveLanguage}`,
        role: 'assistant',
        content: text.appTalkScope,
      },
    ]);
  }, [effectiveLanguage, text.appTalkScope]);

  const runWithProgress = useCallback(
    async <T,>(label: string, task: () => Promise<T>): Promise<T> => {
      const checkpoints = [0.12, 0.24, 0.38, 0.54, 0.68, 0.8, 0.9];
      let index = 0;
      const startedAt = Date.now();
      const minimumVisibleMs = 920;
      setOperationState({ visible: true, label, progress: 0.08 });

      const interval = setInterval(() => {
        setOperationState((previous) => {
          if (!previous.visible) {
            return previous;
          }
          const next = checkpoints[Math.min(index, checkpoints.length - 1)];
          index += 1;
          return { ...previous, progress: Math.max(previous.progress, next) };
        });
      }, 260);

      try {
        const result = await task();
        const remainingMs = Math.max(
          0,
          minimumVisibleMs - (Date.now() - startedAt)
        );
        if (remainingMs) {
          await new Promise((resolve) => setTimeout(resolve, remainingMs));
        }
        setOperationState((previous) => ({
          ...previous,
          visible: true,
          label,
          progress: 1,
        }));
        await new Promise((resolve) => setTimeout(resolve, 180));
        return result;
      } finally {
        clearInterval(interval);
        if (hideProgressTimeout.current) {
          clearTimeout(hideProgressTimeout.current);
        }
        hideProgressTimeout.current = setTimeout(() => {
          setOperationState({ visible: false, label: '', progress: 0 });
        }, 120);
      }
    },
    []
  );

  const applyRemoteState = useCallback((data: UserDataPayload) => {
    const nextLog = normalizeNutritionLog(data.nutritionLog);
    const legacyMacros = normalizeMacroTotals(data.consumedMacros);
    const hasLegacyMacros =
      legacyMacros.protein ||
      legacyMacros.carbs ||
      legacyMacros.fat ||
      legacyMacros.calories;
    const seededLog =
      nextLog.length || !hasLegacyMacros
        ? nextLog
        : [
            {
              date: localDateKey(),
              totals: legacyMacros,
              items: [],
            },
          ];

    setLatestRecipe(data.latestRecipe);
    setHistory(data.history);
    setFavorites(data.favorites);
    setNutritionLog(seededLog);
    setCurrentNutritionDate(localDateKey());
    setConsumedMacros(macrosForDate(seededLog));
    setSavedWorkoutPlans(data.savedWorkoutPlans);
  }, []);

  const clearGuestData = useCallback(() => {
    setLatestRecipe(null);
    setHistory([]);
    setFavorites([]);
    setConsumedMacros(emptyMacros());
    setNutritionLog([]);
    setCurrentNutritionDate(localDateKey());
    setSavedWorkoutPlans([]);
  }, []);

  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
    setRecommendationError(null);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void fetchAppConfig().then(setAppConfig);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const nextDate = localDateKey();
      if (nextDate !== currentNutritionDate) {
        setCurrentNutritionDate(nextDate);
        setConsumedMacros(macrosForDate(nutritionLog, nextDate));
      }
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, [currentNutritionDate, nutritionLog]);

  useEffect(() => {
    if (!session || !remoteDataReady) {
      return;
    }

    const timeout = setTimeout(() => {
      void apiRequest('/api/user/data', {
        method: 'PUT',
        body: userData,
        token: session.token,
      }).catch(() => undefined);
    }, 350);

    return () => clearTimeout(timeout);
  }, [remoteDataReady, session, userData]);

  const openRecipe = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setAiVariantsVisible(false);
    setAiVariants([]);
    setAiVariantsError(null);
  }, []);

  const askRecipeShare = useCallback(
    (recipe: Recipe) => {
      setSharePayload({
        title: recipe.title,
        message: recipeShareMessage(recipe, effectiveLanguage),
      });
      setShareVisible(true);
    },
    [effectiveLanguage]
  );

  const askProfileShare = useCallback(() => {
    if (!session) {
      return;
    }
    setSharePayload({
      title: session.user.profile.displayName || session.user.email,
      message: profileShareMessage(session.user, userData, effectiveLanguage),
    });
    setShareVisible(true);
  }, [effectiveLanguage, session, userData]);

  const askWorkoutPlanShare = useCallback(
    (plan: WorkoutPlan) => {
      setSharePayload({
        title: plan.title,
        message: workoutPlanShareMessage(plan, effectiveLanguage),
      });
      setShareVisible(true);
    },
    [effectiveLanguage]
  );

  const onGenerateRecipe = useCallback(
    async (ingredientsText: string) => {
      const searchText = ingredientsText.trim();
      const requestId = latestRecipeSearchId.current + 1;
      latestRecipeSearchId.current = requestId;
      setRecommendationError(null);
      setRecommendations([]);

      await runWithProgress(text.loadingRecipe, async () => {
        const recipe = await generateRecipe(searchText, effectiveLanguage);
        if (latestRecipeSearchId.current !== requestId) {
          return;
        }

        openRecipe(recipe);
        const searchRecommendations = await fetchSearchRecommendations(
          searchText,
          effectiveLanguage,
          recipe
        );
        if (latestRecipeSearchId.current !== requestId) {
          return;
        }

        setRecommendations(searchRecommendations);
        setRecommendationError(null);
      });
    },
    [effectiveLanguage, openRecipe, runWithProgress, text.loadingRecipe]
  );

  const loadAiVariantsForRecipe = useCallback(
    async (recipe: Recipe) => {
      const ingredientsSeed = recipe.ingredients.length
        ? recipe.ingredients.join(', ')
        : recipe.title;

      setAiVariantsVisible(true);
      setAiVariantsLoading(true);
      setAiVariantsError(null);
      setAiVariants([]);

      try {
        const variants = await runWithProgress(text.loadingAiVariants, () =>
          fetchRecipeVariants(ingredientsSeed, effectiveLanguage)
        );
        setAiVariants(variants);
        const hasResult = variants.some((variant) => Boolean(variant.recipe));
        if (!hasResult) {
          setAiVariantsError(text.aiVariantsEmpty);
        }
      } catch {
        setAiVariantsError(text.authError);
      } finally {
        setAiVariantsLoading(false);
      }
    },
    [effectiveLanguage, runWithProgress, text.aiVariantsEmpty, text.authError, text.loadingAiVariants]
  );

  const openAiVariantsForSelectedRecipe = useCallback(() => {
    if (!selectedRecipe) {
      return;
    }
    void loadAiVariantsForRecipe(selectedRecipe);
  }, [loadAiVariantsForRecipe, selectedRecipe]);

  const applyAiVariantRecipe = useCallback((recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setAiVariantsVisible(false);
  }, []);

  const markRecipeDone = useCallback((recipe: Recipe) => {
    const completedRecipe = {
      ...recipe,
      completedAt: new Date().toISOString(),
    };
    setLatestRecipe(completedRecipe);
    setHistory((previous) => [
      completedRecipe,
      ...previous.filter((item) => item.id !== completedRecipe.id),
    ]);
    setNutritionLog((previous) =>
      addRecipeToNutritionLog(previous, completedRecipe, currentNutritionDate)
    );
    setConsumedMacros((previous) =>
      addMacros(previous, macroTotalsFromRecipe(completedRecipe))
    );
    setSelectedRecipe(null);
    setAiVariantsVisible(false);
  }, [currentNutritionDate]);

  const toggleFavorite = useCallback((recipe: Recipe) => {
    setFavorites((previous) => {
      const exists = previous.some((item) => item.id === recipe.id);
      if (exists) {
        return previous.filter((item) => item.id !== recipe.id);
      }
      return [
        {
          ...recipe,
          note: recipe.note ?? '',
          savedAt: new Date().toISOString(),
        },
        ...previous,
      ];
    });
  }, []);

  const updateFavoriteNote = useCallback((recipeId: string, note: string) => {
    setFavorites((previous) =>
      previous.map((recipe) => (recipe.id === recipeId ? { ...recipe, note } : recipe))
    );
    setSelectedRecipe((previous) =>
      previous?.id === recipeId ? { ...previous, note } : previous
    );
  }, []);

  const generatePlanForUser = useCallback(
    async (
      goalText: string,
      duration: PlanDuration,
      regions: BodyRegion[]
    ) => {
      return runWithProgress(text.loadingPlan, () =>
        generateWorkoutPlan(goalText, duration, regions, effectiveLanguage)
      );
    },
    [effectiveLanguage, runWithProgress, text.loadingPlan]
  );

  const saveWorkoutPlan = useCallback(
    (plan: WorkoutPlan) => {
      setSavedWorkoutPlans((previous) => [
        plan,
        ...previous.filter((item) => item.id !== plan.id),
      ]);
      Alert.alert(text.saveSuccess, text.planSavedText);
    },
    [text.planSavedText, text.saveSuccess]
  );

  const openPlan = useCallback((plan: WorkoutPlan) => {
    setSelectedPlan(plan);
  }, []);

  const requireAuth = useCallback(() => {
    if (!session) {
      Alert.alert(text.loginRequired, text.loginRequiredText);
      setAuthVisible(true);
      return false;
    }
    return true;
  }, [session, text.loginRequired, text.loginRequiredText]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiRequest<{
        token: string;
        user: UserAccount;
        data: UserDataPayload;
      }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      setSession({ token: data.token, user: data.user });
      applyRemoteState(data.data);
      setRemoteDataReady(true);
    },
    [applyRemoteState]
  );

  const register = useCallback(
    async (email: string, password: string, confirmPassword: string) => {
      const data = await apiRequest<{
        token: string;
        user: UserAccount;
        data: UserDataPayload;
      }>('/api/auth/register', {
        method: 'POST',
        body: { email, password, confirmPassword, language: effectiveLanguage },
      });
      setSession({ token: data.token, user: data.user });
      applyRemoteState(data.data);
      setRemoteDataReady(true);
    },
    [applyRemoteState, effectiveLanguage]
  );

  const logout = useCallback(async () => {
    if (session) {
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          token: session.token,
        });
      } catch {}
    }
    setSession(null);
    setRemoteDataReady(false);
    clearGuestData();
    setProfileVisible(false);
    setAdminVisible(false);
    setScreen('home');
  }, [clearGuestData, session]);

  const saveProfile = useCallback(
    async (profile: Partial<UserProfile>) => {
      if (!session) {
        return;
      }
      const response = await apiRequest<{ user: UserAccount }>('/api/user/profile', {
        method: 'PUT',
        body: { profile },
        token: session.token,
      });
      setSession((previous) =>
        previous ? { ...previous, user: response.user } : previous
      );
    },
    [session]
  );

  const changePassword = useCallback(
    async (
      currentPassword: string,
      nextPassword: string,
      confirmPassword: string
    ) => {
      if (!session) {
        return;
      }
      await apiRequest('/api/user/change-password', {
        method: 'POST',
        body: { currentPassword, nextPassword, confirmPassword },
        token: session.token,
      });
    },
    [session]
  );

  const saveAppConfig = useCallback(
    async (config: AppConfig) => {
      if (!session || session.user.role !== 'admin') {
        throw new Error(text.adminOnly);
      }
      const saved = await saveRemoteAppConfig(config, session.token);
      setAppConfig(saved);
    },
    [session, text.adminOnly]
  );

  const openProfileEntry = useCallback(() => {
    if (!session) {
      setAuthVisible(true);
      return;
    }
    setProfileVisible(true);
  }, [session]);

  const sendAssistantQuestion = useCallback(
    async (incomingQuestion?: string) => {
      const question = (incomingQuestion ?? assistantInput).trim();
      if (!question || assistantBusy) {
        return;
      }

      setAssistantMessages((previous) => [
        ...previous,
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: question,
        },
      ]);
      setAssistantInput('');
      setAssistantBusy(true);

      try {
        const answer = await runWithProgress(text.loadingAppChat, () =>
          answerAppQuestion(question, effectiveLanguage)
        );
        setAssistantMessages((previous) => [
          ...previous,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: answer,
          },
        ]);
      } finally {
        setAssistantBusy(false);
      }
    },
    [
      assistantBusy,
      assistantInput,
      effectiveLanguage,
      runWithProgress,
      text.loadingAppChat,
    ]
  );

  const appBody =
    screen === 'home' ? (
      <HomeScreen
        language={effectiveLanguage}
        theme={theme}
        user={session?.user ?? null}
        latestPlan={latestPlan}
        macros={consumedMacros}
        nutritionLog={nutritionLog}
        onOpenKitchen={() => setScreen('kitchen')}
        onOpenHealth={() => setScreen('health')}
        onOpenProfile={openProfileEntry}
        onOpenAssistant={() => setAssistantVisible(true)}
      />
    ) : screen === 'kitchen' ? (
      <KitchenScreen
        language={effectiveLanguage}
        theme={theme}
        recommendations={recommendations}
        isRefreshing={isRefreshing}
        recommendationError={recommendationError}
        favorites={favorites}
        history={history}
        onBack={() => setScreen('home')}
        onOpenRecipe={openRecipe}
        onGenerateRecipe={onGenerateRecipe}
        onUpdateFavoriteNote={updateFavoriteNote}
        onShareRecipe={askRecipeShare}
        onRefreshRecommendations={clearRecommendations}
      />
    ) : (
      <HealthScreen
        language={effectiveLanguage}
        theme={theme}
        savedPlans={savedWorkoutPlans}
        onBack={() => setScreen('home')}
        onGeneratePlan={generatePlanForUser}
        onOpenPlan={openPlan}
      />
    );

  const nativeContent = (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.frame }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <DepthBackdrop theme={theme} />
      <View style={styles.appLayer}>{appBody}</View>

      <ProgressOverlay state={operationState} theme={theme} />

      <RecipeModal
        recipe={selectedRecipe}
        visible={Boolean(selectedRecipe)}
        language={effectiveLanguage}
        theme={theme}
        isFavorite={isSelectedRecipeFavorite}
        userProfile={session?.user?.profile}
        onToggleFavorite={() => {
          if (selectedRecipe) {
            toggleFavorite(selectedRecipe);
          }
        }}
        onMarkDone={() => {
          if (selectedRecipe) {
            markRecipeDone(selectedRecipe);
          }
        }}
        onShare={() => {
          if (selectedRecipe) {
            askRecipeShare(selectedRecipe);
          }
        }}
        onOpenAiVariants={openAiVariantsForSelectedRecipe}
        onClose={() => {
          setSelectedRecipe(null);
          setAiVariantsVisible(false);
        }}
      />

      <AiRecipeVariantsModal
        visible={aiVariantsVisible}
        variants={aiVariants}
        loading={aiVariantsLoading}
        error={aiVariantsError}
        language={effectiveLanguage}
        theme={theme}
        onClose={() => setAiVariantsVisible(false)}
        onOpenRecipe={applyAiVariantRecipe}
        onReload={() => {
          if (selectedRecipe) {
            void loadAiVariantsForRecipe(selectedRecipe);
          }
        }}
      />

      <WorkoutPlanModal
        visible={Boolean(selectedPlan)}
        plan={selectedPlan}
        language={effectiveLanguage}
        theme={theme}
        isSaved={isSelectedPlanSaved}
        onSave={() => {
          if (selectedPlan) {
            if (!requireAuth()) {
              return;
            }
            saveWorkoutPlan(selectedPlan);
          }
        }}
        onShare={() => {
          if (selectedPlan) {
            askWorkoutPlanShare(selectedPlan);
          }
        }}
        onClose={() => setSelectedPlan(null)}
      />

      <ShareTargetsModal
        visible={shareVisible}
        language={effectiveLanguage}
        theme={theme}
        onClose={() => setShareVisible(false)}
        onSelect={(target) => {
          if (!sharePayload) {
            return;
          }
          void shareToTarget(sharePayload, target, effectiveLanguage);
          setShareVisible(false);
        }}
      />

      <AuthModal
        visible={authVisible}
        language={effectiveLanguage}
        theme={theme}
        onClose={() => setAuthVisible(false)}
        onLogin={login}
        onRegister={register}
      />

      {session ? (
        <ProfileModal
          visible={profileVisible}
          user={session.user}
          theme={theme}
          onClose={() => setProfileVisible(false)}
          onSaveProfile={saveProfile}
          onChangePassword={changePassword}
          onShareProfile={askProfileShare}
          onOpenAdmin={() => setAdminVisible(true)}
          onLogout={logout}
        />
      ) : null}

      {session?.user.role === 'admin' ? (
        <AdminPanelModal
          visible={adminVisible}
          language={effectiveLanguage}
          theme={theme}
          config={appConfig}
          onClose={() => setAdminVisible(false)}
          onSave={saveAppConfig}
        />
      ) : null}

      <AppAssistantModal
        visible={assistantVisible}
        language={effectiveLanguage}
        theme={theme}
        messages={assistantMessages}
        inputValue={assistantInput}
        busy={assistantBusy}
        onChangeInput={setAssistantInput}
        onSend={sendAssistantQuestion}
        onAskQuickQuestion={sendAssistantQuestion}
        onClose={() => setAssistantVisible(false)}
      />
    </SafeAreaView>
  );

  if (Platform.OS !== 'web') {
    return nativeContent;
  }

  const scale = Math.min((window.width - 28) / 430, (window.height - 28) / 932, 1);

  return (
    <View style={[styles.webStage, { backgroundColor: theme.frame }]}>
      <View style={[styles.iphoneFrame, { transform: [{ scale }] }]}>
        <View
          style={[
            styles.iphoneBezel,
            {
              backgroundColor: theme.key === 'obsidian' ? '#040404' : '#E2DDD2',
            },
          ]}
        >
          <View
            style={[
              styles.iphoneNotch,
              {
                backgroundColor: theme.key === 'obsidian' ? '#040404' : '#D1CCBF',
              },
            ]}
          />
          <View
            style={[
              styles.iphoneScreen,
              { backgroundColor: theme.key === 'obsidian' ? '#060606' : '#F3EFE6' },
            ]}
          >
            <View style={styles.webSafeAreaShim}>{nativeContent}</View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  appLayer: {
    flex: 1,
  },
  webStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iphoneFrame: {
    width: 430,
    height: 932,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iphoneBezel: {
    width: '100%',
    height: '100%',
    borderRadius: 58,
    padding: 14,
    ...shadowStyle('#000000', BEZEL_SHADOW),
  },
  iphoneScreen: {
    flex: 1,
    borderRadius: 46,
    overflow: 'hidden',
  },
  webSafeAreaShim: {
    flex: 1,
    paddingTop: 54,
    paddingBottom: 28,
  },
  iphoneNotch: {
    position: 'absolute',
    top: 20,
    left: '50%',
    transform: [{ translateX: -90 }],
    width: 180,
    height: 36,
    borderRadius: 18,
    zIndex: 10,
  },
  depthBubble: {
    position: 'absolute',
    borderRadius: 999,
  },
  depthBubbleA: {
    width: 260,
    height: 260,
    top: -60,
    right: -90,
  },
  depthBubbleB: {
    width: 220,
    height: 220,
    bottom: 80,
    left: -90,
  },
  depthBubbleC: {
    width: 150,
    height: 150,
    top: '46%',
    right: 30,
  },
  depthPlate: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: '34%',
    height: 180,
    borderWidth: 1,
    borderRadius: 36,
    transform: [{ rotate: '-8deg' }],
  },
  progressOverlay: {
    position: 'absolute',
    top: 18,
    left: 16,
    right: 16,
  },
  pointerEventsNone: {
    pointerEvents: 'none',
  },
  progressCard: {
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  progressLabelRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  progressPulse: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
  },
  progressMeta: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressShimmer: {
    width: 68,
    height: '100%',
    opacity: 0.26,
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 22,
    gap: 14,
  },
  homeContent: {
    gap: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 34,
    justifyContent: 'flex-start',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  topGreetingWrap: {
    flex: 1,
    minWidth: 0,
    paddingTop: 1,
  },
  avatarTapArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
  },
  avatarLoginLabel: {
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 12,
    marginTop: 4,
    maxWidth: 62,
    textAlign: 'center',
  },
  topGreeting: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 31,
  },
  topSubGreeting: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '800',
  },
  assistantTopButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
  },
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 228,
  },
  heroImage: {
    flex: 1,
  },
  heroImageStyle: {
    borderRadius: 22,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  heroTitle: {
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 37,
    maxWidth: 340,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 330,
    fontWeight: '800',
  },
  heroChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 22,
  },
  heroChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroChipText: {
    fontSize: 12,
    fontWeight: '900',
  },
  sectionCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 16,
  },
  macroSectionCard: {
    padding: 12,
    borderRadius: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    fontWeight: '800',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 16,
    fontWeight: '800',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 14,
  },
  macroOrbWrap: {
    flex: 1,
    alignItems: 'center',
  },
  macroOrb: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  macroOrbFillTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: 'hidden',
  },
  macroOrbFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  macroOrbCenter: {
    width: 37,
    height: 37,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroOrbValue: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  macroOrbUnit: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 1,
  },
  macroOrbLabel: {
    fontSize: 10,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  macroOrbFoot: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  featureCard: {
    flexBasis: 160,
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    minHeight: 330,
  },
  featureCardImage: {
    width: '100%',
    height: 122,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  videoThumbButton: {
    position: 'relative',
    alignSelf: 'stretch',
  },
  videoPlayBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 18,
    textTransform: 'uppercase',
  },
  featureTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 27,
    marginTop: 7,
  },
  featureSummary: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    fontWeight: '800',
  },
  featureAction: {
    marginTop: 9,
    alignSelf: 'flex-start',
    minWidth: 48,
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  featureSpacer: {
    flex: 1,
    minHeight: 16,
  },
  featureRoundAction: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  homeNutritionCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 12,
  },
  homeKitchenCard: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    padding: 10,
    minHeight: 126,
  },
  homeKitchenImage: {
    width: 98,
    height: 106,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  homeKitchenCopy: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  homeKitchenTitle: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 3,
  },
  homeBottomRow: {
    flexDirection: 'row',
    gap: 8,
  },
  homeSummaryCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    minHeight: 152,
  },
  homeSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  homeSummaryTitle: {
    flex: 1,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  homeMiniAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  homeMiniActionText: {
    fontSize: 12,
    fontWeight: '900',
  },
  homeMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 9,
  },
  homeMetricTile: {
    width: '47%',
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  homeMetricValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  homeMetricLabel: {
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
  },
  homeSportPreview: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
    alignItems: 'center',
  },
  homeSportThumb: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  homeSportText: {
    flex: 1,
    minWidth: 0,
  },
  homeSportTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  homeSportSummary: {
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  homeSportStats: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 9,
  },
  homeSportStat: {
    flex: 1,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerSpacer: {
    width: 40,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  assistantHero: {
    minHeight: 260,
    borderRadius: 28,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  assistantHeroImage: {
    borderRadius: 28,
  },
  assistantHeroGif: {
    ...StyleSheet.absoluteFillObject,
  },
  coachHero: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  coachHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  coachGreeting: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coachHeroTitle: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: 5,
  },
  coachHeroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 320,
  },
  coachModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  coachModeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  coachMetricRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
  },
  coachMetric: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    minHeight: 72,
    justifyContent: 'center',
  },
  coachMetricValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  coachMetricLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  coachBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  coachBentoCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
  },
  coachComposerCard: {
    gap: 10,
  },
  coachBentoWide: {
    width: '100%',
  },
  coachBentoHalf: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 138,
  },
  coachBentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  coachBentoTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  coachInput: {
    minHeight: 94,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  coachInputCompact: {
    minHeight: 76,
  },
  coachInlineLabel: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  coachDurationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coachDurationButton: {
    flex: 1,
  },
  coachSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  coachSelectedText: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
  },
  coachSegment: {
    gap: 8,
  },
  coachSegmentButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  coachSegmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  coachFocusText: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '800',
    marginTop: 4,
  },
  coachRegionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  coachRegionTile: {
    flexBasis: '29%',
    flexGrow: 1,
    minHeight: 42,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coachRegionText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '800',
  },
  coachPrimaryButton: {
    marginTop: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 8,
  },
  coachResultCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
  },
  coachResultTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  coachResultCopy: {
    flex: 1,
  },
  coachResultVideo: {
    width: 112,
    height: 126,
    borderRadius: 18,
  },
  coachPlanStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  coachPlanStat: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  coachSecondaryButton: {
    marginTop: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
  },
  coachEmptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputCard: {
    margin: 16,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
  },
  kitchenInputCard: {
    margin: 0,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  heroInput: {
    minHeight: 88,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  kitchenHeroInput: {
    minHeight: 72,
  },
  primaryWideButton: {
    marginTop: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
  },
  primaryWideButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  inlineLinkButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  inlineLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalCardRow: {
    gap: 12,
    paddingRight: 16,
  },
  recipeCard: {
    width: 184,
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
  },
  recipeImage: {
    width: '100%',
    height: 100,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
  },
  recipeLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 10,
    textTransform: 'uppercase',
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  recipeSummary: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    minHeight: 36,
  },
  recipeNutritionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  recipeNutritionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ghostActionButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
  ghostActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  darkActionButton: {
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  darkActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  collectionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  collectionCard: {
    flex: 1,
    borderRadius: 24,
    padding: 14,
    minHeight: 240,
    borderWidth: 1,
  },
  collectionVisual: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  collectionVisualMain: {
    flex: 1,
    height: 108,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  collectionVisualSide: {
    width: 68,
    gap: 8,
  },
  collectionVisualMini: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  collectionVisualEmpty: {
    height: 108,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  collectionHeading: {
    fontSize: 15,
    fontWeight: '800',
  },
  collectionCount: {
    fontSize: 34,
    fontWeight: '900',
    marginTop: 8,
  },
  collectionPreviewText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  shareModalBackdrop: {
    zIndex: 10000,
    elevation: 10000,
  },
  sheet: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
  },
  largeSheet: {
    maxHeight: '92%',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sheetTitleWrap: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shareButton: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalHeroImage: {
    width: '100%',
    height: 200,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  modalMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  modalSummary: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  recipeVideoButton: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recipeVideoButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modalNutritionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  modalNutritionChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
  },
  modalSection: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  modalItem: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 3,
  },
  modalActionColumn: {
    gap: 10,
    marginTop: 14,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryPillButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
  },
  secondaryWideButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
  },
  secondaryPillButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  darkButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  darkButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  collectionItem: {
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  aiVariantList: {
    gap: 10,
    paddingBottom: 6,
  },
  aiVariantLoading: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  aiVariantCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  aiVariantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  aiVariantProvider: {
    fontSize: 14,
    fontWeight: '800',
  },
  aiVariantModel: {
    fontSize: 11,
    fontWeight: '600',
  },
  aiVariantRecipeWrap: {
    gap: 8,
  },
  aiVariantImage: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  aiVariantRecipeTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  aiVariantRecipeSummary: {
    fontSize: 12,
    lineHeight: 18,
  },
  aiVariantStatus: {
    fontSize: 12,
    lineHeight: 18,
  },
  collectionMainRow: {
    flexDirection: 'row',
    gap: 10,
  },
  collectionThumb: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
  },
  collectionTextWrap: {
    flex: 1,
  },
  collectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  collectionMetaText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  collectionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  collectionActionButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  collectionActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noteInput: {
    marginTop: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
  },
  authSwitchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  authSwitchButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderWidth: 1,
  },
  authSwitchText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetInput: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  profileAvatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarInitials: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '900',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 4,
  },
  profileDate: {
    fontSize: 12,
    marginTop: 4,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  selectPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  colorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  colorPreview: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  avatarSwatchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  avatarSwatchButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightButton: {
    marginTop: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  lightButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 6,
  },
  profileStatBox: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  profileStatValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  profileStatLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  aboutCard: {
    marginTop: 16,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
  },
  updateInfoCard: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  updateInfoTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  aboutLine: {
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },
  saveSettingsButton: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#7CFFB2',
  },
  saveSettingsButtonText: {
    color: '#071D12',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 20,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 10,
  },
  planSummary: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  planCard: {
    width: 230,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
  },
  planCardVideo: {
    width: '100%',
    height: 90,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#E5E7EB',
  },
  planCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  planCardSummary: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    minHeight: 54,
  },
  planCardMeta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
  },
  dayTabsRow: {
    gap: 8,
    paddingBottom: 10,
  },
  dayTab: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
  },
  dayTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  activeDayCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  activeDayTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  activeDaySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  exerciseCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  exerciseMeta: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  exerciseRestBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  exerciseRestText: {
    fontSize: 11,
    fontWeight: '700',
  },
  videoPanel: {
    gap: 12,
    marginTop: 12,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  videoFrame: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#111111',
  },
  videoWebView: {
    flex: 1,
    backgroundColor: '#111111',
  },
  videoPanelText: {
    gap: 6,
  },
  exerciseSummary: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  exerciseCue: {
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseInstruction: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  assistantMessages: {
    gap: 10,
    paddingBottom: 10,
  },
  assistantBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: '92%',
  },
  assistantBubbleAssistant: {
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  assistantBubbleUser: {
    alignSelf: 'flex-end',
  },
  assistantBubbleText: {
    fontSize: 13,
    lineHeight: 20,
  },
  assistantQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  assistantQuickChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  assistantInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'flex-end',
  },
  assistantInput: {
    flex: 1,
    minHeight: 56,
    maxHeight: 112,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  assistantSendButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  nutritionHistoryCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  nutritionHistoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  nutritionHistoryMetric: {
    width: '48%',
    gap: 3,
  },
  adminButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  adminLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    maxWidth: '100%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  adminList: {
    gap: 10,
    marginTop: 12,
  },
  adminListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
  },
  scalePress: {
    opacity: 0.84,
  },
  hologramContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
  },
  hologramGradient: {
    padding: 2,
  },
  hologramInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  hologramText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111',
  },
  glassList: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 18,
    padding: 12,
    marginTop: 4,
  },
});
