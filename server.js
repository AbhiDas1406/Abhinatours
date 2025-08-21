const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
//availabe in process.env what we save in config.env

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});
//

dotenv.config({ path: './.env' }); //this command reads the contents from config.env and  makes it available when we run npm start alias of nodemon server.js

//this line must be after the previous line because only then we can get access to env variables in app
const app = require('./app');
//console.log(process.env); //uncomment to see the process enviromment variables

//cors adding
const corsOptions = {
  origin: ['https://abhinatours.vercel.app'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
//Connect to DB

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB connection successful!'));

// START SERVER
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  //the callback function will be called as soon as the server starts listening
  console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});
