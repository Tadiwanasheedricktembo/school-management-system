const s = require('./controllers/sessionController');
const t = require('./services/tokenService');
console.log('SessionController', typeof s.getSession, s.getSession ? s.getSession.name : 'no');
console.log('tokenService', typeof t.generateToken, t.generateToken ? 'ok' : 'no');
