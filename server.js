const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

const JWT_SECRET = "ai_communication_coach_secret_key_2026";

// ---------------- 1. MONGODB CONNECTION WITH FALLBACK ----------------
let isMongoConnected = false;

mongoose.connect("mongodb+srv://BethaSailu:Shaiksabiya%408@ai-body-language-coach.77snppj.mongodb.net/ai_body_language")
  .then(() => {
    isMongoConnected = true;
    console.log("✅ MongoDB Atlas connected successfully");
  })
  .catch(err => {
    isMongoConnected = false;
    console.error("⚠️ MongoDB Atlas connection notice (running with fallback storage):", err.message);
  });

// In-Memory Storage Fallback if DB is unreachable
const memoryStore = {
  users: [],
  sessions: [],
  weaknesses: []
};

// ---------------- 2. MONGOOSE SCHEMAS & MODELS ----------------
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "Candidate" },
  createdAt: { type: Date, default: Date.now }
});

const SessionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  candidateName: { type: String, default: "Candidate" },
  scenario: { type: String, default: "Job Interview" },
  questions: [{
    questionText: String,
    userAnswerText: String
  }],
  speechMetrics: {
    wpm: Number,
    fillerCount: Number,
    fillerWordsDetected: Object,
    grammarScore: Number,
    vocabScore: Number,
    fluencyScore: Number
  },
  cvMetrics: {
    eyeContactScore: Number,
    postureScore: Number,
    headStabilityScore: Number,
    gestureScore: Number,
    engagementScore: Number
  },
  overallScore: Number,
  aiFeedback: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Session = mongoose.model("Session", SessionSchema);

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.userId = "guest_user";
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    req.userId = "guest_user";
    next();
  }
};

// ---------------- 3. AUTHENTICATION ENDPOINTS ----------------
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (isMongoConnected) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }
      const user = new User({ name, email: email.toLowerCase(), password: hashedPassword, role: role || "Software Engineer" });
      await user.save();

      const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ message: "Sign up successful!", token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } else {
      const existing = memoryStore.users.find(u => u.email === email.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: "An account with this email already exists." });
      }
      const userId = "user_" + Date.now();
      const newUser = { id: userId, name, email: email.toLowerCase(), password: hashedPassword, role: role || "Software Engineer" };
      memoryStore.users.push(newUser);

      const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ message: "Sign up successful!", token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    let user = null;
    if (isMongoConnected) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else {
      user = memoryStore.users.find(u => u.email === email.toLowerCase());
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const userId = user._id ? user._id.toString() : user.id;
    const token = jwt.sign({ userId, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Login successful!",
      token,
      user: { id: userId, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    if (req.userId === "guest_user") {
      return res.json({ user: { id: "guest_user", name: "Guest Candidate", email: "guest@example.com", role: "Fresher Candidate" } });
    }

    if (isMongoConnected) {
      const user = await User.findById(req.userId).select("-password");
      if (user) return res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } else {
      const user = memoryStore.users.find(u => u.id === req.userId);
      if (user) return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }

    res.json({ user: { id: req.userId, name: "Candidate User", email: "user@example.com", role: "Candidate" } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- 4. AI CONVERSATIONAL PARTNER ENDPOINT ----------------
const SCENARIO_RESPONSES = {
  "Job Interview": [
    "Thank you for sharing that. Can you tell me about a time you solved a difficult technical problem under tight deadlines?",
    "Great explanation. How do you handle constructive criticism and disagreements with team members?",
    "Impressive. Where do you see your technical and leadership skills developing over the next 3 to 5 years?",
    "Excellent response. Do you have any questions for us regarding our team culture or tech stack?"
  ],
  "HR Interview": [
    "That sounds interesting! How do your personal values align with our company culture?",
    "Can you share an experience where you had to adapt quickly to unexpected organizational changes?",
    "What motivates you to perform at your best every day in a fast-paced work environment?",
    "Wonderful! Is there anything specific about our benefits or career development programs you'd like to ask?"
  ],
  "Presentation Practice": [
    "Solid point! How would you summarize the key takeaway of this slide for an executive audience?",
    "Good structure. How do you plan to handle challenging Q&A questions from stakeholders during your talk?",
    "That engaged the audience well. What visual aids or data points best support your thesis here?",
    "Great presentation flow! Conclude with a strong call to action for the audience."
  ],
  "Professional Conversation": [
    "I appreciate your perspective on this project roadmap. What potential risks should we mitigate first?",
    "Good call. How can we streamline communication across design, product, and engineering teams?",
    "That makes total sense. What timeline expectations should we communicate to our clients?",
    "Excellent! Let's document these action items and follow up in our next sync."
  ],
  "College Conversation": [
    "That's a fascinating academic project! What inspired you to choose this field of study?",
    "Nice! How do you manage your study schedules alongside extracurricular projects?",
    "What key insights or findings did you discover during your recent research or assignment?",
    "Awesome! What advice would you give to junior students entering this specialization?"
  ],
  "Casual Conversation": [
    "That's really cool! What hobbies or activities do you enjoy most in your free time?",
    "Sounds fun! Have you watched any great movies or read interesting books recently?",
    "Nice! If you could travel anywhere next month, where would you go and why?",
    "Haha awesome conversation! It was really great chatting with you today!"
  ]
};

app.post("/api/chat/respond", (req, res) => {
  const { scenario, questionIndex, userAnswerText } = req.body;
  const list = SCENARIO_RESPONSES[scenario] || SCENARIO_RESPONSES["Job Interview"];
  const nextIdx = questionIndex % list.length;
  const aiPartnerReply = list[nextIdx];
  res.json({ reply: aiPartnerReply, scenario, nextQuestionIndex: questionIndex + 1 });
});

// ---------------- 5. SESSION HISTORY & PERSISTENCE ENDPOINTS ----------------
app.post("/api/sessions/save", authMiddleware, async (req, res) => {
  try {
    const sessionData = {
      userId: req.userId || "guest_user",
      candidateName: req.body.candidateName || "Candidate",
      scenario: req.body.scenario || "Job Interview",
      questions: req.body.questions || [],
      speechMetrics: req.body.speechMetrics || { wpm: 135, fillerCount: 3, grammarScore: 82, vocabScore: 78, fluencyScore: 80 },
      cvMetrics: req.body.cvMetrics || { eyeContactScore: 85, postureScore: 88, headStabilityScore: 82, gestureScore: 80, engagementScore: 85 },
      overallScore: req.body.overallScore || 84,
      aiFeedback: req.body.aiFeedback || "Good communication presence with upright posture and strong articulation.",
      createdAt: new Date()
    };

    let savedSession = null;
    if (isMongoConnected) {
      const doc = new Session(sessionData);
      savedSession = await doc.save();
    } else {
      sessionData.id = "session_" + Date.now();
      memoryStore.sessions.push(sessionData);
      savedSession = sessionData;
    }

    res.json({ message: "Session saved successfully!", session: savedSession });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sessions/history", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || "guest_user";
    let sessions = [];

    if (isMongoConnected) {
      sessions = await Session.find({ userId }).sort({ createdAt: -1 }).limit(20);
      if (sessions.length === 0) {
        sessions = await Session.find().sort({ createdAt: -1 }).limit(20);
      }
    } else {
      sessions = memoryStore.sessions.filter(s => s.userId === userId || s.userId === "guest_user").reverse();
    }

    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sessions/:id", authMiddleware, async (req, res) => {
  try {
    if (isMongoConnected && mongoose.Types.ObjectId.isValid(req.params.id)) {
      const session = await Session.findById(req.params.id);
      if (session) return res.json(session);
    }
    const memSession = memoryStore.sessions.find(s => s.id === req.params.id || s._id === req.params.id);
    if (memSession) return res.json(memSession);

    res.status(404).json({ error: "Session not found." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------- 6. PROGRESS ANALYTICS & WEAKNESS DETECTION ----------------
app.get("/api/analytics/progress", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || "guest_user";
    let history = [];

    if (isMongoConnected) {
      history = await Session.find({ userId }).sort({ createdAt: 1 }).limit(10);
      if (history.length === 0) {
        history = await Session.find().sort({ createdAt: 1 }).limit(10);
      }
    } else {
      history = memoryStore.sessions.slice(-10);
    }

    // Default sample trend data if new user
    if (history.length === 0) {
      return res.json({
        labels: ["Session 1", "Session 2", "Session 3"],
        grammar: [75, 80, 84],
        vocab: [70, 75, 78],
        fluency: [72, 78, 82],
        eyeContact: [68, 75, 81],
        posture: [80, 85, 88],
        fillerWords: [8, 5, 3],
        overallScore: [73, 79, 83]
      });
    }

    const labels = history.map((s, idx) => `Session ${idx + 1}`);
    const grammar = history.map(s => s.speechMetrics ? s.speechMetrics.grammarScore || 80 : 80);
    const vocab = history.map(s => s.speechMetrics ? s.speechMetrics.vocabScore || 75 : 75);
    const fluency = history.map(s => s.speechMetrics ? s.speechMetrics.fluencyScore || 78 : 78);
    const eyeContact = history.map(s => s.cvMetrics ? s.cvMetrics.eyeContactScore || 80 : 80);
    const posture = history.map(s => s.cvMetrics ? s.cvMetrics.postureScore || 85 : 85);
    const fillerWords = history.map(s => s.speechMetrics ? s.speechMetrics.fillerCount || 4 : 4);
    const overallScore = history.map(s => s.overallScore || 82);

    res.json({ labels, grammar, vocab, fluency, eyeContact, posture, fillerWords, overallScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Personalized Weakness Detection Endpoint
app.get("/api/analytics/weakness", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || "guest_user";
    let recent = [];

    if (isMongoConnected) {
      recent = await Session.find({ userId }).sort({ createdAt: -1 }).limit(5);
      if (recent.length === 0) {
        recent = await Session.find().sort({ createdAt: -1 }).limit(5);
      }
    } else {
      recent = memoryStore.sessions.slice(-5);
    }

    // Default weakness recommendation if new user
    if (recent.length === 0) {
      return res.json({
        hasWeakness: true,
        type: "filler_words",
        title: "Recurring Weakness: Filler Word Frequency",
        description: "Your filler-word usage (um, uh, like) has remained high across recent sessions. Try a 60-second response exercise focusing on deliberate pauses.",
        practiceType: "timed_pause_challenge",
        targetMetric: "Filler Words"
      });
    }

    const avgFillers = recent.reduce((acc, s) => acc + (s.speechMetrics ? (s.speechMetrics.fillerCount || 0) : 0), 0) / recent.length;
    const avgEye = recent.reduce((acc, s) => acc + (s.cvMetrics ? (s.cvMetrics.eyeContactScore || 80) : 80), 0) / recent.length;
    const avgPosture = recent.reduce((acc, s) => acc + (s.cvMetrics ? (s.cvMetrics.postureScore || 85) : 85), 0) / recent.length;
    const avgGrammar = recent.reduce((acc, s) => acc + (s.speechMetrics ? (s.speechMetrics.grammarScore || 80) : 80), 0) / recent.length;

    let weakness = {
      hasWeakness: true,
      type: "filler_words",
      title: "Recurring Weakness: Filler Words Detected",
      description: `Your filler-word count averaged ${Math.round(avgFillers)} per session across your last ${recent.length} sessions. Focus on taking silent pauses before starting sentences.`,
      practiceType: "timed_pause_challenge",
      targetMetric: "Filler Words"
    };

    if (avgFillers >= 4) {
      weakness = {
        hasWeakness: true,
        type: "filler_words",
        title: "Recurring Weakness: Frequent Filler Words",
        description: `Your filler-word usage averaged ${Math.round(avgFillers)} per session across your last ${recent.length} sessions. Try a 60-second response exercise focusing on deliberate pauses.`,
        practiceType: "timed_pause_challenge",
        targetMetric: "Filler Words"
      };
    } else if (avgEye < 75) {
      weakness = {
        hasWeakness: true,
        type: "eye_contact",
        title: "Recurring Weakness: Direct Camera Eye Contact",
        description: `Your eye-contact score averaged ${Math.round(avgEye)}% in recent sessions. Try maintaining direct gaze toward the webcam while formulating your thoughts.`,
        practiceType: "camera_gaze_challenge",
        targetMetric: "Eye Contact"
      };
    } else if (avgPosture < 80) {
      weakness = {
        hasWeakness: true,
        type: "posture",
        title: "Recurring Weakness: Spinal Posture & Slouching",
        description: `Your posture alignment averaged ${Math.round(avgPosture)}%. Practice sitting upright with shoulders square to the camera lens.`,
        practiceType: "upright_posture_challenge",
        targetMetric: "Posture"
      };
    } else if (avgGrammar < 80) {
      weakness = {
        hasWeakness: true,
        type: "grammar",
        title: "Recurring Weakness: Sentence Tense & Structure",
        description: `Your grammar precision score averaged ${Math.round(avgGrammar)}%. Practice a short past-tense technical explanation conversation.`,
        practiceType: "grammar_precision_challenge",
        targetMetric: "Grammar"
      };
    }

    res.json(weakness);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy backward-compatibility endpoints
app.post("/register", async (req, res) => {
  try {
    const { name, role } = req.body;
    if (isMongoConnected) {
      const user = new User({ name, email: `${Date.now()}@example.com`, password: "password", role });
      await user.save();
      res.json({ message: "✅ Registration saved successfully!", user });
    } else {
      res.json({ message: "✅ Registration saved successfully!", user: { name, role } });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/users", async (req, res) => {
  if (isMongoConnected) {
    const users = await User.find().select("-password");
    return res.json(users);
  }
  res.json(memoryStore.users);
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Full-Stack AI Communication Coach Server running on port ${PORT}`));
