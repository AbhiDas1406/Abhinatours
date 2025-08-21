class APIFeatures {
  constructor(query, queryString) {
    //query -> Tour.find() (mongoose feature) and //queryStr is the req from url
    //query is the query object and queryString is the string we get from the request
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // advanced filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy); //for descending order req query is updated to 127.0.0.1:3000/api/v1/tours?sort=-price, and mongoose handles the rest
      //sorting on the basis of a second param
      // sort('price ratingsAverage') for multiple fields -> if price tie then look for ratingsAverage
    } else {
      this.query = this.query.sort('-createdAt _id'); // - sign for descending
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields); //select helps us project what we need
    } else {
      this.query = this.query.select('-__v'); //- -> excluding
    }
    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

//build using
//BUILD QUERY
// 1) Filtering
// const queryObj = { ...req.query }; //we are destructuring since without that we create a shallow copy (reference(any changes made to queryObject also reflects in req.query))
// const excludedFields = ['page', 'sort', 'limit', 'fields'];
// excludedFields.forEach((el) => delete queryObj[el]);
//const query = Tour.find(queryObj); //Tour is the model not the document (object)

//1B) Advanced filtering

// {difficulty: 'easy', duration: { $gte: 5 }} -> manual query object for filtering
// {difficulty: 'easy', duration: { gte: '5' }} -> query object returned from

// let queryStr = JSON.stringify(queryObj);
// queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
// console.log(JSON.parse(queryStr));

// const tours = await Tour.find() //Tour.find() returns a query object. -> query.prototype methods are present in documentation
//   .where('duration')
//   .equals(5)
//   .where('difficulty')
//   .equals('easy'); //    so we can do this chaining

// let query = Tour.find(JSON.parse(queryStr));

//2) Sorting
//console.log(req.query.sort);
// if (req.query.sort) {
//   const sortBy = req.query.sort.split(',').join(' ');
//   query = query.sort(sortBy); //for descending order req query is updated to 127.0.0.1:3000/api/v1/tours?sort=-price, and mongoose handles the rest
//   //sorting on the basis of a second param
//   // sort('price ratingsAverage') for multiple fields -> if price tie then look for ratingsAverage
// } else {
//   query = query.sort('-createdAt _id'); // - sign for descending
// }

//3) Field Limiting

// if (req.query.fields) {
//   const fields = req.query.fields.split(',').join(' ');
//   query = query.select(fields); //select helps us project what we need
// } else {
//   query = query.select('-__v'); //- -> excluding
// }

// 4)Pagination
//page=2&limit=10, 1-10 -> page1, 11-20 -> page2
// const page = req.query.page * 1 || 1;
// const limit = req.query.limit * 1 || 100;
// const skip = (page - 1) * limit;
// query = query.skip(skip).limit(limit);

// if (req.query.page) {
//   const numTours = await Tour.countDocuments();
//   console.log(numTours);
//   if (skip >= numTours) throw new Error('This page does not exist');
// }

//execute the query
// console.log(req.query);

module.exports = APIFeatures;
