const TokenService = require('../services/tokenService');
const QRCode = require('qrcode');
const SessionController = require('./sessionController');

class QRController {
  // Generate QR code endpoint
  static generateQR(req, res) {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Session ID is required'
      });
    }

    // make sure session exists and is not closed
    SessionController.getSessionById(session_id, (err, session) => {
      if (err) {
        console.error('[QR_CHECK] Error fetching session:', err);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
      }
      if (!session) {
        return res.status(400).json({ status: 'error', message: 'Invalid session' });
      }
      if (session.is_closed) {
        const reason = SessionController.isExpired(session)
          ? 'Session has expired and is now closed'
          : 'Session closed';
        return res.status(400).json({ status: 'error', message: reason });
      }

      TokenService.generateToken(session_id, (err, tokenData) => {
        if (err) {
          console.error('Error generating token:', err);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to generate QR token'
          });
        }

        // Generate QR code as data URL
        QRCode.toDataURL(tokenData.token, (err, qrCodeUrl) => {
          if (err) {
            console.error('Error generating QR code:', err);
            return res.status(500).json({
              status: 'error',
              message: 'Failed to generate QR code'
            });
          }

          res.json({
            status: 'success',
            token: tokenData.token,
            expires_in: 30,
            qr_code: qrCodeUrl,
            server_time: new Date().toISOString()
          });
        });
      });
    });
  }
}

module.exports = QRController;