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

      // Prepare photos array from Discord profile
      const photos = profile.photos ? profile.photos.map(photo => ({
          value: photo.value,
          type: 'image'
      })) : [];

      if (!user) {
          // If the user doesn't exist, create a new one with a default role and isAdmin set to false
          user = await User.create({
              discordUsername: profile.username,
              displayName: profile._json.global_name || profile.username,
              role: 'commentator',
              isAdmin: false,
              pronouns: null,
              country: null,
              photos: photos
          });
      } else {
          // Update existing user with latest display name and photos
          user.displayName = user.displayName || profile._json.global_name || profile.username;
          user.photos = photos; // Update photos on each login to keep them current
          await user.save();
      }

      profile.role = user.role;
      profile.isAdmin = user.isAdmin;
      profile.displayName = user.displayName;
      profile.pronouns = user.pronouns;
      profile.country = user.country;

      return done(null, profile);
  } catch (err) {
      console.error(err);
      return done(err);
  }
}));

router.get('/login', passport.authenticate('discord'));

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
      
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destroy error:', err);
                return next(err);
            }
        
            res.clearCookie('connect.sid');
            res.json({ success: true });
        });
    });
});
  
module.exports = router;
