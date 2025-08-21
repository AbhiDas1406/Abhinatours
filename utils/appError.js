class AppError extends Error {
  //Error is the inbuilt Error class
  constructor(message, statusCode) {
    super(message); //call the parent constructor

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
