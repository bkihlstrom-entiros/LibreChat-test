const cookies = require('cookie');
const passport = require('passport');
const { isEnabled } = require('@librechat/api');
const { shouldBypassAuth, createGuestUser } = require('~/server/utils/bypassAuth');

// This middleware does not require authentication,
// but if the user is authenticated, it will set the user object.
const optionalJwtAuth = async (req, res, next) => {
  const cookieHeader = req.headers.cookie;
  const tokenProvider = cookieHeader ? cookies.parse(cookieHeader).token_provider : null;
  const bypassEnabled = await shouldBypassAuth();

  const callback = (err, user) => {
    if (err) {
      return next(err);
    }

    if (user) {
      req.user = user;
    } else if (bypassEnabled) {
      req.user = createGuestUser();
      req.isBypassAuth = true;
    }

    next();
  };

  if (tokenProvider === 'openid' && isEnabled(process.env.OPENID_REUSE_TOKENS)) {
    return passport.authenticate('openidJwt', { session: false }, callback)(req, res, next);
  }

  return passport.authenticate('jwt', { session: false }, callback)(req, res, next);
};

module.exports = optionalJwtAuth;
