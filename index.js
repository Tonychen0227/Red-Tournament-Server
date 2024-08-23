require('dotenv').config();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;

const path = require('path');

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const passport = require('passport');
const { Strategy } = require('@oauth-everything/passport-discord');

const helmet = require('helmet');

const app = express();
const expressLayouts = require('express-ejs-layouts');

// Make Express understand JSON and webforms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB
const User = require('./models/User');

const mongoose = require('mongoose');
const { log } = require('console');

mongoose.connect(`mongodb+srv://liam:${MONGODB_PASSWORD}.7gth0.mongodb.net/?retryWrites=true&w=majority&appName=2024`, {
  dbName: 'tournament'
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Trust the Fly.io proxy
app.set('trust proxy', 1);

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Set security-related HTTP headers
app.use(helmet());
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", "https://cdn.discordapp.com"],
    scriptSrc: ["'self'"],
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

// Set up session middleware
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
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
passport.deserializeUser((obj, done) => done(null, obj));

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

      // If the user doesn't exist, create a new one with a default role and isAdmin set to false
      if (!user) {
          user = await User.create({ discordUsername: profile.username, role: 'commentator', isAdmin: false });
      }

      // Attach role, isAdmin, and displayName from the database to the profile object
      profile.role = user.role;
      profile.isAdmin = user.isAdmin;
      profile.displayName = profile._json.global_name || profile.username;

      return done(null, profile);
  } catch (err) {
      console.error(err);
      return done(err);
  }
}));


// Print out user info middleware
app.use((req, res, next) => {
  console.log('User Data:', req.user);
  next();
});

// Middleware to set username and profileImage in res.locals for all routes
app.use((req, res, next) => {
  if (req.isAuthenticated()) {
    res.locals.username = req.user.username;
    res.locals.displayName = req.    res.locals.displayName = req.user.displayName || req.user.global_name;
    res.locals.profileImage = req.user.photos && req.user.photos.length > 0 ? req.user.photos[0].value : null;
    res.locals.role = req.user.role;
  } else {
    res.locals.username = null;
    res.locals.profileImage = null;
    res.locals.role = null;
  }
  next();
});

// Middleware to check if the user is authenticated and an admin
function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.isAdmin) {
      return next();
  } else {
      res.status(403).render('error', { 
        title: 'Access Denied',
        message: 'Access denied. You must be an admin to view this page.',
        username: req.user ? req.user.username : null
      });
  }
}

// Middleware to check if the user is authenticated and a runner
function ensureRunner(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'runner') {
      return next();
  } else {
      res.status(403).render('error', { 
        title: 'Access Denied',
        message: 'Access denied. You must be a runner to view this page.',
        username: req.user ? req.user.username : null
      });
  }
}

// Routes  
app.get('/', async (req, res) => {
  const title = 'Pokemon Red Tournament';

  if (req.isAuthenticated()) {
      const discordUsername = req.user.username;

      try {
          const user = await User.findOne({ discordUsername });

          if (user) {
              const role = user.role;
              res.render('index', { title, username: discordUsername, role });
          } else {
              res.render('index', { title, username: discordUsername, role: 'commentator' });
          }
      } catch (err) {
          console.error(err);
          res.status(500).send('Internal Server Error');
      }
  } else {
      res.render('index', { title, username: null, role: 'guest' });
  }
});

app.get('/races', (req, res) => {
  res.render('races', { title: 'Upcoming Races' });
});

app.get('/submit-race', ensureRunner, (req, res) => {
  res.render('submit-race', { title: 'Submit a New Race' });
});

app.get('/past-races', (req, res) => {
  res.render('past-races', { title: 'Past Races' });
});

// Admin routes

// Add user
app.get('/add-user', ensureAdmin, (req, res) => {
  res.render('add-user', { title: 'Add User' });
});

app.post('/add-user', ensureAdmin, async (req, res) => {
  const { discordUsername, role, isAdmin } = req.body;

  try {
      const user = await User.findOneAndUpdate(
          { discordUsername },
          { 
              role, 
              isAdmin: isAdmin === 'on'
          },
          { new: true, upsert: true }
      );
      res.status(200).send(`User ${user.discordUsername} is now a ${user.role} and ${user.isAdmin ? 'an Admin' : 'not an Admin'}`);
  } catch (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
  }
});

// Route to start the Discord authentication process
app.get('/login', passport.authenticate('discord'));

// Callback route that Discord will redirect to after login
app.get('/auth/discord/callback', passport.authenticate('discord', {
  failureRedirect: '/',
  successRedirect: '/'
}));

// Logout route
app.post('/logout', (req, res) => {
  req.logout(() => {});
  res.redirect('/');
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
});