// var createError = require('http-errors');
// var express = require('express');
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');

// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');
// var apiRouter = require('./routes/api');
// var cors = require('cors'); 


// var app = express();

// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

// app.use(logger('dev'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));


// app.use(cors({
//   origin: "http://megan.lopsolutions.com", // Allow requests only from this origin
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   preflightContinue: false,
//   optionsSuccessStatus: 204,
//   credentials: true // This enables 'Access-Control-Allow-Credentials' header
// }));

// app.use('/', indexRouter);
// app.use('/users', usersRouter);
// app.use('/api', apiRouter);



// app.use(function (req, res, next) {
//   next(createError(404));
// });

// app.use(function (err, req, res, next) {
//   res.locals.message = err.message;
//   res.locals.error = req.app.get('env') === 'development' ? err : {};

//   res.status(err.status || 500);
//   res.render('error');
// });



// module.exports = app;

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var apiRouter = require('./routes/api');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Simplified & Correct CORS
const corsOptions = {
  origin: "http://megan.lopsolutions.com", // must exactly match your frontend origin
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};
app.use(cors(corsOptions));

// ✅ Allow preflight for all routes
app.options("*", cors(corsOptions));

// ----------------------
// Routes
// ----------------------
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api', apiRouter);

// ----------------------
// 404 handler
// ----------------------
app.use(function (req, res, next) {
  next(createError(404));
});

// ----------------------
// Error handler
// ----------------------
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
