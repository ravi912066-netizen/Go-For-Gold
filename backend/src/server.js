const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
dotenv.config();

const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');
const courseRoutes = require('./routes/courses');
const assignmentRoutes = require('./routes/assignments');
const leaderboardRoutes = require('./routes/leaderboard');
const profileRoutes = require('./routes/profile');
const executeRoutes = require('./routes/execute');
const adminRoutes = require('./routes/admin');
const materialRoutes = require('./routes/materials');
const contestRoutes = require('./routes/contests');
const aiRoutes = require('./routes/ai');
const importRoutes = require('./routes/importRoutes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'OK', platform: 'GO FOR GOLD' }));

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/import', importRoutes);

// ─── Socket.io: Chat + WebRTC Signaling + Proctoring ──────────────────────────
const chatHistory = new Map();    // roomId → messages[]
const rooms = new Map();          // roomId → Set of socket IDs
const socketUsers = new Map();    // socketId → { userId, name, role }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // User registers themselves
  socket.on('register', ({ userId, name, role }) => {
    socketUsers.set(socket.id, { userId, name, role });
    socket.emit('registered', { socketId: socket.id });
    // Emit online users list to all
    io.emit('online_users', [...socketUsers.values()].filter(u => u.role === 'student').length);
  });

  // ── Chat ─────────────────────────────────────────────────────────────────
  socket.on('join_room', ({ roomId }) => {
    socket.join(roomId);
    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);

    // Send history
    const history = chatHistory.get(roomId) || [];
    socket.emit('chat_history', history);

    const user = socketUsers.get(socket.id);
    if (user) {
      io.to(roomId).emit('user_joined', { name: user.name, role: user.role });
    }
  });

  socket.on('send_message', ({ roomId, message, senderName, role }) => {
    const msg = {
      id: Date.now(),
      text: message,
      senderName,
      role,
      timestamp: new Date().toISOString(),
    };
    if (!chatHistory.has(roomId)) chatHistory.set(roomId, []);
    const history = chatHistory.get(roomId);
    history.push(msg);
    if (history.length > 200) history.shift(); // keep last 200 msgs
    io.to(roomId).emit('new_message', msg);
  });

  // ── WebRTC Signaling ────────────────────────────────────────────────────
  socket.on('webrtc_offer', ({ roomId, offer, targetSocketId }) => {
    const target = targetSocketId || [...(rooms.get(roomId) || [])].find(id => id !== socket.id);
    if (target) {
      io.to(target).emit('webrtc_offer', { offer, from: socket.id });
    }
  });

  socket.on('webrtc_answer', ({ answer, to }) => {
    io.to(to).emit('webrtc_answer', { answer, from: socket.id });
  });

  socket.on('webrtc_ice', ({ candidate, to }) => {
    io.to(to).emit('webrtc_ice', { candidate, from: socket.id });
  });

  socket.on('call_request', ({ roomId, callerName }) => {
    socket.to(roomId).emit('incoming_call', { from: socket.id, callerName });
  });

  socket.on('call_accept', ({ to }) => {
    io.to(to).emit('call_accepted', { by: socket.id });
  });

  socket.on('call_reject', ({ to }) => {
    io.to(to).emit('call_rejected');
  });

  socket.on('call_end', ({ roomId }) => {
    socket.to(roomId).emit('call_ended');
  });

  // ── Polls ─────────────────────────────────────────────────────────────
  socket.on('start_poll', ({ roomId, question }) => {
    // Basic poll: Question + A, B, C, D
    io.to(roomId).emit('poll_started', { question, startTime: new Date().toISOString() });
  });

  socket.on('stop_poll', ({ roomId }) => {
    io.to(roomId).emit('poll_stopped');
  });

  socket.on('submit_vote', ({ roomId, option, userId, userName }) => {
    // Broadcast vote to admin so they can see results live
    socket.to(roomId).emit('new_vote', { option, userId, userName });
  });

  // ── Proctoring events ───────────────────────────────────────────────────
  socket.on('proctor_event', ({ roomId, event, userId, userName }) => {
    // Forward suspicious activity to admin/teacher
    socket.to(roomId).emit('proctor_alert', { event, userId, userName, time: new Date().toISOString() });
  });

  socket.on('tab_switch', ({ examRoomId, userId, userName }) => {
    socket.to(examRoomId).emit('proctor_alert', {
      event: 'TAB_SWITCH',
      userId, userName,
      time: new Date().toISOString()
    });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const user = socketUsers.get(socket.id);
    socketUsers.delete(socket.id);
    rooms.forEach((members, roomId) => {
      if (members.has(socket.id)) {
        members.delete(socket.id);
        if (user) io.to(roomId).emit('user_left', { name: user.name });
        io.to(roomId).emit('call_ended');
      }
    });
    io.emit('online_users', [...socketUsers.values()].filter(u => u.role === 'student').length);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 GO FOR GOLD backend running on port ${PORT}`);
  console.log(`   Socket.io ready for chat & video calls`);
});
