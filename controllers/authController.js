const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');
const crypto = require('crypto');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    //secure: true, //can only send over https
    httpOnly: true, //cookie cannot be read or modified by the browser, prevents cross side scripting attacks
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  user.password = undefined; //even though in schema select: false, but after creating a new user password shows still, this will prevent that
  //using the above statement we dont send anything via api, but password stays in db as not saved

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });
  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }
  // 2) check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password'); //abbreviation of {email: email} && since we excluded password in schema we use this syntax to include it in res
  //user is the User document so we can use instance method on it
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  //3) if everything ok, send token to client
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  //console.log(token);

  if (!token) {
    return next(
      new AppError('You are not logged in! Please login to get access.', 401),
    );
  }
  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET); //promisify makes return a promist in that way we can use async await as we have been using
  //check how error handling is done from here. -> module 10: lec 9
  // 3) Check if user still exists
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exitst.',
        401,
      ),
    );
  }
  // 4) Check if user changed password after the token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }

  //Grant Access to protected route
  req.user = freshUser;
  res.locals.user = freshUser;
  next(); //next points to the next function in stack -> getAllTours handler
});

// only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET,
      ); //promisify makes return a promist in that way we can use async await as we have been using
      //check how error handling is done from here. -> module 10: lec 9
      // 3) Check if user still exists
      const freshUser = await User.findById(decoded.id);
      if (!freshUser) {
        return next();
      }
      // 4) Check if user changed password after the token was issued
      if (freshUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      //THERE IS A LOGGED IN USER
      res.locals.user = freshUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => {
  //we want to pass roles to restrict to as arguments but in middlewares we cannot pass arguments so we use wrapper function that returns middleware function
  return (req, res, next) => {
    // (...roles) creates and is an array containing any no.of arguments
    if (!roles.includes(req.user.role)) {
      //user was attached to req in previous middle ware
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user baded on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }
  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false }); //turn the valddations off otherwise it will ask for passwordConfirm

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Sumit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\n If you didn't forget your password, please ignore this email!`;

  //we want to do more than send an error message if this process fails, so we intentionally use try catch and not the global error handling middleware
  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

// in the email we have sent the original unhashed token, but stored the hashed token in our db
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  //we get the unhashed token from the user as the request param via the email
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  //we then hash the token and find the corresponding user in the db, because in the db hashed token was used
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // check if the token has not yet expired
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  //user will send the password and passwordConfirm via the body
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  //now unset the token and token expires
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  //save the new results
  await user.save(); //we do not invalidate the validators, so checking password = passwordConfirm will happen

  // 3) Update changedPasswordAt property for the user -> implemented in userModel itself as a pre middleware
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  //this feature is to allow logged in users to change their passwords without having to go to the forget and reset route
  //as a security feature we ask them to give their old password
  //Understand why we are not using find by ID and update(User.findByIdandUpdate) -> lecture: 15 module 10

  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password'); // id is from the protect middleware

  // 2) Check if the posted password is correct
  if (
    !(await user.correctPassword(
      req.body.passwordCurrent /* userSchema instance method defined in model*/,
      user.password,
    ))
  ) {
    return next(new AppError('Your current password is wrong.', 401));
  }
  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
