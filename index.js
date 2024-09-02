require('dotenv').config();

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');

const passport = require('passport');
const { Strategy } = require('@oauth-everything/passport-discord');

const cors = require('cors');
const helmet = require('helmet');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;

const User = require('./models/User');

const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const raceRoutes = require('./routes/races');

const app = express();

// Use the CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  }
));

// Make Express understand JSON and webforms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
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

// Set security-related HTTP headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", "https://cdn.discordapp.com"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"]
  }
}));

// Set up rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later."
});

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
        displayName: user.displayName
      };
      done(null, fullUser);
    } else {
      done(null, obj);
    }
  } catch (err) {
    done(err);
  }
});

// Set up the Discord strategy
passport.use(new Strategy({
  clientID: DISCORD_CLIENT_ID,
  clientSecret: DISCORD_CLIENT_SECRET,
  callbackURL: CALLBACK_URL,
  scope: ['identify']
},
async (accessToken, refreshToken, profile, done) => {
  try {
      // Find user by Discord username
      let user = await User.findOne({ discordUsername: profile.username });

      if (!user) {
          // If the user doesn't exist, create a new one with a default role and isAdmin set to false
          user = await User.create({
              discordUsername: profile.username,
              displayName: profile._json.global_name || profile.username,
              role: 'commentator',
              isAdmin: false
          });
      } else {
          // Update displayName if necessary
          user.displayName = profile._json.global_name || profile.username;
          await user.save();
      }

      // Attach role, isAdmin, and displayName from the database to the profile object
      profile.role = user.role;
      profile.isAdmin = user.isAdmin;
      profile.displayName = user.displayName;

      return done(null, profile);
  } catch (err) {
      console.error(err);
      return done(err);
  }
}));

// Routes  
app.use('/api/races', raceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', authRoutes);

app.get('/api/runners', async (req, res) => {
  try {
    // Fetch users with the role of "runner"
    const runners = await User.find({ role: 'runner' }).sort({ displayName: 1 }); // Sort by display name

    // Send the runners data as JSON
    res.json(runners);
  } catch (err) {
    console.error('Error fetching runners:', err);
    res.status(500).json({ error: 'Error fetching runners' });
  }
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});