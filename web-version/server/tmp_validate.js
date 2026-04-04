const svc = require('./services/tokenService');
console.log('tokenService', svc);
console.log('generateTokenType', typeof svc.generateToken);
console.log('hasSessionControl', svc.SessionController ? 'yes' : 'no');
