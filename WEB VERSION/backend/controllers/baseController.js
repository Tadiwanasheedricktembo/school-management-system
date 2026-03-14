// Placeholder controller for future API endpoints
class BaseController {
  // Example method - can be expanded for specific controllers
  static successResponse(res, data, message = 'Success') {
    return res.json({
      status: 'success',
      message,
      data
    });
  }

  static errorResponse(res, message, statusCode = 400) {
    return res.status(statusCode).json({
      status: 'error',
      message
    });
  }
}

module.exports = BaseController;