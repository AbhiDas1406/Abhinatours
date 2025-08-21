const path = require('path');
const express = require('express');
//const fs = require('fs');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

// Import routes and handlers

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express(); //this add a bunch of methods to our app
app.set('trust proxy', 1);
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// GLOBAL MIDDLEWARES

//serving static files using middlewares in express
//app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

//SET SECURITY HTTP HEADERS
app.use(helmet()); //helmet returns a function upon being called

//DEVELOPMENT logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev')); //gets us the details of the request made
}

//rate limitter ->
const limitter = rateLimit({
  max: 100, // maximum requests allowed from an IP //prevents bruteforce attacks
  windowMs: 60 * 60 * 1000, // 1 hour in ms
  message: 'Too many requrests from this IP, please try again in an hour!',
}); //when server restarts, limit resets

app.use('/api', limitter);

// Body parserer, reading data from body in req.body
app.use(express.json({ limit: '10kb' })); //middleware used to get req.body in post methods (it basically uses body-parserer which is already imported in express)
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
//express.json() returns a fucntion i.e, a middleware function
//that function is then added to the middleware stack using the .use method
app.use(cookieParser());

// Data Sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitazation against XSS
app.use(xss()); //removes malicious html code

//Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ], //allow all these two appear two or more times as query key value pairs
  }),
);

//Test Middleware
app.use((req, res, next) => {
  //this middleware applies to all requests on everu route
  console.log(req.cookies);
  next();
}); // in each middle ware function we have access to the request and response object created by incoming requests,
// we also have access to the next() function which hepls us move to the next middleware function in the midlleware stack
//naming of next doesn't matter, it just needs to be the third argument same as that for req and res
//order for this matters, if this middleware were to be after the  GET /api/v1/tours we use res so req, res cycle ends, so no effect of this middleware

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  //console.log(req.headers);
  next();
});

// ************** GET ALL TOURS ***************************
//app.get('/api/v1/tours', getAllTours);

// ************ GET TOUR BASED ON ID ****************************
//app.get('/api/v1/tours/:id', getTour);

// ************ ADD A NEW TOUR ****************************
//app.post('/api/v1/tours', createTour);

// ************ UPDATE AN EXISTING TOUR ****************************
//app.patch('/api/v1/tours/:id', updateTour);

//************* DELETE TOUR BASED ON ID ******************/
//app.delete('/api/v1/tours/:id', deleteTour);

//. ROUTES

//mounting the router
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter); //use the tourRouter middleware for the route specified
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

//whithout this an html reponse is send for unknowm routes, but with this we send json which is necessary for api
//we need to keep these after the above routes
app.all('*', (req, res, next) => {
  //all stands for all verbs get, put, patch

  // res.status(404).json({
  //   status: 'fail',
  //   message: `Can't find ${req.originalUrl} on this server!`,
  // });

  // const err = new Error(`Can't find ${req.originalUrl} on this server!`); //builtin error constructor
  // err.status = 'fail';
  // err.statusCode = 404;

  //this skips all other middlewares in the stack and directly goes to the error handling middleware
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404)); //if the "next" function recieves an argument no matter what it is, express automatically assumes it is an error
});

//ERROR HANDLING MIDDLEWARE
app.use(globalErrorHandler);

module.exports = app;
