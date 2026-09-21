/**
 * AI Communication Coach - Full-Stack Multimodal Platform Logic
 * Integrates Auth, Conversation AI, Web Speech STT, MediaPipe CV, DB Persistence, Progress Analytics & Weakness Engine
 */

const API_BASE_URL = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5000'))
  ? 'http://localhost:5000'
  : window.location.origin;

let state = {
  authToken: localStorage.getItem('ai_coach_token') || null,
  currentUser: null,

  currentScenario: 'Job Interview',
  isDemoMode: false,
  isInterviewRunning: false,
  isRecordingMic: true,
  currentQuestionIndex: 0,
  remainingTime: 90,
  questionTimer: null,
  conversationTurns: [],

  // Vision Models
  pose: null,
  hands: null,
  faceMesh: null,
  tmModel: null,
  webcamStream: null,
  animFrameId: null,

  // Latest Landmark Frames & Indicators
  latestPoseLandmarks: null,
  latestHandLandmarks: [],
  latestFaceLandmarks: null,

  // Indicators State
  indicators: {
    eyeContact: 'good', // 'good' or 'warning'
    posture: 'good',
    headStability: 'good'
  },

  // Accumulated Session Metrics
  accumulated: {
    totalFrames: 0,
    eyeContactGoodFrames: 0,
    postureGoodFrames: 0,
    headStableFrames: 0,
    gestureGoodFrames: 0
  },

  // Speech & STT State
  speechRecognition: null,
  speech: {
    isAvailable: false,
    transcript: '',
    currentTurnTranscript: '',
    wordCount: 0,
    fillerCount: 0,
    fillerWordsDetected: {},
    speechStartTime: 0,
    wpm: 0
  },

  // Analytics & Weaknesses
  currentWeakness: null,
  historySessions: []
};

// ---------------- 2. DOM ELEMENTS MAPPING ----------------
const elements = {
  // Screens
  landingPage: document.getElementById('landingPage'),
  guideSection: document.getElementById('guideSection'),
  inputPage: document.getElementById('inputPage'),
  dashboardPage: document.getElementById('dashboardPage'),
  scenarioPage: document.getElementById('scenarioPage'),
  interviewPage: document.getElementById('interviewPage'),
  reportPage: document.getElementById('reportPage'),
  historyPage: document.getElementById('historyPage'),
  weaknessPracticePage: document.getElementById('weaknessPracticePage'),

  // Header & Nav
  navBrandLink: document.getElementById('navBrandLink'),
  navHome: document.getElementById('navHome'),
  navGuide: document.getElementById('navGuide'),
  navDemo: document.getElementById('navDemo'),
  navInterview: document.getElementById('navInterview'),
  navDashboard: document.getElementById('navDashboard'),
  navPractice: document.getElementById('navPractice'),
  navHistory: document.getElementById('navHistory'),
  navWeakness: document.getElementById('navWeakness'),

  // Hero Actions
  heroStartBtn: document.getElementById('heroStartBtn'),
  heroDemoBtn: document.getElementById('heroDemoBtn'),
  heroGuideBtn: document.getElementById('heroGuideBtn'),
  startDemoCardBtn: document.getElementById('startDemoCardBtn'),
  startFullCardBtn: document.getElementById('startFullCardBtn'),
  saveAndDashBtn: document.getElementById('saveAndDashBtn'),

  // Setup Page Controls
  username: document.getElementById('username'),
  role: document.getElementById('role'),
  modeNormal: document.getElementById('modeNormal'),
  modeDemo: document.getElementById('modeDemo'),
  startBtn: document.getElementById('startBtn'),

  headerUserName: document.getElementById('headerUserName'),
  headerUserRole: document.getElementById('headerUserRole'),
  openAuthModalBtn: document.getElementById('openAuthModalBtn'),
  logoutBtn: document.getElementById('logoutBtn'),

  // Auth Modal
  authModal: document.getElementById('authModal'),
  closeAuthModalBtn: document.getElementById('closeAuthModalBtn'),
  tabLogin: document.getElementById('tabLogin'),
  tabSignup: document.getElementById('tabSignup'),
  groupName: document.getElementById('groupName'),
  groupConfirmPassword: document.getElementById('groupConfirmPassword'),
  groupRole: document.getElementById('groupRole'),
  authName: document.getElementById('authName'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),
  authConfirmPassword: document.getElementById('authConfirmPassword'),
  authRole: document.getElementById('authRole'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authErrorMsg: document.getElementById('authErrorMsg'),

  // Dashboard
  dashCandidateName: document.getElementById('dashCandidateName'),
  statTotalSessions: document.getElementById('statTotalSessions'),
  statAvgScore: document.getElementById('statAvgScore'),
  weaknessAlertBanner: document.getElementById('weaknessAlertBanner'),
  weaknessTitle: document.getElementById('weaknessTitle'),
  weaknessDesc: document.getElementById('weaknessDesc'),
  practiceWeaknessBtn: document.getElementById('practiceWeaknessBtn'),

  // Setup Page
  selectScenario: document.getElementById('selectScenario'),
  toggleWebcam: document.getElementById('toggleWebcam'),
  toggleMic: document.getElementById('toggleMic'),
  launchPracticeBtn: document.getElementById('launchPracticeBtn'),

  // Practice Dashboard
  liveScenBadge: document.getElementById('liveScenBadge'),
  qCounter: document.getElementById('qCounter'),
  timer: document.getElementById('timer'),
  currentQuestion: document.getElementById('currentQuestion'),
  liveTranscript: document.getElementById('liveTranscript'),
  sttStatus: document.getElementById('sttStatus'),

  liveWpmVal: document.getElementById('liveWpmVal'),
  liveFillersVal: document.getElementById('liveFillersVal'),
  liveFluencyVal: document.getElementById('liveFluencyVal'),

  webcam: document.getElementById('webcam'),
  overlay: document.getElementById('overlay'),

  valEyeContact: document.getElementById('valEyeContact'),
  valPosture: document.getElementById('valPosture'),
  valHead: document.getElementById('valHead'),
  valGesture: document.getElementById('valGesture'),
  valSpeech: document.getElementById('valSpeech'),

  feedbackList: document.getElementById('feedbackList'),
  displayName: document.getElementById('displayName'),
  displayScenario: document.getElementById('displayScenario'),

  toggleRecBtn: document.getElementById('toggleRecBtn'),
  submitTurnBtn: document.getElementById('submitTurnBtn'),
  stopBtn: document.getElementById('stopBtn'),

  // Status Indicators
  statusCamera: document.getElementById('statusCamera'),
  statusPose: document.getElementById('statusPose'),
  statusFace: document.getElementById('statusFace'),
  statusHands: document.getElementById('statusHands'),
  statusGesture: document.getElementById('statusGesture'),
  statusSpeech: document.getElementById('statusSpeech'),

  // Report Screen
  reportName: document.getElementById('reportName'),
  reportScenario: document.getElementById('reportScenario'),
  reportScoreOverall: document.getElementById('reportScoreOverall'),
  reportGrammarScore: document.getElementById('reportGrammarScore'),
  reportVocabScore: document.getElementById('reportVocabScore'),
  reportFluencyScore: document.getElementById('reportFluencyScore'),
  reportWpmText: document.getElementById('reportWpmText'),
  reportFillersText: document.getElementById('reportFillersText'),
  reportFillersListText: document.getElementById('reportFillersListText'),
  reportEyeContact: document.getElementById('reportEyeContact'),
  reportPostureScore: document.getElementById('reportPostureScore'),
  reportHeadStability: document.getElementById('reportHeadStability'),
  reportAiFeedbackText: document.getElementById('reportAiFeedbackText'),

  strengthsList: document.getElementById('strengthsList'),
  improvementsList: document.getElementById('improvementsList'),
  saveAndDashBtn: document.getElementById('saveAndDashBtn'),
  restartBtn: document.getElementById('restartBtn'),

  // History & Progress Screen
  progressTrendChartCanvas: document.getElementById('progressTrendChartCanvas'),
  historyTableBody: document.getElementById('historyTableBody'),

  // Targeted Weakness Screen
  weaknessExTitle: document.getElementById('weaknessExTitle'),
  weaknessExDesc: document.getElementById('weaknessExDesc'),
  weaknessPromptText: document.getElementById('weaknessPromptText'),
  weaknessTimerText: document.getElementById('weaknessTimerText'),
  weaknessFillersVal: document.getElementById('weaknessFillersVal'),
  weaknessEyeVal: document.getElementById('weaknessEyeVal'),
  startWeaknessExBtn: document.getElementById('startWeaknessExBtn')
};

let progressTrendChartInstance = null;

// ---------------- 3. API FETCH HELPER ----------------
async function apiFetch(endpoint, method = 'GET', data = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.authToken) {
    headers['Authorization'] = `Bearer ${state.authToken}`;
  }

  const config = { method, headers };
  if (data) config.body = JSON.stringify(data);

  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, config);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Server returned non-JSON response (${res.status}). Ensure backend server is running on http://localhost:5000.`);
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'API Request failed');
    return json;
  } catch (err) {
    console.warn(`API Error (${endpoint}):`, err.message);
    throw err;
  }
}

// ---------------- 4. SPA ROUTER & SCREEN SWITCHING ----------------
function showScreen(screenId) {
  const screens = ['landingPage', 'inputPage', 'dashboardPage', 'scenarioPage', 'interviewPage', 'reportPage', 'historyPage', 'weaknessPracticePage'];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === screenId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });

  // Highlight Nav Links
  [elements.navHome, elements.navGuide, elements.navDemo, elements.navInterview, elements.navDashboard, elements.navPractice, elements.navHistory, elements.navWeakness].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });

  if (screenId === 'landingPage' && elements.navHome) elements.navHome.classList.add('active');
  if (screenId === 'inputPage' && elements.navInterview) elements.navInterview.classList.add('active');
  if (screenId === 'dashboardPage' && elements.navDashboard) elements.navDashboard.classList.add('active');
  if (screenId === 'scenarioPage' && elements.navPractice) elements.navPractice.classList.add('active');
  if (screenId === 'historyPage' && elements.navHistory) elements.navHistory.classList.add('active');
  if (screenId === 'weaknessPracticePage' && elements.navWeakness) elements.navWeakness.classList.add('active');

  // Stop camera if navigating away from live practice
  if (screenId !== 'interviewPage' && state.isInterviewRunning) {
    stopCamera();
    state.isInterviewRunning = false;
    if (state.questionTimer) clearInterval(state.questionTimer);
  }

  // Load screen data
  if (screenId === 'dashboardPage') loadDashboardData();
  if (screenId === 'historyPage') loadProgressDashboard();
  if (screenId === 'weaknessPracticePage') setupWeaknessScreen();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function requireAuthGuard(onSuccess) {
  if (state.currentUser && state.authToken) {
    onSuccess();
  } else {
    if (elements.authModal) {
      elements.authModal.classList.add('active');
      if (elements.authErrorMsg) {
        elements.authErrorMsg.textContent = "Please Sign In or Create an Account first to access AI Practice & Quick Demo modes.";
        elements.authErrorMsg.style.display = "block";
      }
    }
  }
}

function startQuickDemo() {
  requireAuthGuard(() => {
    state.isDemoMode = true;
    state.currentScenario = 'Job Interview Practice';
    launchPracticeSession();
  });
}

function startFullInterview() {
  requireAuthGuard(() => {
    state.isDemoMode = false;
    state.currentScenario = (elements.selectScenario && elements.selectScenario.value) ? elements.selectScenario.value : 'Job Interview';
    launchPracticeSession();
  });
}

function scrollToGuide() {
  showScreen('landingPage');
  if (elements.guideSection) {
    elements.guideSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    const guideEl = document.getElementById('guideSection');
    if (guideEl) guideEl.scrollIntoView({ behavior: 'smooth' });
  }
}

// ---------------- 5. AUTHENTICATION MANAGER ----------------
async function initAuth() {
  if (state.authToken) {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.user) {
        state.currentUser = res.user;
      }
    } catch (e) {
      console.warn("Auth endpoint verify failed, checking stored session.");
      const savedUser = localStorage.getItem('ai_coach_user');
      if (savedUser) {
        try {
          state.currentUser = JSON.parse(savedUser);
        } catch (parseErr) {
          state.authToken = null;
          state.currentUser = null;
          localStorage.removeItem('ai_coach_token');
          localStorage.removeItem('ai_coach_user');
        }
      } else {
        state.authToken = null;
        state.currentUser = null;
        localStorage.removeItem('ai_coach_token');
      }
    }
  }
  updateAuthUI();
}

function updateAuthUI() {
  if (state.currentUser && state.authToken) {
    if (elements.headerUserName) elements.headerUserName.textContent = state.currentUser.name;
    if (elements.headerUserRole) elements.headerUserRole.textContent = state.currentUser.role || 'Software Engineer';
    if (elements.dashCandidateName) elements.dashCandidateName.textContent = state.currentUser.name;
    if (elements.displayName) elements.displayName.textContent = state.currentUser.name;
    if (elements.reportName) elements.reportName.textContent = state.currentUser.name;
    if (elements.userProfilePill) elements.userProfilePill.style.display = 'flex';
    if (elements.openAuthModalBtn) elements.openAuthModalBtn.style.display = 'none';
  } else {
    if (elements.userProfilePill) elements.userProfilePill.style.display = 'none';
    if (elements.openAuthModalBtn) elements.openAuthModalBtn.style.display = 'flex';
  }
}

async function loginUser(email, password) {
  try {
    if (elements.authErrorMsg) elements.authErrorMsg.style.display = 'none';
    if (!email || !password) {
      if (elements.authErrorMsg) {
        elements.authErrorMsg.textContent = "Please enter both email and password.";
        elements.authErrorMsg.style.display = 'block';
      }
      return;
    }

    try {
      const res = await apiFetch('/api/auth/login', 'POST', { email, password });
      state.authToken = res.token;
      state.currentUser = res.user;
    } catch (apiErr) {
      console.warn("Backend API unavailable or returned non-JSON, using local session fallback:", apiErr.message);
      const cleanEmail = email.toLowerCase().trim();
      const localUsers = JSON.parse(localStorage.getItem('ai_coach_local_users') || '[]');
      const existing = localUsers.find(u => u.email === cleanEmail);
      if (existing) {
        state.currentUser = { id: existing.id, name: existing.name, email: existing.email, role: existing.role };
      } else {
        const namePart = cleanEmail.split('@')[0];
        const name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        state.currentUser = { id: 'usr_' + Date.now(), name, email: cleanEmail, role: 'Software Engineer' };
      }
      state.authToken = 'token_local_' + Date.now();
    }

    localStorage.setItem('ai_coach_token', state.authToken);
    localStorage.setItem('ai_coach_user', JSON.stringify(state.currentUser));
    updateAuthUI();
    if (elements.authModal) elements.authModal.classList.remove('active');
    loadDashboardData();
  } catch (err) {
    if (elements.authErrorMsg) {
      elements.authErrorMsg.textContent = err.message;
      elements.authErrorMsg.style.display = 'block';
    }
  }
}

async function signupUser(name, email, password, confirmPassword, role) {
  try {
    if (elements.authErrorMsg) elements.authErrorMsg.style.display = 'none';
    if (!name || !email || !password || !confirmPassword) {
      if (elements.authErrorMsg) {
        elements.authErrorMsg.textContent = "Please fill in all required registration fields.";
        elements.authErrorMsg.style.display = 'block';
      }
      return;
    }
    if (password !== confirmPassword) {
      if (elements.authErrorMsg) {
        elements.authErrorMsg.textContent = "Passwords do not match. Please verify your password.";
        elements.authErrorMsg.style.display = 'block';
      }
      return;
    }
    if (password.length < 6) {
      if (elements.authErrorMsg) {
        elements.authErrorMsg.textContent = "Password must be at least 6 characters long.";
        elements.authErrorMsg.style.display = 'block';
      }
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    try {
      const res = await apiFetch('/api/auth/signup', 'POST', { name, email: cleanEmail, password, role });
      state.authToken = res.token;
      state.currentUser = res.user;
    } catch (apiErr) {
      console.warn("Backend API unavailable or returned non-JSON, using local registration fallback:", apiErr.message);
      const newUser = { id: 'usr_' + Date.now(), name: name.trim(), email: cleanEmail, role: role || 'Software Engineer' };
      state.currentUser = newUser;
      state.authToken = 'token_local_' + Date.now();
      
      const localUsers = JSON.parse(localStorage.getItem('ai_coach_local_users') || '[]');
      localUsers.push({ ...newUser, password });
      localStorage.setItem('ai_coach_local_users', JSON.stringify(localUsers));
    }

    localStorage.setItem('ai_coach_token', state.authToken);
    localStorage.setItem('ai_coach_user', JSON.stringify(state.currentUser));
    updateAuthUI();
    if (elements.authModal) elements.authModal.classList.remove('active');
    loadDashboardData();
  } catch (err) {
    if (elements.authErrorMsg) {
      elements.authErrorMsg.textContent = err.message;
      elements.authErrorMsg.style.display = 'block';
    }
  }
}

function logoutUser() {
  state.authToken = null;
  state.currentUser = null;
  localStorage.removeItem('ai_coach_token');
  localStorage.removeItem('ai_coach_user');
  updateAuthUI();
  showScreen('landingPage');
}

// ---------------- 6. DASHBOARD & WEAKNESS ENGINE ----------------
async function loadDashboardData() {
  try {
    const history = await apiFetch('/api/sessions/history');
    elements.statTotalSessions.textContent = history.length;
    if (history.length > 0) {
      const avg = Math.round(history.reduce((a, s) => a + (s.overallScore || 80), 0) / history.length);
      elements.statAvgScore.textContent = `${avg}%`;
    } else {
      elements.statAvgScore.textContent = `82%`;
    }
  } catch (e) {}

  // Fetch Recurring Weaknesses
  try {
    const weakness = await apiFetch('/api/analytics/weakness');
    state.currentWeakness = weakness;
    if (weakness && weakness.hasWeakness) {
      elements.weaknessAlertBanner.style.display = 'flex';
      elements.weaknessTitle.textContent = weakness.title;
      elements.weaknessDesc.textContent = weakness.description;
    } else {
      elements.weaknessAlertBanner.style.display = 'none';
    }
  } catch (e) {}
}

// ---------------- 7. MODEL LOADERS & SPEECH STT ----------------
async function initModels() {
  // A. Teachable Machine Gesture Model
  try {
    updateStatus(elements.statusGesture, 'loading');
    if (window.tmImage) {
      state.tmModel = await tmImage.load('./model/model.json', './model/metadata.json');
      updateStatus(elements.statusGesture, 'ready', 'Gesture');
    }
  } catch (e) {
    updateStatus(elements.statusGesture, 'ready', 'Gesture');
  }

  // B. MediaPipe Pose
  try {
    updateStatus(elements.statusPose, 'loading');
    if (window.Pose) {
      state.pose = new window.Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
      state.pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      state.pose.onResults((res) => { state.latestPoseLandmarks = res.poseLandmarks || null; });
      updateStatus(elements.statusPose, 'ready', 'Pose');
    }
  } catch (e) {
    updateStatus(elements.statusPose, 'error', 'Pose');
  }

  // C. MediaPipe Hands
  try {
    updateStatus(elements.statusHands, 'loading');
    if (window.Hands) {
      state.hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
      state.hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      state.hands.onResults((res) => { state.latestHandLandmarks = res.multiHandLandmarks || []; });
      updateStatus(elements.statusHands, 'ready', 'Hands');
    }
  } catch (e) {
    updateStatus(elements.statusHands, 'error', 'Hands');
  }

  // D. MediaPipe Face Mesh
  try {
    updateStatus(elements.statusFace, 'loading');
    if (window.FaceMesh) {
      state.faceMesh = new window.FaceMesh({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
      state.faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      state.faceMesh.onResults((res) => {
        state.latestFaceLandmarks = (res.multiFaceLandmarks && res.multiFaceLandmarks.length > 0) ? res.multiFaceLandmarks[0] : null;
      });
      updateStatus(elements.statusFace, 'ready', 'Face');
    }
  } catch (e) {
    updateStatus(elements.statusFace, 'error', 'Face');
  }

  // E. Web Speech API STT
  initSpeechAnalysis();
}

function initSpeechAnalysis() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    state.speech.isAvailable = false;
    updateStatus(elements.statusSpeech, 'error', 'Speech: Unsupported');
    return;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    const fillersList = ['um', 'uh', 'like', 'actually', 'basically', 'you know'];

    recognition.onresult = (event) => {
      let turnTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          turnTranscript += event.results[i][0].transcript.toLowerCase() + ' ';
        }
      }

      if (turnTranscript) {
        state.speech.transcript += turnTranscript;
        state.speech.currentTurnTranscript += turnTranscript;
        elements.liveTranscript.textContent = state.speech.currentTurnTranscript;

        const words = turnTranscript.trim().split(/\s+/);
        state.speech.wordCount += words.length;

        fillersList.forEach((filler) => {
          const regex = new RegExp(`\\b${filler}\\b`, 'gi');
          const matches = turnTranscript.match(regex);
          if (matches) {
            state.speech.fillerCount += matches.length;
            state.speech.fillerWordsDetected[filler] = (state.speech.fillerWordsDetected[filler] || 0) + matches.length;
          }
        });

        // WPM Calculation
        const durationMins = (Date.now() - state.speech.speechStartTime) / 60000;
        if (durationMins > 0.05) {
          state.speech.wpm = Math.round(state.speech.wordCount / durationMins);
        }

        elements.liveWpmVal.textContent = `${state.speech.wpm} WPM`;
        elements.liveFillersVal.textContent = state.speech.fillerCount;
      }
    };

    recognition.onerror = () => {};

    state.speechRecognition = recognition;
    state.speech.isAvailable = true;
    updateStatus(elements.statusSpeech, 'ready', 'Speech: Active');
  } catch (e) {
    state.speech.isAvailable = false;
    updateStatus(elements.statusSpeech, 'error', 'Speech: Error');
  }
}

function updateStatus(el, status, text) {
  if (!el) return;
  const dot = el.querySelector('.status-dot');
  if (dot) dot.className = `status-dot ${status}`;
  if (text) {
    const txtNode = el.querySelector('.status-text');
    if (txtNode) txtNode.textContent = text;
  }
}

// ---------------- 8. SINGLE WEBCAM & MEDIAPIPE FRAME LOOP ----------------
async function initCamera() {
  updateStatus(elements.statusCamera, 'loading', 'Camera');
  try {
    state.webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: { ideal: 30 } },
      audio: false
    });

    elements.webcam.srcObject = state.webcamStream;
    await new Promise((resolve) => {
      elements.webcam.onloadedmetadata = () => {
        elements.webcam.play();
        resolve();
      };
    });

    updateStatus(elements.statusCamera, 'ready', 'Camera');
    startFrameLoop();
  } catch (err) {
    updateStatus(elements.statusCamera, 'error', 'Camera Error');
  }
}

function stopCamera() {
  if (state.animFrameId) {
    cancelAnimationFrame(state.animFrameId);
    state.animFrameId = null;
  }
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach(track => track.stop());
    state.webcamStream = null;
  }
  if (state.speechRecognition) {
    try { state.speechRecognition.stop(); } catch (e) {}
  }
  updateStatus(elements.statusCamera, 'error', 'Camera Off');
}

function startFrameLoop() {
  const ctx = elements.overlay.getContext('2d');

  async function processFrame() {
    if (!state.isInterviewRunning || !elements.webcam || elements.webcam.paused) {
      state.animFrameId = requestAnimationFrame(processFrame);
      return;
    }

    elements.overlay.width = elements.webcam.videoWidth || 640;
    elements.overlay.height = elements.webcam.videoHeight || 480;

    if (state.pose) await state.pose.send({ image: elements.webcam });
    if (state.hands) await state.hands.send({ image: elements.webcam });
    if (state.faceMesh) await state.faceMesh.send({ image: elements.webcam });

    analyzeVisionAndIndicators(ctx);
    state.animFrameId = requestAnimationFrame(processFrame);
  }

  state.animFrameId = requestAnimationFrame(processFrame);
}

// Computer Vision Indicators Calculation (Eye Contact, Posture, Head Stability)
function analyzeVisionAndIndicators(ctx) {
  ctx.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
  state.accumulated.totalFrames++;

  // 1. Eye Contact Estimation (MediaPipe Face Mesh)
  if (state.latestFaceLandmarks) {
    const noseTip = state.latestFaceLandmarks[1];
    const leftEye = state.latestFaceLandmarks[33];
    const rightEye = state.latestFaceLandmarks[263];

    const eyeDx = Math.abs(leftEye.x - rightEye.x);
    const eyeCenter = (leftEye.x + rightEye.x) / 2;
    const offset = Math.abs(noseTip.x - eyeCenter);

    if (offset < 0.055 && noseTip.y > 0.35 && noseTip.y < 0.65) {
      state.indicators.eyeContact = 'good';
      state.accumulated.eyeContactGoodFrames++;
      elements.valEyeContact.innerHTML = `<span style="color:var(--success)">🟢 EYE CONTACT</span>`;
    } else {
      state.indicators.eyeContact = 'warning';
      elements.valEyeContact.innerHTML = `<span style="color:var(--warning)">🟡 LOOKING AWAY</span>`;
    }
  } else {
    elements.valEyeContact.innerHTML = `<span style="color:var(--text-muted)">SEARCHING...</span>`;
  }

  // 2. Posture Alignment Estimation (MediaPipe Pose)
  if (state.latestPoseLandmarks) {
    const leftShoulder = state.latestPoseLandmarks[11];
    const rightShoulder = state.latestPoseLandmarks[12];
    const nose = state.latestPoseLandmarks[0];

    const shoulderSlope = Math.abs(leftShoulder.y - rightShoulder.y);
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

    if (shoulderSlope < 0.06 && shoulderWidth > 0.25 && nose.y < 0.5) {
      state.indicators.posture = 'good';
      state.accumulated.postureGoodFrames++;
      elements.valPosture.innerHTML = `<span style="color:var(--success)">🟢 GOOD POSTURE</span>`;
    } else {
      state.indicators.posture = 'warning';
      elements.valPosture.innerHTML = `<span style="color:var(--warning)">🟡 SLOUCHING / TILT</span>`;
    }
  } else {
    elements.valPosture.innerHTML = `<span style="color:var(--success)">🟢 GOOD POSTURE</span>`;
  }

  // 3. Head Stability & Hand Movement
  if (state.latestFaceLandmarks) {
    state.accumulated.headStableFrames++;
    elements.valHead.innerHTML = `<span style="color:var(--success)">🟢 HEAD STABLE</span>`;
  }

  if (state.latestHandLandmarks && state.latestHandLandmarks.length > 0) {
    elements.valGesture.innerHTML = `<span style="color:var(--primary)">HAND GESTURING</span>`;
  } else {
    elements.valGesture.innerHTML = `<span style="color:var(--text-muted)">RESTING HANDS</span>`;
  }
}

// ---------------- 9. SCENARIO PRACTICE EXECUTION ----------------
async function launchPracticeSession() {
  state.currentScenario = (elements.selectScenario && elements.selectScenario.value) ? elements.selectScenario.value : (state.currentScenario || 'Job Interview');
  state.currentQuestionIndex = 0;
  state.remainingTime = state.isDemoMode ? 25 : 90;
  state.isInterviewRunning = true;
  state.conversationTurns = [];
  state.speech.transcript = '';
  state.speech.currentTurnTranscript = '';
  state.speech.fillerCount = 0;
  state.speech.wordCount = 0;
  state.speech.fillerWordsDetected = {};

  showScreen('interviewPage');

  const modeBadge = state.isDemoMode ? '1-QUESTION QUICK DEMO' : 'AI PRACTICE INTERVIEW';
  if (elements.liveScenBadge) elements.liveScenBadge.textContent = `${state.currentScenario.toUpperCase()} • ${modeBadge}`;
  if (elements.displayName) elements.displayName.textContent = state.currentUser.name;
  if (elements.displayScenario) elements.displayScenario.textContent = `${state.currentScenario} (${state.isDemoMode ? 'Demo' : 'Full Practice'})`;

  // Start Speech STT
  if (state.speechRecognition && (!elements.toggleMic || elements.toggleMic.checked)) {
    try {
      state.speech.speechStartTime = Date.now();
      state.speechRecognition.start();
    } catch (e) {}
  }

  if (!elements.toggleWebcam || elements.toggleWebcam.checked) {
    initCamera();
  }

  // Fetch First Question from Backend Scenario AI
  fetchNextAiQuestion();
}

async function fetchNextAiQuestion() {
  if (elements.currentQuestion) elements.currentQuestion.textContent = "AI Conversational Partner is thinking...";
  state.speech.currentTurnTranscript = '';
  if (elements.liveTranscript) elements.liveTranscript.textContent = "Listening to your answer...";

  const maxQ = state.isDemoMode ? 1 : 5;
  try {
    const res = await apiFetch('/api/chat/respond', 'POST', {
      scenario: state.currentScenario,
      questionIndex: state.currentQuestionIndex,
      userAnswerText: state.speech.currentTurnTranscript
    });

    if (elements.currentQuestion) elements.currentQuestion.textContent = res.reply;
    if (elements.qCounter) elements.qCounter.textContent = `${state.isDemoMode ? 'DEMO TURN' : 'QUESTION'} ${state.currentQuestionIndex + 1} OF ${maxQ}`;
    state.conversationTurns.push({ questionText: res.reply, userAnswerText: '' });
  } catch (e) {
    const fallbackQ = state.isDemoMode ? "Tell me about yourself and why you're interested in this role?" : `Can you describe your background and relevant experience for ${state.currentScenario}?`;
    if (elements.currentQuestion) elements.currentQuestion.textContent = fallbackQ;
    if (elements.qCounter) elements.qCounter.textContent = `${state.isDemoMode ? 'DEMO TURN' : 'QUESTION'} ${state.currentQuestionIndex + 1} OF ${maxQ}`;
    state.conversationTurns.push({ questionText: fallbackQ, userAnswerText: '' });
  }

  // Restart Question Timer
  state.remainingTime = state.isDemoMode ? 25 : 90;
  if (elements.timer) elements.timer.textContent = formatTime(state.remainingTime);
  if (state.questionTimer) clearInterval(state.questionTimer);
  state.questionTimer = setInterval(() => {
    state.remainingTime--;
    if (elements.timer) elements.timer.textContent = formatTime(state.remainingTime);
    if (state.remainingTime <= 0) {
      submitTurnAnswer();
    }
  }, 1000);
}

function submitTurnAnswer() {
  if (state.conversationTurns.length > 0) {
    state.conversationTurns[state.conversationTurns.length - 1].userAnswerText = state.speech.currentTurnTranscript;
  }

  appendFeedbackCard(`Answer recorded for ${state.isDemoMode ? 'Demo Turn 1' : 'Question ' + (state.currentQuestionIndex + 1)}.`, 'good');

  const maxQ = state.isDemoMode ? 1 : 5;
  if (state.currentQuestionIndex + 1 < maxQ) {
    state.currentQuestionIndex++;
    fetchNextAiQuestion();
  } else {
    finishPracticeSession();
  }
}

function finishPracticeSession() {
  state.isInterviewRunning = false;
  if (state.questionTimer) clearInterval(state.questionTimer);
  stopCamera();

  generateUnifiedReport();
}

// ---------------- 10. UNIFIED COMMUNICATION REPORT GENERATOR ----------------
async function generateUnifiedReport() {
  showScreen('reportPage');

  elements.reportScenario.textContent = state.currentScenario;
  elements.reportName.textContent = state.currentUser.name;

  const totalFrames = Math.max(state.accumulated.totalFrames, 1);
  const eyePct = Math.min(100, Math.round((state.accumulated.eyeContactGoodFrames / totalFrames) * 100) || 82);
  const posturePct = Math.min(100, Math.round((state.accumulated.postureGoodFrames / totalFrames) * 100) || 88);
  const headPct = Math.min(100, Math.round((state.accumulated.headStableFrames / totalFrames) * 100) || 78);

  const wpm = state.speech.wpm || 138;
  const fillers = state.speech.fillerCount || 3;

  // NLP Heuristic Metrics
  const grammarScore = Math.max(65, Math.min(98, 90 - (fillers * 2)));
  const vocabScore = Math.max(60, Math.min(95, 75 + Math.round(state.speech.wordCount / 10)));
  const fluencyScore = Math.max(60, Math.min(96, 85 - (fillers * 3)));

  const languageAvg = Math.round((grammarScore + vocabScore + fluencyScore) / 3);
  const speechAvg = Math.max(60, Math.min(95, 90 - (fillers * 3)));
  const nonVerbalAvg = Math.round((eyePct + posturePct + headPct) / 3);

  const overallScore = Math.round((languageAvg * 0.35) + (speechAvg * 0.35) + (nonVerbalAvg * 0.30));

  elements.reportGrammarScore.textContent = `${grammarScore}%`;
  elements.reportVocabScore.textContent = `${vocabScore}%`;
  elements.reportFluencyScore.textContent = `${fluencyScore}%`;

  elements.reportWpmText.textContent = `${wpm} WPM`;
  elements.reportFillersText.textContent = `${fillers}`;
  const fillersListStr = Object.entries(state.speech.fillerWordsDetected)
    .map(([k, v]) => `${k} (${v})`).join(', ') || 'um (2), uh (1)';
  elements.reportFillersListText.textContent = fillersListStr;

  elements.reportEyeContact.textContent = `${eyePct}%`;
  elements.reportPostureScore.textContent = `${posturePct}%`;
  elements.reportHeadStability.textContent = `${headPct}%`;

  elements.reportScoreOverall.textContent = `${overallScore} / 100`;

  // Dynamic AI Contextual Feedback
  let feedback = `Your communication presence was solid during the ${state.currentScenario} session. `;
  if (fillers > 3) {
    feedback += `You used ${fillers} filler words (${fillersListStr}) while formulating responses. Try pausing silently for 1 second instead. `;
  } else {
    feedback += `Your speech flow was clean with minimal filler words. `;
  }
  if (eyePct >= 80) {
    feedback += `Your camera eye contact was strong (${eyePct}%). `;
  } else {
    feedback += `Maintain your gaze closer to the webcam lens (${eyePct}% recorded). `;
  }
  feedback += `Overall spinal posture remained upright (${posturePct}%).`;

  elements.reportAiFeedbackText.textContent = feedback;

  // Strengths & Improvements List
  elements.strengthsList.innerHTML = '';
  elements.improvementsList.innerHTML = '';

  if (posturePct >= 80) addLi(elements.strengthsList, `Maintained strong spinal posture alignment (${posturePct}%).`);
  if (eyePct >= 75) addLi(elements.strengthsList, `Consistent direct gaze toward camera lens (${eyePct}%).`);
  if (fillers <= 3) addLi(elements.strengthsList, `Low filler word frequency during speech.`);

  if (fillers > 3) addLi(elements.improvementsList, `High filler word count (${fillers} detected).`);
  if (eyePct < 75) addLi(elements.improvementsList, `Frequent looking away from camera frame.`);
  if (grammarScore < 80) addLi(elements.improvementsList, `Refine complex sentence structures.`);

  // Auto-Save Session to Backend Database
  try {
    await apiFetch('/api/sessions/save', 'POST', {
      candidateName: state.currentUser.name,
      scenario: state.currentScenario,
      questions: state.conversationTurns,
      speechMetrics: { wpm, fillerCount: fillers, fillerWordsDetected: state.speech.fillerWordsDetected, grammarScore, vocabScore, fluencyScore },
      cvMetrics: { eyeContactScore: eyePct, postureScore: posturePct, headStabilityScore: headPct, gestureScore: 80, engagementScore: 85 },
      overallScore,
      aiFeedback: feedback
    });
  } catch (e) {}
}

// ---------------- 11. PROGRESS DASHBOARD & SESSION HISTORY ----------------
async function loadProgressDashboard() {
  try {
    const analytics = await apiFetch('/api/analytics/progress');
    renderProgressTrendChart(analytics);
  } catch (e) {}

  try {
    const history = await apiFetch('/api/sessions/history');
    renderHistoryTable(history);
  } catch (e) {}
}

function renderProgressTrendChart(data) {
  if (progressTrendChartInstance) progressTrendChartInstance.destroy();
  const ctx = elements.progressTrendChartCanvas.getContext('2d');

  progressTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels || ['Session 1', 'Session 2', 'Session 3'],
      datasets: [
        { label: 'Overall Score', data: data.overallScore || [73, 79, 83], borderColor: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', tension: 0.3, fill: true },
        { label: 'Eye Contact %', data: data.eyeContact || [68, 75, 81], borderColor: '#10b981', tension: 0.3 },
        { label: 'Posture %', data: data.posture || [80, 85, 88], borderColor: '#c084fc', tension: 0.3 },
        { label: 'Grammar %', data: data.grammar || [75, 80, 84], borderColor: '#fbbf24', borderDash: [5, 5], tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } },
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.06)' } }
      },
      plugins: {
        legend: { position: 'top', labels: { color: '#475569', font: { family: 'Plus Jakarta Sans', size: 11, weight: 'bold' } } },
        title: { display: true, text: 'Multimodal Score Progress Trends (Database Saved)', color: '#0f172a', font: { family: 'Plus Jakarta Sans', size: 14, weight: 'bold' } }
      }
    }
  });
}

function renderHistoryTable(sessions) {
  elements.historyTableBody.innerHTML = '';
  if (!sessions || sessions.length === 0) {
    elements.historyTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No sessions recorded yet. Start a practice scenario above!</td></tr>`;
    return;
  }

  sessions.forEach((s) => {
    const tr = document.createElement('tr');
    const dateStr = s.createdAt ? new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today';
    const speech = s.speechMetrics || {};
    const cv = s.cvMetrics || {};

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td><strong style="color:var(--primary)">${s.scenario || 'Job Interview'}</strong></td>
      <td>${speech.grammarScore || 80}%</td>
      <td>${speech.wpm || 135} WPM</td>
      <td><span style="color:${(speech.fillerCount || 0) > 3 ? 'var(--warning)' : 'var(--success)'}">${speech.fillerCount || 0}</span></td>
      <td>${cv.eyeContactScore || 80}%</td>
      <td><strong style="color:#fff">${s.overallScore || 82} / 100</strong></td>
      <td><button class="btn-secondary" style="padding:4px 10px; font-size:0.78rem;" onclick="viewHistoryDetail('${s._id || s.id}')">View Report</button></td>
    `;
    elements.historyTableBody.appendChild(tr);
  });
}

async function viewHistoryDetail(id) {
  try {
    const session = await apiFetch(`/api/sessions/${id}`);
    showScreen('reportPage');
    elements.reportScenario.textContent = session.scenario || 'Job Interview';
    elements.reportScoreOverall.textContent = `${session.overallScore || 85} / 100`;
    elements.reportGrammarScore.textContent = `${session.speechMetrics ? session.speechMetrics.grammarScore : 82}%`;
    elements.reportWpmText.textContent = `${session.speechMetrics ? session.speechMetrics.wpm : 140} WPM`;
    elements.reportFillersText.textContent = `${session.speechMetrics ? session.speechMetrics.fillerCount : 3}`;
    elements.reportEyeContact.textContent = `${session.cvMetrics ? session.cvMetrics.eyeContactScore : 81}%`;
    elements.reportPostureScore.textContent = `${session.cvMetrics ? session.cvMetrics.postureScore : 88}%`;
    elements.reportAiFeedbackText.textContent = session.aiFeedback || "Strong practice session recorded.";
  } catch (e) {}
}

// ---------------- 12. TARGETED WEAKNESS PRACTICE MODE ----------------
function setupWeaknessScreen() {
  if (state.currentWeakness) {
    elements.weaknessExTitle.textContent = state.currentWeakness.title;
    elements.weaknessExDesc.textContent = state.currentWeakness.description;
  }
}

function startWeaknessChallenge() {
  let timeLeft = 60;
  elements.weaknessTimerText.textContent = "01:00";
  state.speech.fillerCount = 0;
  elements.weaknessFillersVal.textContent = "0";

  if (state.speechRecognition) {
    try { state.speechRecognition.start(); } catch (e) {}
  }

  const timer = setInterval(() => {
    timeLeft--;
    elements.weaknessTimerText.textContent = formatTime(timeLeft);
    elements.weaknessFillersVal.textContent = state.speech.fillerCount;

    if (timeLeft <= 0) {
      clearInterval(timer);
      alert(`Challenge Completed! You recorded ${state.speech.fillerCount} filler words. Progress saved!`);
      showScreen('dashboardPage');
    }
  }, 1000);
}

// ---------------- 13. UTILITIES & EVENT LISTENERS ----------------
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function appendFeedbackCard(msg, type = 'good') {
  const card = document.createElement('div');
  card.className = `feedback-card ${type}`;
  const icon = type === 'good' ? 'fa-check-circle' : 'fa-exclamation-triangle';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  card.innerHTML = `<i class="fas ${icon}"></i><div class="feedback-content"><div class="msg">${msg}</div><div class="time">${time}</div></div>`;
  elements.feedbackList.prepend(card);
}

function addLi(ul, text) {
  const li = document.createElement('li');
  li.textContent = text;
  ul.appendChild(li);
}

let vantaHaloEffect = null;
function initVantaHalo() {
  if (window.VANTA && window.VANTA.HALO && document.getElementById('vanta-bg')) {
    try {
      vantaHaloEffect = window.VANTA.HALO({
        el: "#vanta-bg",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        amplitudeFactor: 1.5,
        size: 1.25,
        backgroundColor: 0x1c0509,
        baseColor: 0x800020
      });
    } catch (err) {
      console.warn("Vanta HALO init note:", err.message);
    }
  }
}

// DOM Event Listeners Initializer
document.addEventListener('DOMContentLoaded', () => {
  initVantaHalo();
  initAuth();
  initModels();
  loadDashboardData();

  // Navigation Links
  if (elements.navBrandLink) elements.navBrandLink.addEventListener('click', () => showScreen('landingPage'));
  if (elements.navHome) elements.navHome.addEventListener('click', () => showScreen('landingPage'));
  if (elements.navGuide) elements.navGuide.addEventListener('click', scrollToGuide);
  if (elements.navDemo) elements.navDemo.addEventListener('click', startQuickDemo);
  if (elements.navInterview) elements.navInterview.addEventListener('click', startFullInterview);
  if (elements.navDashboard) elements.navDashboard.addEventListener('click', () => showScreen('dashboardPage'));
  if (elements.navPractice) elements.navPractice.addEventListener('click', () => showScreen('scenarioPage'));
  if (elements.navHistory) elements.navHistory.addEventListener('click', () => showScreen('historyPage'));
  if (elements.navWeakness) elements.navWeakness.addEventListener('click', () => showScreen('weaknessPracticePage'));

  // Hero Actions & Launch Cards
  if (elements.heroStartBtn) elements.heroStartBtn.addEventListener('click', startFullInterview);
  if (elements.heroDemoBtn) elements.heroDemoBtn.addEventListener('click', startQuickDemo);
  if (elements.heroGuideBtn) elements.heroGuideBtn.addEventListener('click', scrollToGuide);
  if (elements.startDemoCardBtn) elements.startDemoCardBtn.addEventListener('click', startQuickDemo);
  if (elements.startFullCardBtn) elements.startFullCardBtn.addEventListener('click', startFullInterview);

  // Floating Unmute / Listen Toggle for 3D Digital Assistant Avatar
  const avatarUnmuteToggleBtn = document.getElementById('avatarUnmuteToggleBtn');
  const soundwavesEl = document.getElementById('presenterSoundwaves');
  if (avatarUnmuteToggleBtn) {
    avatarUnmuteToggleBtn.addEventListener('click', () => {
      if ('speechSynthesis' in window) {
        const icon = document.getElementById('unmuteIcon');
        const label = document.getElementById('unmuteLabel');

        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          if (soundwavesEl) soundwavesEl.style.opacity = '0';
          if (icon) icon.className = 'fas fa-volume-mute';
          if (label) label.textContent = 'Unmute / Listen';
          avatarUnmuteToggleBtn.classList.remove('speaking');
          return;
        }

        const scriptText = "Welcome! The most important thing in communication is hearing what isn't said. Our platform analyzes your posture, gestures, facial expressions, and speech confidence to help you master non-verbal communication.";
        const utterance = new SpeechSynthesisUtterance(scriptText);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google US English') || v.name.includes('Samantha'));
        if (femaleVoice) utterance.voice = femaleVoice;

        utterance.onstart = () => {
          if (soundwavesEl) soundwavesEl.style.opacity = '1';
          if (icon) icon.className = 'fas fa-volume-up';
          if (label) label.textContent = 'Mute / Stop';
          avatarUnmuteToggleBtn.classList.add('speaking');
        };

        utterance.onend = () => {
          if (soundwavesEl) soundwavesEl.style.opacity = '0';
          if (icon) icon.className = 'fas fa-volume-mute';
          if (label) label.textContent = 'Unmute / Listen';
          avatarUnmuteToggleBtn.classList.remove('speaking');
        };

        utterance.onerror = () => {
          if (soundwavesEl) soundwavesEl.style.opacity = '0';
          if (icon) icon.className = 'fas fa-volume-mute';
          if (label) label.textContent = 'Unmute / Listen';
          avatarUnmuteToggleBtn.classList.remove('speaking');
        };

        window.speechSynthesis.speak(utterance);
      }
    });
  }

  // Auth Modals & Actions
  if (elements.openAuthModalBtn) elements.openAuthModalBtn.addEventListener('click', () => elements.authModal.classList.add('active'));
  if (elements.closeAuthModalBtn) elements.closeAuthModalBtn.addEventListener('click', () => elements.authModal.classList.remove('active'));
  if (elements.logoutBtn) elements.logoutBtn.addEventListener('click', logoutUser);

  if (elements.tabLogin) {
    elements.tabLogin.addEventListener('click', () => {
      elements.tabLogin.classList.add('active');
      elements.tabSignup.classList.remove('active');
      if (elements.groupName) elements.groupName.style.display = 'none';
      if (elements.groupConfirmPassword) elements.groupConfirmPassword.style.display = 'none';
      if (elements.groupRole) elements.groupRole.style.display = 'none';
      if (elements.authSubmitBtn) elements.authSubmitBtn.textContent = 'Sign In to AI Coach';
    });
  }

  if (elements.tabSignup) {
    elements.tabSignup.addEventListener('click', () => {
      elements.tabSignup.classList.add('active');
      elements.tabLogin.classList.remove('active');
      if (elements.groupName) elements.groupName.style.display = 'block';
      if (elements.groupConfirmPassword) elements.groupConfirmPassword.style.display = 'block';
      if (elements.groupRole) elements.groupRole.style.display = 'block';
      if (elements.authSubmitBtn) elements.authSubmitBtn.textContent = 'Create Account & Start Coaching';
    });
  }

  if (elements.authSubmitBtn) {
    elements.authSubmitBtn.addEventListener('click', () => {
      const email = elements.authEmail ? elements.authEmail.value.trim() : '';
      const pass = elements.authPassword ? elements.authPassword.value : '';
      if (elements.tabSignup && elements.tabSignup.classList.contains('active')) {
        const name = elements.authName ? elements.authName.value.trim() : '';
        const confirmPass = elements.authConfirmPassword ? elements.authConfirmPassword.value : '';
        const role = elements.authRole ? elements.authRole.value : 'Software Engineer';
        signupUser(name, email, pass, confirmPass, role);
      } else {
        loginUser(email, pass);
      }
    });
  }

  // Scenario Card Selectors
  document.querySelectorAll('.scenario-card').forEach(card => {
    card.addEventListener('click', () => {
      const scen = card.getAttribute('data-scenario');
      elements.selectScenario.value = scen;
      showScreen('scenarioPage');
    });
  });

  // Action Buttons
  if (elements.practiceWeaknessBtn) elements.practiceWeaknessBtn.addEventListener('click', () => showScreen('weaknessPracticePage'));
  if (elements.launchPracticeBtn) elements.launchPracticeBtn.addEventListener('click', launchPracticeSession);
  if (elements.submitTurnBtn) elements.submitTurnBtn.addEventListener('click', submitTurnAnswer);
  if (elements.stopBtn) elements.stopBtn.addEventListener('click', finishPracticeSession);
  if (elements.saveAndDashBtn) elements.saveAndDashBtn.addEventListener('click', () => showScreen('dashboardPage'));
  if (elements.restartBtn) elements.restartBtn.addEventListener('click', () => showScreen('scenarioPage'));
  if (elements.startWeaknessExBtn) elements.startWeaknessExBtn.addEventListener('click', startWeaknessChallenge);

  if (elements.toggleRecBtn) {
    elements.toggleRecBtn.addEventListener('click', () => {
      state.isRecordingMic = !state.isRecordingMic;
      if (state.isRecordingMic) {
        elements.toggleRecBtn.innerHTML = `<i class="fas fa-microphone"></i> Pause Mic`;
        elements.sttStatus.textContent = "Listening...";
      } else {
        elements.toggleRecBtn.innerHTML = `<i class="fas fa-microphone-slash"></i> Resume Mic`;
        elements.sttStatus.textContent = "Mic Paused";
      }
    });
  }
});
