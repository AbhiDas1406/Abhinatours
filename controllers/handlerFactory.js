const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    //here tour is the actual document (object) identified by the Tour Model(Class)
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true, //returns the updated document
      runValidators: true,
    });

    if (!doc) {
      return next(new AppError('No tour found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc,
      },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    //first method
    //const newTour = new Tour({data})
    //newTour.save() //returns promise

    const newdoc = await Model.create(req.body); //returns promise

    res.status(201).json({
      status: 'success',
      data: {
        data: newdoc,
      },
    });
    //res.send('Done'); -> cannot sent two responses
  });

exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;
    // Tour.findOne({_id: req.params.id}) //same as above

    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        data: doc,
      },
    });
  });

exports.getAll = (Model) =>
  catchAsync(async (req, res, next) => {
    let filter = {};
    //if a get request is posted on GET tours/tourID/reviews
    //get all reviews for that tour
    if (req.params.tourId) filter = { tour: req.params.tourId };

    const features = new APIFeatures(Model.find(filter), req.query) //Tour.find() is the query object
      .filter()
      .sort()
      .limitFields()
      .paginate();
    //every method return the this object which then has accesss to other methods to which we chain
    const docs = await features.query; //.explain();

    //send response
    res.status(200).json({
      status: 'success',
      results: docs.length,
      data: {
        data: docs,
      },
    });
  });
