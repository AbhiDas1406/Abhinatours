//MODULE 9 lecture 7 watch again if in doubt
module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
    //fn(req, res, next).catch(err => next(err)); above is a simplified version of this line
  };
};
//catchAsync fuction returns a function not the result, which is then assigned to createTour
