require('dotenv').config();
const path = require('path');

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const flash = require('connect-flash');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const passport = require('passport');
const { Strategy } = require('@oauth-everything/passport-discord');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;

const User = require('./models/User');
const Race = require('./models/Race');

const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');
const raceRoutes = require('./routes/races');

const ensureRunner = require('./middleware/ensureRunner.js');

const app = express();

// Use the CORS middleware with default options, allowing all origins
app.use(cors());

// Make Express understand JSON and webforms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Flash middleware for success/error messages
app.use(flash());

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


// Middleware to set username and profileImage in res.locals for all routes
app.use((req, res, next) => {
  if (req.isAuthenticated()) {
    res.locals.username = req.user.username;
    res.locals.displayName = req.res.locals.displayName = req.user.displayName || req.user.global_name;
    res.locals.profileImage = req.user.photos && req.user.photos.length > 0 ? req.user.photos[0].value : null;
    res.locals.role = req.user.role;
    res.locals.isAdmin = req.user.isAdmin;
  } else {
    res.locals.username = null;
    res.locals.displayName = null;
    res.locals.profileImage = null;
    res.locals.role = null;
    res.locals.isAdmin = false;
  }

  res.locals.currentPath = req.path;

  next();
});


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

app.get('/races', async (req, res) => {
  try {
    // Fetch all upcoming races from the database, populating the racer details
    const races = await Race.find({})
      .populate('racer1', 'discordUsername displayName')
      .populate('racer2', 'discordUsername displayName')
      .populate('racer3', 'discordUsername displayName')
      .sort({ datetime: 1 });  

    res.render('races', { 
      title: 'Upcoming Races', 
      races: races 
    });
  } catch (err) {
    console.error('Error fetching races:', err);
    res.status(500).send('Error fetching races');
  }
});

// Submit race
app.get('/submit-race', ensureRunner, async (req, res) => {
  try {
    // Fetch all users who are runners, excluding the current user
    // Is there  scope for restricting people to selecting those in their group?
    const runners = await User.find({ 
      role: 'runner', 
      discordUsername: { $ne: req.user.username }
      });

      res.render('submit-race', { 
          title: 'Submit a New Race', 
          runners: runners, 
          userTimezone: req.user.timezone || 'UTC'
      });
  } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching runners');
  }
});

app.post('/submit-race', ensureRunner, async (req, res) => {
  try {
    const { date, time, racer2, racer3 } = req.body;

    // Combine date and time into a single Date object
    const raceDateTime = new Date(`${date}T${time}:00Z`); // The 'Z' ensures it's treated as UTC

    // Convert the Date object to a Unix timestamp (in seconds)
    const unixTimestamp = Math.floor(raceDateTime.getTime() / 1000);

    // Prepare the race object
    const raceData = {
      racer1: req.user._id, // The current user's ObjectID
      racer2: racer2, // Racer 2 ObjectID from the form
      racer3: null,
      datetime: unixTimestamp // The race time as a Unix timestamp
    };

    // Only include racer3 if one is provided
    if (racer3 && racer3 !== '') {
      raceData.racer3 = racer3;
    }

    // Create a new race entry in the database
    await Race.create(raceData);

    // Redirect to the races page after successful submission
    res.redirect('/races');
  } catch (err) {
    console.error('Error submitting race:', err);
    res.status(500).send('Error submitting race');
  }
});

app.get('/past-races', async (req, res) => {
  try {
    // Fetch all completed races from the database, populating the racer details
    const races = await Race.find({ completed: true })
      .populate('racer1', 'discordUsername displayName')
      .populate('racer2', 'discordUsername displayName')
      .populate('racer3', 'discordUsername displayName')
      .populate('winner', 'discordUsername displayName')
      .populate('results.racer', 'discordUsername displayName')
      .sort({ datetime: -1 }); // Sort by datetime descending

    res.render('past-races', { 
      title: 'Past Races', 
      races: races 
    });
  } catch (err) {
    console.error('Error fetching past races:', err);
    res.status(500).send('Error fetching past races');
  }
});

// Race routes
app.use('/races', raceRoutes);

// Admin routes
app.use('/admin', adminRoutes);

// Auth routes
app.use('/', authRoutes);

// Start the server
app.listen(process.env.PORT || 3000, () => {
  console.log(`Server is running on http://localhost:${process.env.PORT}`);
});