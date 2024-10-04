require('dotenv').config();

const path = require('path');

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const passport = require('passport');

const cors = require('cors');
//const helmet = require('helmet');

const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;

const User = require('./models/User');

const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const raceRoutes = require('./routes/races');
const userRoutes = require('./routes/user');
const pickemsRoutes = require('./routes/pickems');
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
//   dbName: 'tournament_test'
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

// This kills routing on mobile for some reason:
// Set security-related HTTP headers
//app.use(helmet());
// app.use(helmet.contentSecurityPolicy({
//   directives: {
//     defaultSrc: ["'self'"],
//     imgSrc: ["'self'", "https://cdn.discordapp.com"],
//     scriptSrc: ["'self'", "'unsafe-inline'"],
//     styleSrc: ["'self'", "'unsafe-inline'"],
//     fontSrc: ["'self'"],
//     connectSrc: ["'self'"],
//     objectSrc: ["'none'"],
//     frameSrc: ["'none'"],
//     baseUri: ["'self'"],
//     formAction: ["'self'"]
//   }
// }));

// Set up rate limiting
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // limit each IP to 100 requests per windowMs
//     message: "Too many requests from this IP, please try again later."
// });

app.use(limiter);

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
    sameSite: 'lax'
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
// app.use('/api/races', ensureApiKey);
app.use('/api/admin', ensureApiKey);
app.use('/api/tournament', ensureApiKey);
// app.use('/api/pickems', ensureApiKey);
// app.use('/api/groups', ensureApiKey);
app.use('/api/runners', ensureApiKey);
app.use('/api/users', ensureApiKey);

// Routes
app.use('/api/races', raceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tournament', tournamentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/user', userRoutes);
app.use('/api/pickems', pickemsRoutes);
app.use('/api', authRoutes);

app.get('/api/runners', async (req, res) => {
  try {
    // Fetch users with the role of "runner"
    const runners = await User.find({ role: 'runner' })
    .select('displayName discordUsername initialPot currentBracket')
    .sort({ displayName: 1 }); // Sort by display name
    res.json(runners);
  } catch (err) {
    console.error('Error fetching runners:', err);
    res.status(500).json({ error: 'Error fetching runners' });
  }
});

// For all other routes, send the index.html file (Angular will handle the routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html')); // Make sure this points to your index.html
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);  
});