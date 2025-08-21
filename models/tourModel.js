const mongoose = require('mongoose');
const slugify = require('slugify');
// const validator = require('validator');

// const User = require('../models/userModel');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal than 40 characters'],
      minlength: [10, 'A tour name must have more or equal than 10 characters'],
      //validate: [validator.isAlpha, 'Tour name must only contain characters'], using external validator library
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      }, //this error displaying method is the standard one rest are short-hand
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      max: [5, 'Rating must be below 5.0'],
      min: [1, 'Rating must be above 1.0'],
      set: (val) => Math.round(val * 10) / 10,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this only points to current doc on NEW document creation
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price', //mongoose thing. -> {VALUE} has acces to value
      },
    },
    summary: {
      type: String,
      trim: true,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must. have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    //array of object of type location type
    locations: [
      // embedding needs array, this is the array of locations
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        data: Number,
      },
    ],
    guides: [
      //for get all tours route it is giving everything and not just id why ?
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User', //not even needed to import User
      },
    ],
  },
  {
    toJSON: { virtuals: true }, //output the virtual properties  when output data is in JSON format
    toObject: { virtuals: true }, //output the virtual properties when output data is in object format
  },
);

//tourSchema.index({ price: 1 });
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' }); // telling mongodb that this index is a 2d sphere

//virtual properties //not part of the database
tourSchema.virtual('durationWeeks').get(function () {
  //get method specifies the method for which we need virtual properties
  return this.duration / 7;
});

//section 11 lec 11
// Virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

//Mongoose middlewares
//DOCUMENT MIDDLEWARE: runs before the .save() and .create() not on .insertMany() or update or anything else
tourSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true }); //this points to the current document in document middleware
  //slug is basically a property that contain the stringified url type version of the name
  next();
});

//works only when new document is created not for old ones
// tourSchema.pre('save', async function (next) {
//   const guidesPromises = this.guides.map(async (id) => await User.findById(id));
//   this.guides = await Promise.all(guidesPromises);
//   next();
// });

// tourSchema.pre('save', function (next) {
//   console.log('Will save document ...');
//   next();
// });

// tourSchema.post('post', function (doc, next) {
//   //here we dont have the this because it points to the doc being processed
//   //instead we have access to the finished doc
//   console.log(doc);
//   next();
// });

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function (next) {
  //we use regex since only find applies to find, but findOne findOneand... all these are exempted if we use only find, this regex accomodates all that start with find
  // tourSchema.pre('find', function (next) {
  //find makes it query middleware
  this.find({ secretTour: { $ne: true } }); //this is now a query object, so we can chain all the queries
  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    //in query middleware this points to the current query
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds`);
  next();
});

// AGGREGATION MIDDLEWARE

// tourSchema.pre('aggregate', function (next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } }); //shift adds at the end of the array and unshift adds at the front
//   //console.log(this.pipeline()); //-> this.pipeline is an array
//   next();
// });

const Tour = mongoose.model('Tour', tourSchema); //model (like class)

module.exports = Tour;
