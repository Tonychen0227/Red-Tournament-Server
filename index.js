require('dotenv').config();

const path = require('path');

const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const passport = require('passport');
const { Strategy } = require('@oauth-everything/passport-discord');

const helmet = require('helmet');

const app = express();
const expressLayouts = require('express-ejs-layouts');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;

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
  (accessToken, refreshToken, profile, done) => {

    // Associate the Discord account with a user in the database here

    return done(null, profile);
  }
));

// Middleware to set username and profileImage in res.locals for all routes
app.use((req, res, next) => {
  res.locals.username = req.isAuthenticated() ? req.user.username : null;
  res.locals.profileImage = req.isAuthenticated() && req.user.photos.length > 0 ? req.user.photos[0].value : null;
  next();
});

// Routes  
app.get('/', (req, res) => {
  const title = 'Pokemon Red Tournament';

  if (req.isAuthenticated()) {
    const username = req.user.username;
    const profileImage = req.user.photos && req.user.photos.length > 0 ? req.user.photos[0].value : null;
    
    res.render('index', { title, username, profileImage});
  } else {
    res.render('index', { title, username: null, profileImage: null });
  }
});

app.get('/races', (req, res) => {
  res.render('races', { title: 'Upcoming Races' });
});

app.get('/submit-race', (req, res) => {
  res.render('submit-race', { title: 'Submit a New Race' });
});

app.get('/past-races', (req, res) => {
  res.render('past-races', { title: 'Past Races' });
});

// Route to start the Discord authentication process
app.get('/auth/discord', passport.authenticate('discord'));

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