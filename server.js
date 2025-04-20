/*
CSC3916 HW4
File: Server.js
Description: Web API scaffolding for Movie API
*/

require('dotenv').config(); 
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
var mongoose = require('mongoose'); 

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
const rp = require('request-promise');
const crypto = require('crypto');

const GA_TRACKING_ID = process.env.GA_KEY; // Ensure this is set in your environment (e.g., UA-XXXXXXXX-X)

function trackDimension(category, action, label, value, dimension, metric) {
  var options = { 
    method: 'GET',
    url: 'https://www.google-analytics.com/collect',
    qs: {
      v: '1',                    
      tid: 'G-DNGWDHXVDF',       
      cid: crypto.randomBytes(16).toString("hex"), 
      t: 'event',                
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
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

// Movie Routes

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
      {
        $lookup: {
          from: 'reviews',        
          localField: '_id',
          foreignField: 'movieId',
          as: 'reviews'
        }
      },
      {
        $addFields: {
          avgRating: { $avg: '$reviews.rating' }
        }
      },
      {
        $sort: { avgRating: -1 }
      }
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
    // Aggregate single movie with its reviews and compute avgRating
    Movie.aggregate([
      { $match: { _id: movieId } },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'movieId',
          as: 'reviews'
        }
      },
      {
        $addFields: {
          avgRating: { $avg: '$reviews.rating' }
        }
      }
    ]).exec((err, movie) => {
      if (err) return res.status(500).json(err);
      if (!movie || movie.length === 0) return res.status(404).json({ message: 'Movie not found.' });
      res.status(200).json(movie[0]);
    });
  } else {
    // Return just the movie document
    Movie.findById(movieId, (err, movie) => {
      if (err) return res.status(500).json(err);
      if (!movie) return res.status(404).json({ message: 'Movie not found.' });
      res.status(200).json(movie);
    });
  }
});

// Review Routes
// POST /reviews: Create a review for a movie (JWT-protected)
router.post('/reviews', authJwtController.isAuthenticated, (req, res) => {
  // Ensure required fields are present
  if (!req.body.movieId || !req.body.review || !req.body.rating) {
    return res.status(400).json({ message: 'Missing required fields: movieId, review, and rating.' });
  }
  
  // If username is not provided, use the authenticated user's username.
  if (!req.body.username && req.user && req.user.username) {
    req.body.username = req.user.username;
  }
  
  // Verify that the movie exists
  Movie.findById(req.body.movieId, (err, movie) => {
    if (err) return res.status(500).json(err);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    
    // Create the review document
    Review.create(req.body, (err, review) => {
      if (err) return res.status(500).json(err);
      
      // Trigger custom analytics event after review creation.
      trackDimension(
        movie.genre || 'Unknown',      // Event Category: Use the movie genre, e.g., "Western"
        'POST /reviews',               // Event Action: URL path (or method) for posting a review
        'API Request for Movie Review',// Event Label: Description of the event
        '1',                           // Event Value: Must be numeric, sent as a string
        movie.title,                   // Custom Dimension: Movie Name
        '1'                            // Custom Metric: Value 1 (to aggregate review counts)
      )
      .then(() => {
        res.status(200).json({ message: 'Review created!' });
      })
      .catch(analyticsError => {
        console.error('Analytics tracking error:', analyticsError);
        // Even if analytics tracking fails, still return success for review creation.
        res.status(200).json({ message: 'Review created!' });
      });
    });
  });
});

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app;
console.log("DB:", process.env.DB);
