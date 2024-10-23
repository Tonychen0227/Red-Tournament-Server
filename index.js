require('dotenv').config();

const path = require('path');

const express = require('express');
const session = require('express-session');

const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const passport = require('passport');

const cors = require('cors');

const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;

const User = require('./models/User');

const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const raceRoutes = require('./routes/races');
const userRoutes = require('./routes/user');
const pickemsRoutes = require('./routes/pickems');
const statsRoutes = require('./routes/stats');
const tournamentRoutes = require('./routes/tournament');
const groupRoutes = require('./routes/groups');

const ensureApiKey = require('./middleware/ensureApiKey');

const app = express();

// Serve the Angular client
app.use(express.static(path.join(__dirname, 'public')));

// Use the CORS middleware
app.use(cors({
  origin: [process.env.FRONTEND_URL, 'https://speedrun.red', 'https://www.speedrun.red'],
  credentials: true, // Allow credentials (cookies, auth headers)
  }
));

// Make Express understand JSON and webforms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB (Development)
// mongoose.connect(`mongodb+srv://liam:${MONGODB_PASSWORD}.7gth0.mongodb.net/?retryWrites=true&w=majority&appName=2024`, {
//   dbName: 'tournament_test2'
// });

// Connect to MongoDB (Production)
mongoose.connect(`mongodb+srv://liam:${MONGODB_PASSWORD}.7gth0.mongodb.net/?retryWrites=true&w=majority&appName=2024`, {
  dbName: 'tournament'
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Trust the Fly.io proxy
app.set('trust proxy', 1);

// Set up session middleware with connect-mongo
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    client: mongoose.connection.getClient(),
    dbName: 'tournament',
    collectionName: 'sessions'
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 
  }
}));

// Initialise passport and session support
app.use(passport.initialize());
app.use(passport.session());

// Serialise and deserialise user info for session persistence
passport.serializeUser((user, done) => done(null, user));

passport.deserializeUser(async (obj, done) => {
  try {
    const user = await User.findOne({ discordUsername: obj.username });

    if (user) {
      const fullUser = {
        ...obj,
        _id: user._id,
        role: user.role,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        pronouns: user.pronouns 
      };
      done(null, fullUser);
    } else {
      done(null, obj);
    }
  } catch (err) {
    done(err);
  }
});

// Secure API routes with the API key
app.use('/api/admin', ensureApiKey);
app.use('/api/tournament', ensureApiKey);
app.use('/api/runners', ensureApiKey);
app.use('/api/users', ensureApiKey);
app.use('/api/stats', ensureApiKey);
app.use('/api/pickems', ensureApiKey);
// app.use('/api/groups', ensureApiKey);
// app.use('/api/races', ensureApiKey);

// Routes
app.use('/api/races', raceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/user', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/pickems', pickemsRoutes);
app.use('/api', authRoutes);

app.get('/api/runners', async (req, res) => {
  try {
    // Fetch users with the role of "runner" and sort case-insensitively
    const runners = await User.aggregate([
      { $match: { role: 'runner' } }, // Fetch only runners
      { 
        $project: {
          displayName: 1,
          discordUsername: 1,
          initialPot: 1,
          currentBracket: 1,
          displayNameLower: { $toLower: "$displayName" } // Create a field for case-insensitive sort
        }
      },
      { $sort: { displayNameLower: 1 } }, // Sort by the lowercase display name
      { 
        $project: { 
          displayNameLower: 0 // Remove the temporary field after sorting
        }
      }
    ]);
    
    res.json(runners);
  } catch (err) {
    console.error('Error fetching runners:', err);
    res.status(500).json({ error: 'Error fetching runners' });
  }
});

// For all other routes, send the index.html file (Angular then handles the routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);  
});