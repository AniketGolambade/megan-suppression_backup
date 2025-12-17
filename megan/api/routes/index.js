var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

// Define API routes
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello, INDEX' });
});



module.exports = router;
