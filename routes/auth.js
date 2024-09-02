const express = require('express');
const passport = require('passport');
const { Strategy } = require('@oauth-everything/passport-discord');
const User = require('../models/User');

const router = express.Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL;

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

// Route to start the Discord authentication process
router.get('/login', passport.authenticate('discord'));

// Callback route that Discord will redirect to after login
router.get('/auth/discord/callback', passport.authenticate('discord', {
    failureRedirect: `${process.env.FRONTEND_URL}/`,
    successRedirect: `${process.env.FRONTEND_URL}/`
}));

router.get('/auth-status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json(null);
    }
});
  
router.post('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return next(err);
        }
      
        // Destroy the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return next(err);
            }
        
            // Clear the session cookie
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });
});
  
module.exports = router;
