const AppError = require('../utils/appError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  //console.log(value);
  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

//handling validation errors by collecting error messges for them all
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message); //understand this line in more detail
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please login again.', 401);

const sendErrorDev = (err, req, res) => {
  // A)API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
  // B)RENDERED WEBSITE
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // A)Operational, trusted error: send messge to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    // B)Programming or other unkown error: don't leak error details
    // 1) log error
    console.error('ERROR 💥', err);
    // 2) send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!',
    });
  }
  //B) RENDERED WEBSITE
  // A)Operational, trusted error: send messge to client
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message,
    });
  }
  // B) Programming or other unkown error: don't leak error details
  // 1) log error
  console.error('ERROR 💥', err);
  // 2) send generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later.',
  });
};

module.exports = (err, req, res, next) => {
  //console.log(err.stack); //this shows where the error happened
  //4 arguments are identifies this as a error handling middleware to express
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = Object.create(err);
    error.message = err.message;
    // In production, we must avoid using a shallow copy like `let error = { ...err };`
    // because it loses important non-enumerable properties such as `isOperational`,
    // `message`, `name`, etc., which are defined on the prototype (e.g., by AppError).
    //
    // Instead, we use `Object.create(err)` to preserve the prototype chain and retain
    // all custom properties and methods of the original error object.
    // This ensures that `err.isOperational` remains accessible in sendErrorProd()
    // and allows us to correctly differentiate between operational (trusted) and
    // programming (unknown) errors.
    if (error.name === 'CastError') error = handleCastErrorDB(error); //this returns the AppError class object in which isOperational Flag is set to true
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (err.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (err.name === 'JsonWebTokenError') error = handleJWTError(error);
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
    sendErrorProd(error, req, res);
  }
};
