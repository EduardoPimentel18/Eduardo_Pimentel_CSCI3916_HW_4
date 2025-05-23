/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
*/

require('dotenv').config();
var express           = require('express');
var bodyParser        = require('body-parser');
var passport          = require('passport');
var authController    = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt               = require('jsonwebtoken');
var cors              = require('cors');
var User              = require('./Users');
var Movie             = require('./Movies');
var Review            = require('./Reviews');
var mongoose          = require('mongoose');

// Connect to MongoDB with proper options
mongoose.connect(process.env.DB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Error connecting to MongoDB:", err));

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

// Google Analytics tracking function
const rp     = require('request-promise');
const crypto = require('crypto');

const GA_TRACKING_ID = process.env.GA_KEY; // Ensure this is set in your environment (e.g., UA-XXXXXXXX-X)

function trackDimension(category, action, label, value, dimension, metric) {
  var options = {
    method: 'GET',
    url: 'https://www.google-analytics.com/collect',
    qs: {
      v:  '1',                    
      tid: 'G-DNGWDHXVDF',       
      cid: crypto.randomBytes(16).toString("hex"),
      t:  'event',
      ec: category,
      ea: action,
      el: label,
      ev: value,
      cd1: dimension,
      cm1: metric
    },
    headers: { 'Cache-Control': 'no-cache' }
  };

  return rp(options);
}

function getJSONObjectForMovieRequirement(req) {
  var json = {
    headers: "No headers",
    key:     process.env.UNIQUE_KEY,
    body:    "No body"
  };

  if (req.body != null)    json.body    = req.body;
  if (req.headers != null) json.headers = req.headers;

  return json;
}

// ────────────────────────────────────────────────────────────
// Auth Routes
// ────────────────────────────────────────────────────────────

router.post('/signup', function(req, res) {
  if (!req.body.username || !req.body.password) {
    res.json({ success: false, msg: 'Please include both username and password to signup.' });
  } else {
    var user = new User();
    user.name     = req.body.name;
    user.username = req.body.username;
    user.password = req.body.password;

    user.save(function(err) {
      if (err) {
        if (err.code == 11000)
          return res.json({ success: false, message: 'A user with that username already exists.' });
        else
          return res.json(err);
      }

      res.json({ success: true, msg: 'Successfully created new user.' });
    });
  }
});

router.post('/signin', function (req, res) {
  var userNew      = new User();
  userNew.username = req.body.username;
  userNew.password = req.body.password;

  User.findOne({ username: userNew.username })
    .select('name username password')
    .exec(function(err, user) {
      if (err) return res.send(err);

      user.comparePassword(userNew.password, function(isMatch) {
        if (isMatch) {
          var userToken = { id: user.id, username: user.username };
          var token     = jwt.sign(userToken, process.env.SECRET_KEY);
          res.json({ success: true, token: 'JWT ' + token });
        } else {
          res.status(401).send({ success: false, msg: 'Authentication failed.' });
        }
      });
    });
});

// ────────────────────────────────────────────────────────────
// Movie Routes
// ────────────────────────────────────────────────────────────

// POST /movies: Create a new movie then return all movies
router.post('/movies', authJwtController.isAuthenticated, (req, res) => {
  Movie.create(req.body, (err, movie) => {
    if (err) return res.status(500).json(err);
    Movie.find({}, (err, movies) => {
      if (err) return res.status(500).json(err);
      res.status(200).json(movies);
    });
  });
});

// GET /movies: Return all movies (as an array), with optional aggregation & sorting
router.get('/movies', authJwtController.isAuthenticated, (req, res) => {
  if (req.query.reviews === 'true') {
    // Aggregate reviews, compute avgRating, then sort descending by avgRating
    Movie.aggregate([
      { $lookup: {
          from:         'reviews',
          localField:   '_id',
          foreignField: 'movieId',
          as:           'reviews'
      }},
      { $addFields: {
          avgRating: { $avg: '$reviews.rating' }
      }},
      { $sort: { avgRating: -1 } }
    ]).exec((err, movies) => {
      if (err) return res.status(500).json(err);
      res.status(200).json(movies);
    });
  } else {
    // Fallback: return all movies without reviews
    Movie.find({}, (err, movies) => {
      if (err) return res.status(500).json(err);
      res.status(200).json(movies);
    });
  }
});

// GET /movies/:id: Return a specific movie. If ?reviews=true, aggregate reviews and avgRating.
router.get('/movies/:id', authJwtController.isAuthenticated, (req, res) => {
  let movieId;
  try {
    movieId = mongoose.Types.ObjectId(req.params.id);
  } catch (error) {
    return res.status(400).json({ message: 'Invalid movie ID format.' });
  }

  if (req.query.reviews === 'true') {
    Movie.aggregate([
      { $match: { _id: movieId } },
      { $lookup: {
          from:         'reviews',
          localField:   '_id',
          foreignField: 'movieId',
          as:           'reviews'
      }},
      { $addFields: {
          avgRating: { $avg: '$reviews.rating' }
      }}
    ]).exec((err, movie) => {
      if (err) return res.status(500).json(err);
      if (!movie || movie.length === 0)
        return res.status(404).json({ message: 'Movie not found.' });
      res.status(200).json(movie[0]);
    });
  } else {
    Movie.findById(movieId, (err, movie) => {
      if (err) return res.status(500).json(err);
      if (!movie) return res.status(404).json({ message: 'Movie not found.' });
      res.status(200).json(movie);
    });
  }
});

// ────────────────────────────────────────────────────────────
// Review Routes
// ────────────────────────────────────────────────────────────

// POST /reviews: Create a review for a movie (JWT-protected)
router.post('/reviews', authJwtController.isAuthenticated, (req, res) => {
  if (!req.body.movieId || !req.body.review || !req.body.rating) {
    return res.status(400).json({
      message: 'Missing required fields: movieId, review, and rating.'
    });
  }

  if (!req.body.username && req.user && req.user.username) {
    req.body.username = req.user.username;
  }

  Movie.findById(req.body.movieId, (err, movie) => {
    if (err) return res.status(500).json(err);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });

    Review.create(req.body, (err, review) => {
      if (err) return res.status(500).json(err);

      trackDimension(
        movie.genre || 'Unknown',        // Event Category
        'POST /reviews',                 // Event Action
        'API Request for Movie Review',  // Event Label
        '1',                             // Event Value
        movie.title,                     // Custom Dimension
        '1'                              // Custom Metric
      )
      .then(() => {
        res.status(200).json({ message: 'Review created!' });
      })
      .catch(analyticsError => {
        console.error('Analytics tracking error:', analyticsError);
        res.status(200).json({ message: 'Review created!' });
      });
    });
  });
});

// ────────────────────────────────────────────────────────────
// Search Route
// ────────────────────────────────────────────────────────────

router.post(
  '/movies/search',
  authJwtController.isAuthenticated,
  (req, res) => {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        message: 'Missing required field: query'
      });
    }

    const regex = new RegExp(query, 'i');

    Movie.find(
      {
        $or: [
          { title: regex },
          { 'actors.actorName': regex }
        ]
      },
      (err, movies) => {
        if (err) return res.status(500).json(err);
        res.status(200).json(movies);
      }
    );
  }
);

// ────────────────────────────────────────────────────────────
// Watchlist Routes (JWT-protected) 
// ────────────────────────────────────────────────────────────

// GET /watchlist
router.get(
  '/watchlist',
  authJwtController.isAuthenticated,
  async (req, res) => {
    try {
      // Load the user with populated watchlist
      const user = await User.findById(req.user.id)
        .populate('watchlist')
        .exec();
      if (!user) return res.status(404).json({ message: 'User not found.' });

      // Compute avgRating for each movie
      const moviesWithRating = await Promise.all(
        user.watchlist.map(async movie => {
          const reviews = await Review.find({ movieId: movie._id });
          const avgRating = reviews.length
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : null;
          return { ...movie.toObject(), avgRating };
        })
      );

      res.status(200).json(moviesWithRating);
    } catch (err) {
      res.status(500).json(err);
    }
  }
);

// POST /watchlist
router.post(
  '/watchlist',
  authJwtController.isAuthenticated,
  (req, res) => {
    const { movieId } = req.body;
    if (!movieId) return res.status(400).json({ message: 'Missing movieId.' });

    Movie.findById(movieId, (err, movie) => {
      if (err)    return res.status(500).json(err);
      if (!movie) return res.status(404).json({ message: 'Movie not found.' });

      User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { watchlist: movieId } },
        { new: true }
      )
      .populate('watchlist')
      .exec((err, user) => {
        if (err)  return res.status(500).json(err);
        res.status(200).json(user.watchlist);
      });
    });
  }
);

// DELETE /watchlist/:movieId
router.delete(
  '/watchlist/:movieId',
  authJwtController.isAuthenticated,
  (req, res) => {
    const movieId = req.params.movieId;
    User.findByIdAndUpdate(
      req.user.id,
      { $pull: { watchlist: movieId } },
      { new: true }
    )
    .populate('watchlist')
    .exec((err, user) => {
      if (err)  return res.status(500).json(err);
      res.status(200).json(user.watchlist);
    });
  }
);

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app;
console.log("DB:", process.env.DB);
