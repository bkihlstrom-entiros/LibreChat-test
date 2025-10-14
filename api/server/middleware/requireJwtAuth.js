const cookies = require('cookie');
const passport = require('passport');
const { isEnabled } = require('@librechat/api');
const { shouldBypassAuth, createGuestUser } = require('~/server/utils/bypassAuth');

const getTokenProvider = (req) => {
  const cookieHeader = req.headers.cookie;
  return cookieHeader ? cookies.parse(cookieHeader).token_provider : null;
};

const authenticate = (strategy, req, res, next, callback) =>
  callback
    ? passport.authenticate(strategy, { session: false }, callback)(req, res, next)
    : passport.authenticate(strategy, { session: false })(req, res, next);

const runPassportAuth = (req, res, next, callback) => {
  const tokenProvider = getTokenProvider(req);
  const useOpenId = tokenProvider === 'openid' && isEnabled(process.env.OPENID_REUSE_TOKENS);
  const strategy = useOpenId ? 'openidJwt' : 'jwt';

  return authenticate(strategy, req, res, next, callback);
};

const requireJwtAuth = async (req, res, next) => {
  const bypassEnabled = await shouldBypassAuth();

  if (!bypassEnabled) {
    return runPassportAuth(req, res, next);
  }

  return runPassportAuth(req, res, next, (err, user) => {
    if (err) {
      return next(err);
    }

    if (user) {
      req.user = user;
      return next();
    }

    req.user = createGuestUser();
    req.isBypassAuth = true;
    return next();
  });
};

module.exports = requireJwtAuth;
