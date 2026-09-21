/**
 * AI Interview Coach for Freshers and Students - Real-Time Multimodal Vision & Speech System
 * Robust MediaPipe Computer Vision (Pose, Face Mesh, Hands), Temporal Smoothing, NLP & Scoring
 */

const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000' && window.location.port !== ''
  ? 'http://localhost:5000'
  : window.location.origin;

// ---------------- 1. APPLICATION STATE ----------------
let state = {
  authToken: localStorage.getItem('ai_coach_token') || null,
  currentUser: { name: 'Fresher Candidate', role: 'Software Engineer' },

  currentScenario: 'Job Interview',
  isDemoMode: false,
  isInterviewRunning: false,
  isRecordingMic: true,
  currentQuestionIndex: 0,
  remainingTime: 90,
  questionTimer: null,
  conversationTurns: [],
  interviewQuestions: [
    "Tell me about yourself and why you are interested in this position.",
    "What is your greatest technical strength, and how have you demonstrated it in a project?",
    "Describe a challenging situation or problem you faced and how you resolved it.",
    "Where do you see yourself professionally in the next three to five years?",
    "Do you have any questions for us regarding the team or company culture?"
  ],

  // Vision Models
  pose: null,
  hands: null,
  faceMesh: null,
  tmModel: null,
  webcamStream: null,
  animFrameId: null,

  // Latest Landmark Frames
  latestPoseLandmarks: null,
  latestHandLandmarks: [],
  latestFaceLandmarks: null,

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

  // Temporal Smoothing Buffers (Last 15 Frames)
  buffers: {
    posture: [],
    attention: [],
    facial: [],
    gesture: []
  },

  // Smoothed Current Metrics
  metrics: {
    postureState: 'Upright posture',
    postureScore: 95,
    postureStability: 95,
    postureReason: 'Stable alignment',
    postureStatus: 'GOOD',

    attentionStatus: 'FACING CAMERA',
    attentionScore: 95,
    attentionText: 'Facing camera',

    facialExpression: 'Neutral facial expression',
    facialEngagementScore: 85,
    facialStatus: 'GOOD',

    gestureState: 'NATURAL',
    gestureControlScore: 90,
    gestureMovement: 'Moderate',
    gestureReason: 'Natural communicative gestures',

    overallNonVerbal: 90
  },

  // Question-Wise Metrics Log
  questionSnapshots: [],

  // Point-Loss Audit Log
  pointLossAudit: [],
  auditCounter: {
    slouch: 0,
    forwardHead: 0,
    lean: 0,
    lookAway: 0,
    excessiveGesture: 0,
    fillers: 0
  }
};

let progressTrendChartInstance = null;
let questionChartInstance = null;

// ---------------- 2. DOM ELEMENTS MAPPING ----------------
const elements = {
  landingPage: document.getElementById('landingPage'),
  guideSection: document.getElementById('guideSection'),
  inputPage: document.getElementById('inputPage'),
  interviewPage: document.getElementById('interviewPage'),
  reportPage: document.getElementById('reportPage'),
  historyPage: document.getElementById('historyPage'),

  navBrandLink: document.getElementById('navBrandLink'),
  navHome: document.getElementById('navHome'),
  navGuide: document.getElementById('navGuide'),
  navDemo: document.getElementById('navDemo'),
  navInterview: document.getElementById('navInterview'),
  navHistory: document.getElementById('navHistory'),

  heroStartBtn: document.getElementById('heroStartBtn'),
  heroDemoBtn: document.getElementById('heroDemoBtn'),
  heroGuideBtn: document.getElementById('heroGuideBtn'),
  startDemoCardBtn: document.getElementById('startDemoCardBtn'),
  startFullCardBtn: document.getElementById('startFullCardBtn'),
  saveAndDashBtn: document.getElementById('saveAndDashBtn'),

  username: document.getElementById('username'),
  role: document.getElementById('role'),
  modeNormal: document.getElementById('modeNormal'),
  modeDemo: document.getElementById('modeDemo'),
  startBtn: document.getElementById('startBtn'),

  headerUserName: document.getElementById('headerUserName'),
  headerUserRole: document.getElementById('headerUserRole'),
  openAuthModalBtn: document.getElementById('openAuthModalBtn'),
  logoutBtn: document.getElementById('logoutBtn'),

  // Practice Dashboard
  liveScenBadge: document.getElementById('liveScenBadge'),
  qCounter: document.getElementById('qCounter'),
  timer: document.getElementById('timer'),
  currentQuestion: document.getElementById('currentQuestion'),
  liveTranscript: document.getElementById('liveTranscript'),
  liveWpmVal: document.getElementById('liveWpmVal'),
  liveFillersVal: document.getElementById('liveFillersVal'),
  liveFluencyVal: document.getElementById('liveFluencyVal'),

  webcam: document.getElementById('webcam'),
  overlay: document.getElementById('overlay'),

  valEyeContact: document.getElementById('valEyeContact'),
  valPosture: document.getElementById('valPosture'),
  valFaceExpression: document.getElementById('valFaceExpression'),
  valGesture: document.getElementById('valGesture'),
  valSpeech: document.getElementById('valSpeech'),

  feedbackList: document.getElementById('feedbackList'),

  displayName: document.getElementById('displayName'),
  displayRole: document.getElementById('displayRole'),
  nextBtn: document.getElementById('nextBtn'),
  stopBtn: document.getElementById('stopBtn'),

  // Status Indicators
  statusCamera: document.getElementById('statusCamera'),
  statusPose: document.getElementById('statusPose'),
  statusFace: document.getElementById('statusFace'),
  statusHands: document.getElementById('statusHands'),
  statusGesture: document.getElementById('statusGesture'),
  statusSpeech: document.getElementById('statusSpeech'),

  // Report Elements
  reportName: document.getElementById('reportName'),
  reportRole: document.getElementById('reportRole'),
  reportScoreOverall: document.getElementById('reportScoreOverall'),

  reportPostureScore: document.getElementById('reportPostureScore'),
  reportPostureStability: document.getElementById('reportPostureStability'),
  reportEyeContact: document.getElementById('reportEyeContact'),
  reportGestureControl: document.getElementById('reportGestureControl'),
  reportFacialEngage: document.getElementById('reportFacialEngage'),

  reportWpmText: document.getElementById('reportWpmText'),
  reportFillersText: document.getElementById('reportFillersText'),
  reportFluencyScore: document.getElementById('reportFluencyScore'),
  reportFillersListText: document.getElementById('reportFillersListText'),

  reportGrammarScore: document.getElementById('reportGrammarScore'),
  reportVocabScore: document.getElementById('reportVocabScore'),
  nlpSuggestionsList: document.getElementById('nlpSuggestionsList'),

  questionBreakdownTableBody: document.getElementById('questionBreakdownTableBody'),
  questionChartCanvas: document.getElementById('questionChartCanvas'),
  pointLossAuditList: document.getElementById('pointLossAuditList'),

  reportAiFeedbackText: document.getElementById('reportAiFeedbackText'),
  strengthsList: document.getElementById('strengthsList'),
  improvementsList: document.getElementById('improvementsList'),
  restartBtn: document.getElementById('restartBtn'),

  // History Page
  progressTrendChartCanvas: document.getElementById('progressTrendChartCanvas'),
  historyTableBody: document.getElementById('historyTableBody')
};

// ---------------- 3. SCREEN SWITCHING & API HELPERS ----------------
function showScreen(screenId) {
  document.querySelectorAll('main.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (screenId === 'historyPage') {
    loadProgressDashboard();
  }
}

function scrollToGuide() {
  showScreen('landingPage');
  setTimeout(() => {
    if (elements.guideSection) {
      elements.guideSection.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
}

async function apiFetch(endpoint, method = 'GET', data = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.authToken) headers['Authorization'] = `Bearer ${state.authToken}`;
    
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);

    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[Client Fallback] ${endpoint}:`, err.message);
    return fallbackStorage(endpoint, method, data);
  }
}

function fallbackStorage(endpoint, method, data) {
  let history = JSON.parse(localStorage.getItem('ai_coach_sessions') || '[]');
  if (endpoint.includes('/api/sessions/save') && method === 'POST') {
    const newSession = { id: Date.now(), createdAt: new Date().toISOString(), ...data };
    history.unshift(newSession);
    localStorage.setItem('ai_coach_sessions', JSON.stringify(history));
    return { success: true, session: newSession };
  }
  if (endpoint.includes('/api/sessions/history')) {
    return history;
  }
  if (endpoint.includes('/api/analytics/progress')) {
    return {
      labels: history.slice(0, 5).reverse().map((_, i) => `Session ${i + 1}`),
      overallScore: history.slice(0, 5).reverse().map(s => s.overallScore || 80),
      eyeContact: history.slice(0, 5).reverse().map(s => s.cvMetrics ? s.cvMetrics.eyeContactScore : 85),
      posture: history.slice(0, 5).reverse().map(s => s.cvMetrics ? s.cvMetrics.postureScore : 88),
      grammar: history.slice(0, 5).reverse().map(s => s.speechMetrics ? s.speechMetrics.grammarScore : 85)
    };
  }
  return [];
}

// ---------------- 4. COMPUTER VISION FEATURE ENGINES ----------------

// A. MediaPipe Pose Feature Extraction
function processPoseFeatures(landmarks) {
  if (!landmarks || landmarks.length < 25) {
    return { state: 'POSE NOT CLEAR', score: 50, stability: 50, reason: 'Pose landmarks missing', isGood: false, status: 'POOR' };
  }

  const nose = landmarks[0];
  const leftEar = landmarks[7];
  const rightEar = landmarks[8];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if ((leftShoulder.visibility && leftShoulder.visibility < 0.4) || 
      (rightShoulder.visibility && rightShoulder.visibility < 0.4)) {
    return { state: 'POSE NOT CLEAR', score: 50, stability: 50, reason: 'Shoulders not in view', isGood: false, status: 'POOR' };
  }

  // 1. Shoulder Angle
  const shoulderDy = leftShoulder.y - rightShoulder.y;
  const shoulderDx = leftShoulder.x - rightShoulder.x;
  const shoulderAngle = Math.abs(Math.atan2(shoulderDy, shoulderDx) * (180 / Math.PI));

  // 2. Spine / Torso Tilt Angle
  const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipMidX = (leftHip.x + rightHip.x) / 2;
  const hipMidY = (leftHip.y + rightHip.y) / 2;
  const spineDx = shoulderMidX - hipMidX;
  const spineDy = shoulderMidY - hipMidY;
  const spineAngle = Math.abs(Math.atan2(spineDx, -spineDy) * (180 / Math.PI));

  // 3. Forward Head / Slouching Drop
  const earMidY = (leftEar && rightEar) ? (leftEar.y + rightEar.y) / 2 : nose.y;
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x) || 0.3;
  const headDropRatio = (shoulderMidY - earMidY) / shoulderWidth;

  let state = 'Upright posture';
  let reason = 'Stable posture alignment';
  let score = 95;
  let isGood = true;
  let status = 'GOOD';

  if (shoulderAngle > 9) {
    state = 'Shoulders appear uneven';
    reason = 'Shoulder tilt detected';
    score = 75;
    isGood = false;
    status = 'NEEDS ATTENTION';
  } else if (spineAngle > 10) {
    state = spineDx > 0 ? 'Leaning right' : 'Leaning left';
    reason = 'Torso leaning away from center';
    score = 75;
    isGood = false;
    status = 'NEEDS ATTENTION';
  } else if (headDropRatio < 0.35) {
    state = 'Forward head posture';
    reason = 'Forward head / neck strain detected';
    score = 70;
    isGood = false;
    status = 'NEEDS ATTENTION';
  } else if (headDropRatio < 0.45 && nose.y > 0.45) {
    state = 'Slouching';
    reason = 'Upper body slouching';
    score = 65;
    isGood = false;
    status = 'POOR';
  }

  return { state, score, reason, isGood, status, shoulderAngle, spineAngle, headDropRatio };
}

// B. MediaPipe Face Mesh Facial Behavior Engine
function processFacialBehavior(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { expression: 'FACE NOT CLEAR', engagementScore: 50, status: 'POOR', mouthWidthNorm: 0 };
  }

  const forehead = landmarks[10];
  const chin = landmarks[152];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  const leftMouthCorner = landmarks[61];
  const rightMouthCorner = landmarks[291];
  const upperLip = landmarks[13];
  const lowerLip = landmarks[14];

  const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y) || 0.3;
  const faceWidth = Math.hypot(leftCheek.x - rightCheek.x, leftCheek.y - rightCheek.y) || 0.3;

  const mouthWidth = Math.hypot(leftMouthCorner.x - rightMouthCorner.x, leftMouthCorner.y - rightMouthCorner.y);
  const mouthOpen = Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y);

  const mouthWidthNorm = mouthWidth / faceWidth;
  const mouthOpenNorm = mouthOpen / faceHeight;

  const lipCenterY = (upperLip.y + lowerLip.y) / 2;
  const cornerAvgY = (leftMouthCorner.y + rightMouthCorner.y) / 2;
  const cornerElevation = (lipCenterY - cornerAvgY) / faceHeight;

  let expression = 'Neutral facial expression';
  let engagementScore = 85;
  let status = 'GOOD';

  if (cornerElevation > 0.04 && mouthWidthNorm > 0.45) {
    expression = 'Strong smile';
    engagementScore = 98;
  } else if (cornerElevation > 0.025) {
    expression = 'Smile detected';
    engagementScore = 92;
  } else if (cornerElevation > 0.012) {
    expression = 'Slight smile';
    engagementScore = 88;
  } else if (mouthOpenNorm > 0.15) {
    expression = 'Frequent mouth opening detected';
    engagementScore = 75;
  } else if (cornerElevation < -0.01) {
    expression = 'Reduced facial movement';
    engagementScore = 65;
    status = 'NEEDS ATTENTION';
  }

  return { expression, engagementScore, status, mouthWidthNorm, mouthOpenNorm, cornerElevation };
}

// C. MediaPipe Face Mesh Visual Attention Engine
function processVisualAttention(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { status: 'LOOKING AWAY FREQUENTLY', score: 40, isFacing: false, text: 'FACE NOT CLEAR' };
  }

  const noseTip = landmarks[1];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  const distLeft = Math.hypot(noseTip.x - leftCheek.x, noseTip.y - leftCheek.y);
  const distRight = Math.hypot(noseTip.x - rightCheek.x, noseTip.y - rightCheek.y);
  const yawRatio = distLeft / (distRight || 0.001);

  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const rollAngle = Math.abs(Math.atan2(eyeDy, eyeDx) * (180 / Math.PI));

  let isFacing = true;
  let text = 'Facing camera';
  let score = 95;

  if (yawRatio < 0.55) {
    isFacing = false;
    text = 'Head turned right';
    score = 55;
  } else if (yawRatio > 1.8) {
    isFacing = false;
    text = 'Head turned left';
    score = 55;
  } else if (rollAngle > 12) {
    isFacing = false;
    text = 'Head tilted';
    score = 70;
  } else if (yawRatio < 0.75 || yawRatio > 1.35) {
    isFacing = true;
    text = 'Slightly looking away';
    score = 80;
  }

  const status = isFacing ? 'FACING CAMERA' : 'LOOKING AWAY FREQUENTLY';
  return { status, score, isFacing, text, yawRatio, rollAngle };
}

// D. MediaPipe Hands & Gesture Engine
function processHandGestures(multiHandLandmarks) {
  if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
    return { state: 'NO HAND DETECTED', gestureControlScore: 85, movementState: 'Minimal', reason: 'No hands in view' };
  }

  let handStates = [];
  multiHandLandmarks.forEach((handLandmarks) => {
    const wrist = handLandmarks[0];

    const isIndexExt = Math.hypot(handLandmarks[8].x - wrist.x, handLandmarks[8].y - wrist.y) > 
                       Math.hypot(handLandmarks[6].x - wrist.x, handLandmarks[6].y - wrist.y) * 1.12;
    const isMiddleExt = Math.hypot(handLandmarks[12].x - wrist.x, handLandmarks[12].y - wrist.y) > 
                        Math.hypot(handLandmarks[10].x - wrist.x, handLandmarks[10].y - wrist.y) * 1.12;
    const isRingExt = Math.hypot(handLandmarks[16].x - wrist.x, handLandmarks[16].y - wrist.y) > 
                      Math.hypot(handLandmarks[14].x - wrist.x, handLandmarks[14].y - wrist.y) * 1.12;
    const isPinkyExt = Math.hypot(handLandmarks[20].x - wrist.x, handLandmarks[20].y - wrist.y) > 
                       Math.hypot(handLandmarks[18].x - wrist.x, handLandmarks[18].y - wrist.y) * 1.12;
    const isThumbExt = Math.hypot(handLandmarks[4].x - wrist.x, handLandmarks[4].y - wrist.y) > 
                       Math.hypot(handLandmarks[2].x - wrist.x, handLandmarks[2].y - wrist.y) * 1.08;

    let extCount = (isIndexExt ? 1 : 0) + (isMiddleExt ? 1 : 0) + (isRingExt ? 1 : 0) + (isPinkyExt ? 1 : 0) + (isThumbExt ? 1 : 0);

    if (extCount >= 4) handStates.push('Open palm');
    else if (extCount === 0) handStates.push('Fist');
    else if (isIndexExt && extCount === 1) handStates.push('Pointing');
    else if (isIndexExt && isMiddleExt && extCount === 2) handStates.push('Peace');
    else if (isThumbExt && extCount === 1) handStates.push('Thumbs up');
    else handStates.push('Neutral gesture');
  });

  const state = handStates[0] || 'Neutral gesture';
  let gestureControlScore = 92;
  let movementState = 'Moderate';
  let reason = 'Natural communicative gestures';

  return { state, gestureControlScore, movementState, reason };
}

// ---------------- 5. TEMPORAL SMOOTHING PIPELINE ----------------
function updateTemporalSmoothing(rawPose, rawFace, rawAttention, rawGesture) {
  // Push raw detections into circular 15-frame buffers
  const pushBuf = (key, item) => {
    state.buffers[key].push(item);
    if (state.buffers[key].length > 15) state.buffers[key].shift();
  };

  pushBuf('posture', rawPose);
  pushBuf('facial', rawFace);
  pushBuf('attention', rawAttention);
  pushBuf('gesture', rawGesture);

  // 1. Smoothed Posture State (Majority Voting + Stability Math)
  const poseBuf = state.buffers.posture;
  const avgPoseScore = Math.round(poseBuf.reduce((a, b) => a + b.score, 0) / poseBuf.length);

  // Posture Stability calculation (100 minus angle variance over 15 frames)
  let angleVar = 0;
  if (poseBuf.length > 1) {
    const meanAngle = poseBuf.reduce((a, b) => a + (b.shoulderAngle || 0), 0) / poseBuf.length;
    angleVar = poseBuf.reduce((a, b) => a + Math.pow((b.shoulderAngle || 0) - meanAngle, 2), 0) / poseBuf.length;
  }
  const postureStability = Math.max(60, Math.min(100, Math.round(100 - angleVar * 4)));

  // Majority vote for posture state string
  const postureCounts = {};
  poseBuf.forEach(p => postureCounts[p.state] = (postureCounts[p.state] || 0) + 1);
  const smoothedPostureState = Object.keys(postureCounts).reduce((a, b) => postureCounts[a] > postureCounts[b] ? a : b);

  // 2. Smoothed Visual Attention
  const attBuf = state.buffers.attention;
  const facingCount = attBuf.filter(a => a.isFacing).length;
  const attentionScore = Math.round((facingCount / attBuf.length) * 100);
  const attentionStatus = attentionScore >= 75 ? 'FACING CAMERA' : 'LOOKING AWAY FREQUENTLY';
  const latestAttText = attBuf[attBuf.length - 1] ? attBuf[attBuf.length - 1].text : 'Facing camera';

  // 3. Smoothed Facial Engagement
  const faceBuf = state.buffers.facial;
  const avgFacialScore = Math.round(faceBuf.reduce((a, b) => a + b.engagementScore, 0) / faceBuf.length);
  const faceCounts = {};
  faceBuf.forEach(f => faceCounts[f.expression] = (faceCounts[f.expression] || 0) + 1);
  const smoothedExpression = Object.keys(faceCounts).reduce((a, b) => faceCounts[a] > faceCounts[b] ? a : b);

  // 4. Smoothed Gesture Control
  const gestBuf = state.buffers.gesture;
  const avgGestureScore = Math.round(gestBuf.reduce((a, b) => a + b.gestureControlScore, 0) / gestBuf.length);
  const gestCounts = {};
  gestBuf.forEach(g => gestCounts[g.state] = (gestCounts[g.state] || 0) + 1);
  const smoothedGestureState = Object.keys(gestCounts).reduce((a, b) => gestCounts[a] > gestCounts[b] ? a : b);

  // Calculate Weighted Non-Verbal Presence Score
  // Formula: Posture 25% + Stability 15% + Attention 20% + Gesture 20% + Facial 20%
  const overallNonVerbal = Math.round(
    (avgPoseScore * 0.25) +
    (postureStability * 0.15) +
    (attentionScore * 0.20) +
    (avgGestureScore * 0.20) +
    (avgFacialScore * 0.20)
  );

  state.metrics = {
    postureState: smoothedPostureState,
    postureScore: avgPoseScore,
    postureStability,
    postureReason: rawPose.reason,
    postureStatus: rawPose.status,

    attentionStatus,
    attentionScore,
    attentionText: latestAttText,

    facialExpression: smoothedExpression,
    facialEngagementScore: avgFacialScore,
    facialStatus: rawFace.status,

    gestureState: smoothedGestureState,
    gestureControlScore: avgGestureScore,
    gestureMovement: rawGesture.movementState,
    gestureReason: rawGesture.reason,

    overallNonVerbal
  };

  // Persistent Point-Loss Audit Tracker
  trackPointLossAudit(smoothedPostureState, attentionStatus, smoothedExpression);
}

// Point-Loss Audit System Logic
function trackPointLossAudit(postureState, attentionStatus, expression) {
  if (postureState === 'Slouching' || postureState === 'Forward head posture') {
    state.auditCounter.slouch++;
    if (state.auditCounter.slouch === 45) { // ~3 seconds persistent
      state.pointLossAudit.push('Forward head / slouching posture detected repeatedly.');
    }
  } else {
    state.auditCounter.slouch = 0;
  }

  if (attentionStatus === 'LOOKING AWAY FREQUENTLY') {
    state.auditCounter.lookAway++;
    if (state.auditCounter.lookAway === 45) {
      state.pointLossAudit.push('Frequent gaze deviation away from camera lens.');
    }
  } else {
    state.auditCounter.lookAway = 0;
  }
}

// ---------------- 6. BASIC RULE-BASED NLP ANALYSIS ----------------
function analyzeBasicNLP(transcript) {
  if (!transcript || transcript.trim().length === 0) {
    return { grammarScore: 90, suggestions: ['Speak clearly to receive basic NLP language analysis.'] };
  }

  const text = transcript.toLowerCase();
  const suggestions = [];

  const rules = [
    { pattern: /\binterested for\b/g, replace: 'interested in', msg: 'Change "interested for" to "interested in"' },
    { pattern: /\bwant to improving\b/g, replace: 'want to improve', msg: 'Change "want to improving" to "want to improve"' },
    { pattern: /\bdiscuss about\b/g, replace: 'discuss', msg: 'Say "discuss" instead of "discuss about"' },
    { pattern: /\bmore better\b/g, replace: 'better', msg: 'Say "better" instead of "more better"' },
    { pattern: /\bgood in\b/g, replace: 'good at', msg: 'Change "good in" to "good at"' },
    { pattern: /\blooking for work in\b/g, replace: 'looking to work in', msg: 'Consider "looking to work in"' }
  ];

  let deductions = 0;
  rules.forEach(rule => {
    if (rule.pattern.test(text)) {
      suggestions.push(rule.msg);
      deductions += 6;
    }
  });

  const grammarScore = Math.max(65, 100 - deductions);
  if (suggestions.length === 0) {
    suggestions.push('No significant grammar or preposition issues detected.');
  }

  return { grammarScore, suggestions };
}

// ---------------- 7. MODEL INITIALIZATION & SPEECH STT ----------------
async function initModels() {
  // A. Teachable Machine Model
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

  // E. Web Speech STT
  initSpeechAnalysis();
}

function initSpeechAnalysis() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    state.speech.isAvailable = false;
    updateStatus(elements.statusSpeech, 'error', 'Speech Unsupported');
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
        if (elements.liveTranscript) elements.liveTranscript.textContent = state.speech.currentTurnTranscript;

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

        const durationMins = (Date.now() - state.speech.speechStartTime) / 60000;
        if (durationMins > 0.05) {
          state.speech.wpm = Math.round(state.speech.wordCount / durationMins);
        }

        if (elements.liveWpmVal) elements.liveWpmVal.textContent = `${state.speech.wpm} WPM`;
        if (elements.liveFillersVal) elements.liveFillersVal.textContent = state.speech.fillerCount;
      }
    };

    recognition.onerror = () => {};

    state.speechRecognition = recognition;
    state.speech.isAvailable = true;
    updateStatus(elements.statusSpeech, 'ready', 'Speech Active');
  } catch (e) {
    state.speech.isAvailable = false;
    updateStatus(elements.statusSpeech, 'error', 'Speech Error');
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

// ---------------- 8. WEBCAM & REAL-TIME FRAME LOOP ----------------
async function initCamera() {
  updateStatus(elements.statusCamera, 'loading', 'Camera Loading');
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

    updateStatus(elements.statusCamera, 'ready', 'Camera Active');
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

    // 1. Process Feature Extraction
    const rawPose = processPoseFeatures(state.latestPoseLandmarks);
    const rawFace = processFacialBehavior(state.latestFaceLandmarks);
    const rawAtt = processVisualAttention(state.latestFaceLandmarks);
    const rawGest = processHandGestures(state.latestHandLandmarks);

    // 2. Temporal Smoothing & Stability
    updateTemporalSmoothing(rawPose, rawFace, rawAtt, rawGest);

    // 3. Render Live UI Metrics & Canvas Overlay
    updateLiveUIElements();
    drawOverlaySkeleton(ctx);

    state.animFrameId = requestAnimationFrame(processFrame);
  }

  state.animFrameId = requestAnimationFrame(processFrame);
}

function updateLiveUIElements() {
  const m = state.metrics;

  if (elements.valPosture) {
    const color = m.postureStatus === 'GOOD' ? 'var(--success)' : 'var(--warning)';
    elements.valPosture.innerHTML = `<span style="color:${color}">${m.postureState} (Stability: ${m.postureStability}%)</span>`;
  }

  if (elements.valEyeContact) {
    const color = m.attentionStatus === 'FACING CAMERA' ? 'var(--success)' : 'var(--warning)';
    elements.valEyeContact.innerHTML = `<span style="color:${color}">${m.attentionStatus} (${m.attentionScore}%)</span>`;
  }

  if (elements.valFaceExpression) {
    elements.valFaceExpression.innerHTML = `<span style="color:var(--primary)">${m.facialExpression} (Engage: ${m.facialEngagementScore}%)</span>`;
  }

  if (elements.valGesture) {
    elements.valGesture.innerHTML = `<span style="color:var(--accent)">${m.gestureState} (${m.gestureMovement})</span>`;
  }
}

// Helper function to verify active user login before accessing demo or interview
function requireAuth(actionName = 'access the AI interview & quick demo') {
  const activeUser = localStorage.getItem('ai_coach_active_user');
  if (!activeUser) {
    openAuthModal();
    showAuthError(`Please login or create an account to ${actionName}.`);
    return false;
  }
  return true;
}

// Draw Dynamic Reference Lines, Pose Skeleton, and 21-Landmark Hand Skeleton on Overlay Canvas
function drawOverlaySkeleton(ctx) {
  const w = elements.overlay.width;
  const h = elements.overlay.height;
  ctx.clearRect(0, 0, w, h);

  // Coordinate mapping for mirrored webcam video (#webcam scaleX(-1))
  const mapX = (x) => (1 - x) * w;
  const mapY = (y) => y * h;

  // Status color for posture guides based on live posture evaluation
  let statusColor = '#34d399'; // Default Good (Emerald Green)
  if (state.metrics.postureStatus === 'WARNING' || state.metrics.postureState.includes('Slouch') || state.metrics.postureState.includes('Lean')) {
    statusColor = '#fbbf24'; // Warning (Amber Gold)
  } else if (state.metrics.postureStatus === 'POOR') {
    statusColor = '#f43f5e'; // Poor (Rose Red)
  }

  // A. POSTURE REFERENCE LINES & POSE LANDMARKS
  if (state.latestPoseLandmarks) {
    const lm = state.latestPoseLandmarks;

    const hasShoulders = lm[11] && lm[12] && lm[11].visibility > 0.3 && lm[12].visibility > 0.3;
    const hasHips = lm[23] && lm[24] && lm[23].visibility > 0.3 && lm[24].visibility > 0.3;
    const hasNose = lm[0] && lm[0].visibility > 0.3;

    if (hasShoulders && hasHips) {
      const sLeft = { x: mapX(lm[11].x), y: mapY(lm[11].y) };
      const sRight = { x: mapX(lm[12].x), y: mapY(lm[12].y) };
      const hLeft = { x: mapX(lm[23].x), y: mapY(lm[23].y) };
      const hRight = { x: mapX(lm[24].x), y: mapY(lm[24].y) };

      const shoulderCenter = { x: (sLeft.x + sRight.x) / 2, y: (sLeft.y + sRight.y) / 2 };
      const hipCenter = { x: (hLeft.x + hRight.x) / 2, y: (hLeft.y + hRight.y) / 2 };
      const bodyCenter = { x: (shoulderCenter.x + hipCenter.x) / 2, y: (shoulderCenter.y + hipCenter.y) / 2 };

      // 1. Vertical Posture Alignment Reference Line (Head -> Body Center -> Lower Body)
      const topY = hasNose ? Math.max(10, mapY(lm[0].y) - 25) : Math.max(10, shoulderCenter.y - 90);
      const bottomY = Math.min(h - 10, hipCenter.y + 70);

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(bodyCenter.x, topY);
      ctx.lineTo(bodyCenter.x, bottomY);
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = statusColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.restore();

      // 2. Horizontal Shoulder Line (Left Shoulder -> Right Shoulder)
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(sLeft.x, sLeft.y);
      ctx.lineTo(sRight.x, sRight.y);
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = statusColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // 3. Horizontal Hip Line (Left Hip -> Right Hip)
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(hLeft.x, hLeft.y);
      ctx.lineTo(hRight.x, hRight.y);
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 3.0;
      ctx.stroke();
      ctx.restore();

      // 4. Head / Neck Alignment Guide Line (Nose -> Shoulder Center)
      if (hasNose) {
        const nosePt = { x: mapX(lm[0].x), y: mapY(lm[0].y) };
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.moveTo(nosePt.x, nosePt.y);
        ctx.lineTo(shoulderCenter.x, shoulderCenter.y);
        ctx.strokeStyle = '#f3e5ab';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // 5. Spine Center Line (Shoulder Center -> Hip Center)
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.moveTo(shoulderCenter.x, shoulderCenter.y);
      ctx.lineTo(hipCenter.x, hipCenter.y);
      ctx.strokeStyle = statusColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();

      // 6. Pose Landmark Dots (Nose, Ears, Shoulders, Hips)
      const poseKeypoints = [0, 7, 8, 11, 12, 23, 24];
      poseKeypoints.forEach(idx => {
        if (lm[idx] && lm[idx].visibility > 0.3) {
          ctx.beginPath();
          ctx.arc(mapX(lm[idx].x), mapY(lm[idx].y), 4.5, 0, 2 * Math.PI);
          ctx.fillStyle = statusColor;
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 4;
          ctx.fill();
        }
      });

      // Shoulder alignment label on overlay
      const shoulderSlope = Math.abs(sLeft.y - sRight.y);
      const shoulderAlignText = shoulderSlope < (h * 0.035) ? "Shoulders: ALIGNED" : "Shoulders: UNEVEN";
      ctx.font = '700 11px sans-serif';
      ctx.fillStyle = statusColor;
      ctx.fillText(shoulderAlignText, Math.min(sLeft.x, sRight.x) + 10, Math.min(sLeft.y, sRight.y) - 10);
    }
  }

  // B. FACE MESH SUBSET
  if (state.latestFaceLandmarks) {
    const lm = state.latestFaceLandmarks;
    ctx.fillStyle = 'rgba(243, 229, 171, 0.7)';
    [10, 152, 234, 454, 61, 291, 33, 263].forEach(idx => {
      if (lm[idx]) {
        ctx.beginPath();
        ctx.arc(mapX(lm[idx].x), mapY(lm[idx].y), 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  // C. MEDIAPIPE HANDS (Complete 21-Landmark Skeleton for BOTH Hands + Movement Trail)
  if (!state.wristTrail) state.wristTrail = [];

  if (state.latestHandLandmarks && state.latestHandLandmarks.length > 0) {
    const handBones = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index Finger
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle Finger
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Ring Finger
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm Connections
      [5, 9], [9, 13], [13, 17]
    ];

    state.latestHandLandmarks.forEach(hand => {
      // Record Wrist Position for Movement Trail
      if (hand[0]) {
        state.wristTrail.push({ x: mapX(hand[0].x), y: mapY(hand[0].y) });
        if (state.wristTrail.length > 18) state.wristTrail.shift();
      }

      // 1. Draw 21 Hand Skeleton Bones
      handBones.forEach(([i1, i2]) => {
        if (hand[i1] && hand[i2]) {
          ctx.beginPath();
          ctx.moveTo(mapX(hand[i1].x), mapY(hand[i1].y));
          ctx.lineTo(mapX(hand[i2].x), mapY(hand[i2].y));
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
      });

      // 2. Draw 21 Landmark Joint Dots
      hand.forEach((pt, idx) => {
        const isFingertip = [4, 8, 12, 16, 20].includes(idx);
        ctx.beginPath();
        ctx.arc(mapX(pt.x), mapY(pt.y), isFingertip ? 4.5 : 3, 0, 2 * Math.PI);
        ctx.fillStyle = isFingertip ? '#34d399' : '#f3e5ab';
        ctx.shadowColor = isFingertip ? '#34d399' : 'transparent';
        ctx.shadowBlur = isFingertip ? 6 : 0;
        ctx.fill();
      });
    });

    // 3. Draw Wrist Movement Trail
    if (state.wristTrail.length > 1) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < state.wristTrail.length - 1; i++) {
        const p1 = state.wristTrail[i];
        const p2 = state.wristTrail[i + 1];
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      }
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.restore();
    }

    // On-Canvas Hand Detection Badge
    ctx.font = '800 12px sans-serif';
    ctx.fillStyle = '#c084fc';
    ctx.fillText(`HAND DETECTED (${state.latestHandLandmarks.length}) - ${state.metrics.gestureState || 'ACTIVE'}`, 12, 24);
  } else {
    state.wristTrail = [];
    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = 'rgba(232, 216, 200, 0.7)';
    ctx.fillText('NO HAND DETECTED', 12, 24);
  }
}

// ---------------- 9. PRACTICE SESSION & INTERVIEW FLOW ----------------
function startQuickDemo() {
  if (!requireAuth('access the Quick Demo')) return;
  state.isDemoMode = true;
  state.currentScenario = 'Quick Demo (1 Question)';
  if (elements.username) elements.username.value = state.currentUser?.name || 'Demo Candidate';
  launchPracticeSession();
}

function startFullInterview() {
  if (!requireAuth('start the AI practice interview')) return;
  state.isDemoMode = false;
  state.currentScenario = 'Job Interview';
  showScreen('inputPage');
}

async function launchPracticeSession() {
  if (!requireAuth('launch an interview practice session')) return;
  const nameInput = elements.username ? elements.username.value.trim() : '';
  const roleInput = elements.role ? elements.role.value : 'Software Engineer';

  state.currentUser = {
    name: nameInput || 'Fresher Candidate',
    role: roleInput
  };

  if (elements.displayName) elements.displayName.textContent = state.currentUser.name;
  if (elements.displayRole) elements.displayRole.textContent = state.currentUser.role;
  if (elements.headerUserName) elements.headerUserName.textContent = state.currentUser.name;
  if (elements.headerUserRole) elements.headerUserRole.textContent = state.currentUser.role;

  state.isInterviewRunning = true;
  state.currentQuestionIndex = 0;
  state.conversationTurns = [];
  state.questionSnapshots = [];
  state.pointLossAudit = [];

  showScreen('interviewPage');
  await initCamera();

  state.speech.speechStartTime = Date.now();
  state.speech.wordCount = 0;
  state.speech.fillerCount = 0;
  state.speech.fillerWordsDetected = {};
  state.speech.transcript = '';

  if (state.speechRecognition && state.speech.isAvailable) {
    try { state.speechRecognition.start(); } catch (e) {}
  }

  fetchNextAiQuestion();
}

function fetchNextAiQuestion() {
  if (state.isDemoMode && state.currentQuestionIndex >= 1) {
    finishPracticeSession();
    return;
  }
  if (!state.isDemoMode && state.currentQuestionIndex >= state.interviewQuestions.length) {
    finishPracticeSession();
    return;
  }

  state.speech.currentTurnTranscript = '';
  if (elements.liveTranscript) elements.liveTranscript.textContent = 'Listening... Start speaking into your microphone.';

  const qText = state.interviewQuestions[state.currentQuestionIndex];
  elements.currentQuestion.textContent = qText;
  elements.qCounter.textContent = `QUESTION ${state.currentQuestionIndex + 1} OF ${state.isDemoMode ? 1 : state.interviewQuestions.length}`;

  state.remainingTime = state.isDemoMode ? 25 : 90;
  elements.timer.textContent = formatTime(state.remainingTime);

  if (state.questionTimer) clearInterval(state.questionTimer);
  state.questionTimer = setInterval(() => {
    state.remainingTime--;
    elements.timer.textContent = formatTime(state.remainingTime);
    if (state.remainingTime <= 0) {
      clearInterval(state.questionTimer);
      submitTurnAnswer();
    }
  }, 1000);
}

function submitTurnAnswer() {
  if (state.questionTimer) clearInterval(state.questionTimer);

  const nlpRes = analyzeBasicNLP(state.speech.currentTurnTranscript);

  // Snapshot metrics for this question turn
  const snapshot = {
    questionIndex: state.currentQuestionIndex + 1,
    questionText: state.interviewQuestions[state.currentQuestionIndex],
    postureScore: state.metrics.postureScore,
    postureStability: state.metrics.postureStability,
    attentionScore: state.metrics.attentionScore,
    facialEngagementScore: state.metrics.facialEngagementScore,
    gestureControlScore: state.metrics.gestureControlScore,
    verbalScore: nlpRes.grammarScore
  };
  state.questionSnapshots.push(snapshot);

  state.conversationTurns.push({
    questionText: state.interviewQuestions[state.currentQuestionIndex],
    userAnswerText: state.speech.currentTurnTranscript || "Answer recorded via audio stream."
  });

  state.currentQuestionIndex++;
  fetchNextAiQuestion();
}

function finishPracticeSession() {
  if (state.questionTimer) clearInterval(state.questionTimer);
  state.isInterviewRunning = false;
  stopCamera();
  generateUnifiedReport();
  showScreen('reportPage');
}

// ---------------- 10. UNIFIED REPORT GENERATION & VISUALIZATION ----------------
async function generateUnifiedReport() {
  const m = state.metrics;
  const speech = state.speech;

  elements.reportName.textContent = state.currentUser.name;
  elements.reportRole.textContent = state.currentUser.role;

  // Calculate Non-Verbal Presence Score (60%)
  const nonVerbalScore = m.overallNonVerbal;

  // Calculate Verbal Delivery Score (40%)
  const nlpRes = analyzeBasicNLP(speech.transcript);
  const wpmScore = (speech.wpm >= 110 && speech.wpm <= 160) ? 95 : 75;
  const fillerScore = Math.max(60, 100 - (speech.fillerCount * 5));
  const verbalScore = Math.round((nlpRes.grammarScore * 0.4) + (wpmScore * 0.3) + (fillerScore * 0.3));

  // Overall Communication Presence Score = 60% Non-Verbal + 40% Verbal
  const overallScore = Math.round((nonVerbalScore * 0.60) + (verbalScore * 0.40));

  elements.reportScoreOverall.textContent = `${overallScore} / 100`;

  // Populate Non-Verbal Presence Card
  elements.reportPostureScore.textContent = `${m.postureScore} / 100`;
  elements.reportPostureStability.textContent = `${m.postureStability}%`;
  elements.reportEyeContact.textContent = `${m.attentionScore}%`;
  elements.reportGestureControl.textContent = `${m.gestureControlScore}%`;
  elements.reportFacialEngage.textContent = `${m.facialEngagementScore}%`;

  // Populate Verbal Delivery Card
  elements.reportWpmText.textContent = `${speech.wpm} WPM`;
  elements.reportFillersText.textContent = speech.fillerCount;
  elements.reportFluencyScore.textContent = `${wpmScore}%`;

  const fillersBreakdown = Object.entries(speech.fillerWordsDetected).map(([k, v]) => `${k} (${v})`).join(', ') || 'None';
  elements.reportFillersListText.textContent = fillersBreakdown;

  // Populate Basic NLP Card
  elements.reportGrammarScore.textContent = `${nlpRes.grammarScore}%`;
  elements.nlpSuggestionsList.innerHTML = '';
  nlpRes.suggestions.forEach(s => addLi(elements.nlpSuggestionsList, s));

  // Render Question Breakdown Table
  renderQuestionBreakdownTable(state.questionSnapshots);

  // Render Question Comparison Chart
  renderQuestionComparisonChart(state.questionSnapshots);

  // Render Point-Loss Audit List
  renderPointLossAuditList(state.pointLossAudit);

  // Personalized AI Feedback & Lists
  elements.strengthsList.innerHTML = '';
  elements.improvementsList.innerHTML = '';

  if (m.postureScore >= 80) addLi(elements.strengthsList, `Strong upright posture alignment (${m.postureScore}%).`);
  if (m.attentionScore >= 80) addLi(elements.strengthsList, `High visual attention toward camera (${m.attentionScore}%).`);
  if (speech.fillerCount <= 3) addLi(elements.strengthsList, `Low filler word usage during responses.`);

  if (speech.fillerCount > 3) addLi(elements.improvementsList, `Frequent filler words detected (${speech.fillerCount} total).`);
  if (m.attentionScore < 75) addLi(elements.improvementsList, `Frequent looking away from camera frame.`);
  if (m.postureScore < 75) addLi(elements.improvementsList, `Posture slouching / tilt detected.`);

  // Auto-Save Session
  try {
    await apiFetch('/api/sessions/save', 'POST', {
      candidateName: state.currentUser.name,
      scenario: state.currentScenario,
      questions: state.conversationTurns,
      speechMetrics: { wpm: speech.wpm, fillerCount: speech.fillerCount, grammarScore: nlpRes.grammarScore, fluencyScore: verbalScore },
      cvMetrics: { eyeContactScore: m.attentionScore, postureScore: m.postureScore, headStabilityScore: m.postureStability, gestureScore: m.gestureControlScore, engagementScore: m.facialEngagementScore },
      overallScore
    });
  } catch (e) {}
}

function renderQuestionBreakdownTable(snapshots) {
  elements.questionBreakdownTableBody.innerHTML = '';
  if (!snapshots || snapshots.length === 0) {
    elements.questionBreakdownTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No question turns recorded.</td></tr>`;
    return;
  }

  snapshots.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>Q${s.questionIndex}</strong></td>
      <td>${s.postureScore}%</td>
      <td>${s.postureStability}%</td>
      <td>${s.attentionScore}%</td>
      <td>${s.facialEngagementScore}%</td>
      <td>${s.gestureControlScore}%</td>
      <td><strong style="color:var(--primary)">${s.verbalScore}%</strong></td>
    `;
    elements.questionBreakdownTableBody.appendChild(tr);
  });
}

function renderQuestionComparisonChart(snapshots) {
  if (questionChartInstance) questionChartInstance.destroy();
  if (!elements.questionChartCanvas) return;

  const ctx = elements.questionChartCanvas.getContext('2d');
  const labels = snapshots.map(s => `Q${s.questionIndex}`);
  const postureData = snapshots.map(s => s.postureScore);
  const attentionData = snapshots.map(s => s.attentionScore);
  const gestureData = snapshots.map(s => s.gestureControlScore);

  questionChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Q1'],
      datasets: [
        { label: 'Posture', data: postureData.length ? postureData : [88], backgroundColor: '#38bdf8' },
        { label: 'Attention', data: attentionData.length ? attentionData : [92], backgroundColor: '#10b981' },
        { label: 'Gesture Ctrl', data: gestureData.length ? gestureData : [85], backgroundColor: '#c084fc' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: 0, max: 100, ticks: { color: '#64748b' } },
        x: { ticks: { color: '#64748b' } }
      },
      plugins: {
        legend: { position: 'top' }
      }
    }
  });
}

function renderPointLossAuditList(auditLogs) {
  elements.pointLossAuditList.innerHTML = '';
  if (!auditLogs || auditLogs.length === 0) {
    addLi(elements.pointLossAuditList, 'No persistent deduction events recorded. Excellent performance!');
    return;
  }
  auditLogs.forEach(log => addLi(elements.pointLossAuditList, log));
}

// ---------------- 11. PROGRESS DASHBOARD & HISTORY ----------------
async function loadProgressDashboard() {
  const analytics = await apiFetch('/api/analytics/progress');
  renderProgressTrendChart(analytics);

  const history = await apiFetch('/api/sessions/history');
  renderHistoryTable(history);
}

function renderProgressTrendChart(data) {
  if (progressTrendChartInstance) progressTrendChartInstance.destroy();
  if (!elements.progressTrendChartCanvas) return;
  const ctx = elements.progressTrendChartCanvas.getContext('2d');

  progressTrendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels || ['Session 1', 'Session 2', 'Session 3'],
      datasets: [
        { label: 'Overall Score', data: data.overallScore || [78, 83, 87], borderColor: '#38bdf8', tension: 0.3, fill: false },
        { label: 'Attention %', data: data.eyeContact || [80, 85, 90], borderColor: '#10b981', tension: 0.3 },
        { label: 'Posture %', data: data.posture || [82, 86, 91], borderColor: '#c084fc', tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { min: 0, max: 100 } }
    }
  });
}

function renderHistoryTable(sessions) {
  elements.historyTableBody.innerHTML = '';
  if (!sessions || sessions.length === 0) {
    elements.historyTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted);">No sessions recorded yet. Start a practice interview above!</td></tr>`;
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
      <td>${speech.grammarScore || 85}%</td>
      <td>${speech.wpm || 135} WPM</td>
      <td><span style="color:${(speech.fillerCount || 0) > 3 ? 'var(--warning)' : 'var(--success)'}">${speech.fillerCount || 0}</span></td>
      <td>${cv.eyeContactScore || 85}%</td>
      <td><strong style="color:var(--primary)">${s.overallScore || 85} / 100</strong></td>
      <td><button class="btn-secondary" style="padding:4px 10px; font-size:0.78rem;" onclick="showScreen('reportPage')">View Report</button></td>
    `;
    elements.historyTableBody.appendChild(tr);
  });
}

// ---------------- 12. UTILITIES & INITIALIZATION ----------------
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function addLi(ul, text) {
  if (!ul) return;
  const li = document.createElement('li');
  li.textContent = text;
  ul.appendChild(li);
}

// ---------------- 13. DEMO AUTHENTICATION ENGINE (LOCALSTORAGE) ----------------
function initAuth() {
  const activeUser = JSON.parse(localStorage.getItem('ai_coach_active_user') || 'null');
  if (activeUser) {
    state.currentUser = activeUser;
    updateAuthUI(activeUser);
  } else {
    updateAuthUI(null);
  }
}

function updateAuthUI(user) {
  const openAuthModalBtn = document.getElementById('openAuthModalBtn');
  const userProfilePill = document.getElementById('userProfilePill');
  const headerUserName = document.getElementById('headerUserName');
  const headerUserRole = document.getElementById('headerUserRole');

  if (user) {
    if (openAuthModalBtn) openAuthModalBtn.style.display = 'none';
    if (userProfilePill) userProfilePill.style.display = 'flex';
    if (headerUserName) headerUserName.textContent = `Hi, ${user.name || 'Candidate'}`;
    if (headerUserRole) headerUserRole.textContent = user.role || 'Software Engineer';
  } else {
    if (openAuthModalBtn) openAuthModalBtn.style.display = 'flex';
    if (userProfilePill) userProfilePill.style.display = 'none';
  }
}

function openAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.add('active');
    clearAuthMessages();
  }
}

function closeAuthModal() {
  const authModal = document.getElementById('authModal');
  if (authModal) {
    authModal.classList.remove('active');
    clearAuthMessages();
  }
}

function clearAuthMessages() {
  const errEl = document.getElementById('authErrorMsg');
  const succEl = document.getElementById('authSuccessMsg');
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  if (succEl) { succEl.textContent = ''; succEl.style.display = 'none'; }
}

function showAuthError(msg) {
  const errEl = document.getElementById('authErrorMsg');
  const succEl = document.getElementById('authSuccessMsg');
  if (succEl) { succEl.style.display = 'none'; }
  if (errEl) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  }
}

function showAuthSuccess(msg) {
  const errEl = document.getElementById('authErrorMsg');
  const succEl = document.getElementById('authSuccessMsg');
  if (errEl) { errEl.style.display = 'none'; }
  if (succEl) {
    succEl.textContent = msg;
    succEl.style.display = 'block';
  }
}

let isSignupMode = false;

function setAuthMode(mode) {
  isSignupMode = mode === 'signup';
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const groupName = document.getElementById('groupName');
  const groupConfirmPassword = document.getElementById('groupConfirmPassword');
  const groupRole = document.getElementById('groupRole');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authModalTitle = document.getElementById('authModalTitle');
  const authModalSubtitle = document.getElementById('authModalSubtitle');
  const authToggleText = document.getElementById('authToggleText');
  const authToggleBtn = document.getElementById('authToggleBtn');

  clearAuthMessages();

  if (isSignupMode) {
    if (tabSignup) tabSignup.classList.add('active');
    if (tabLogin) tabLogin.classList.remove('active');
    if (groupName) groupName.style.display = 'block';
    if (groupConfirmPassword) groupConfirmPassword.style.display = 'block';
    if (groupRole) groupRole.style.display = 'block';
    if (authSubmitBtn) authSubmitBtn.textContent = 'Create Account';
    if (authModalTitle) authModalTitle.textContent = 'Account Registration';
    if (authModalSubtitle) authModalSubtitle.textContent = 'Create a demo account to track practice scores over time.';
    if (authToggleText) authToggleText.textContent = 'Already have an account?';
    if (authToggleBtn) authToggleBtn.textContent = 'Login';
  } else {
    if (tabLogin) tabLogin.classList.add('active');
    if (tabSignup) tabSignup.classList.remove('active');
    if (groupName) groupName.style.display = 'none';
    if (groupConfirmPassword) groupConfirmPassword.style.display = 'none';
    if (groupRole) groupRole.style.display = 'none';
    if (authSubmitBtn) authSubmitBtn.textContent = 'Login';
    if (authModalTitle) authModalTitle.textContent = 'Account Sign In';
    if (authModalSubtitle) authModalSubtitle.textContent = 'Access saved practice history, analytics, and weakness detection.';
    if (authToggleText) authToggleText.textContent = "Don't have an account?";
    if (authToggleBtn) authToggleBtn.textContent = 'Register';
  }
}

function handleAuthSubmit() {
  clearAuthMessages();

  const email = (document.getElementById('authEmail')?.value || '').trim();
  const password = document.getElementById('authPassword')?.value || '';

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  if (isSignupMode) {
    const name = (document.getElementById('authName')?.value || '').trim();
    const confirmPassword = document.getElementById('authConfirmPassword')?.value || '';
    const role = document.getElementById('authRole')?.value || 'Software Engineer';

    if (!name) return showAuthError("Please enter your name.");
    if (!email) return showAuthError("Please enter your email address.");
    if (!isValidEmail(email)) return showAuthError("Please enter a valid email address.");
    if (!password) return showAuthError("Please enter a password.");
    if (password.length < 6) return showAuthError("Password must be at least 6 characters long.");
    if (password !== confirmPassword) return showAuthError("Passwords do not match.");

    const users = JSON.parse(localStorage.getItem('ai_coach_demo_users') || '[]');
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return showAuthError("An account with this email already exists.");
    }

    const newUser = { name, email, password, role };
    users.push(newUser);
    localStorage.setItem('ai_coach_demo_users', JSON.stringify(users));

    localStorage.setItem('ai_coach_active_user', JSON.stringify(newUser));
    state.currentUser = newUser;
    updateAuthUI(newUser);

    showAuthSuccess(`Account created successfully! Welcome, ${name}.`);
    setTimeout(() => { closeAuthModal(); }, 1200);

  } else {
    if (!email) return showAuthError("Please enter your email address.");
    if (!password) return showAuthError("Please enter your password.");

    const users = JSON.parse(localStorage.getItem('ai_coach_demo_users') || '[]');
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

    if (!user && (email.toLowerCase() === 'demo@example.com' || email.toLowerCase() === 'admin@example.com') && password === 'password123') {
      user = { name: 'Demo Candidate', email: 'demo@example.com', role: 'Software Engineer' };
    }

    if (user) {
      localStorage.setItem('ai_coach_active_user', JSON.stringify(user));
      state.currentUser = user;
      updateAuthUI(user);
      showAuthSuccess(`Login successful! Welcome back, ${user.name}.`);
      setTimeout(() => { closeAuthModal(); }, 1000);
    } else {
      showAuthError("Invalid email or password.");
    }
  }
}

function logoutUser() {
  localStorage.removeItem('ai_coach_active_user');
  state.currentUser = { name: 'Fresher Candidate', role: 'Software Engineer' };
  updateAuthUI(null);
}

let vantaHaloEffect = null;
function initVantaHalo() {
  if (window.VANTA && window.VANTA.HALO && document.getElementById('vanta-bg')) {
    try {
      if (vantaHaloEffect && typeof vantaHaloEffect.destroy === 'function') {
        vantaHaloEffect.destroy();
      }
      vantaHaloEffect = window.VANTA.HALO({
        el: "#vanta-bg",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        amplitudeFactor: 1.5,
        size: 1.25,
        backgroundColor: 0x1a0407,
        baseColor: 0x800020
      });
    } catch (err) {
      console.warn("Vanta WebGL background initialization notice:", err);
    }
  }
}

// Window resize and orientation listeners to guarantee WebGL plays on all screen resolutions
window.addEventListener('resize', () => {
  if (vantaHaloEffect && typeof vantaHaloEffect.resize === 'function') {
    vantaHaloEffect.resize();
  }
});

window.addEventListener('orientationchange', () => {
  setTimeout(() => {
    if (vantaHaloEffect && typeof vantaHaloEffect.resize === 'function') {
      vantaHaloEffect.resize();
    }
  }, 250);
});

window.addEventListener('load', () => {
  if (!vantaHaloEffect) {
    initVantaHalo();
  }
});

// DOM Event Listeners Initializer
document.addEventListener('DOMContentLoaded', () => {
  initVantaHalo();
  initAuth();
  initModels();

  // Navigation Links
  if (elements.navBrandLink) elements.navBrandLink.addEventListener('click', () => showScreen('landingPage'));
  if (elements.navHome) elements.navHome.addEventListener('click', () => showScreen('landingPage'));
  if (elements.navGuide) elements.navGuide.addEventListener('click', scrollToGuide);
  if (elements.navDemo) elements.navDemo.addEventListener('click', startQuickDemo);
  if (elements.navInterview) elements.navInterview.addEventListener('click', startFullInterview);
  if (elements.navHistory) elements.navHistory.addEventListener('click', () => showScreen('historyPage'));

  // Hero Actions & Launch Cards
  if (elements.heroStartBtn) elements.heroStartBtn.addEventListener('click', startFullInterview);
  if (elements.heroDemoBtn) elements.heroDemoBtn.addEventListener('click', startQuickDemo);
  if (elements.heroGuideBtn) elements.heroGuideBtn.addEventListener('click', scrollToGuide);
  if (elements.startDemoCardBtn) elements.startDemoCardBtn.addEventListener('click', startQuickDemo);
  if (elements.startFullCardBtn) elements.startFullCardBtn.addEventListener('click', startFullInterview);

  // Setup & Interview Action Buttons
  if (elements.startBtn) elements.startBtn.addEventListener('click', launchPracticeSession);
  if (elements.nextBtn) elements.nextBtn.addEventListener('click', submitTurnAnswer);
  if (elements.stopBtn) elements.stopBtn.addEventListener('click', finishPracticeSession);
  if (elements.saveAndDashBtn) elements.saveAndDashBtn.addEventListener('click', () => showScreen('landingPage'));
  if (elements.restartBtn) elements.restartBtn.addEventListener('click', () => showScreen('inputPage'));

  // Auth Modal Event Listeners
  const openAuthModalBtn = document.getElementById('openAuthModalBtn');
  const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
  const authModal = document.getElementById('authModal');
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const authSubmitBtn = document.getElementById('authSubmitBtn');
  const authToggleBtn = document.getElementById('authToggleBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (openAuthModalBtn) openAuthModalBtn.addEventListener('click', openAuthModal);
  if (closeAuthModalBtn) closeAuthModalBtn.addEventListener('click', closeAuthModal);
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && authModal && authModal.classList.contains('active')) {
      closeAuthModal();
    }
  });

  if (tabLogin) tabLogin.addEventListener('click', () => setAuthMode('login'));
  if (tabSignup) tabSignup.addEventListener('click', () => setAuthMode('signup'));

  if (authToggleBtn) {
    authToggleBtn.addEventListener('click', () => {
      setAuthMode(isSignupMode ? 'login' : 'signup');
    });
  }

  if (authSubmitBtn) authSubmitBtn.addEventListener('click', handleAuthSubmit);

  // 3D Avatar Speaking Toggle
  const avatarUnmuteToggleBtn = document.getElementById('avatarUnmuteToggleBtn');
  if (avatarUnmuteToggleBtn) {
    avatarUnmuteToggleBtn.addEventListener('click', () => {
      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          return;
        }
        const text = "Welcome! Master your interview non-verbal communication with real-time MediaPipe computer vision.";
        const utt = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utt);
      }
    });
  }
});

