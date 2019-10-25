// Require our dependencies
var express = require("express");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");
var bodyParser = require("body-parser");
var request = require("request");
var logger = require("morgan");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");

// models route
var db = require("./models");

// Set up our port to be either the host's designated port, or 3000
var PORT = process.env.PORT || 3000;

// Instantiate our Express App
var app = express();

// Designate our public folder as a static directory
app.use(express.static("public"));

// Connect Handlebars to our Express app
app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Use bodyParser in our app
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Use morgan logger for logging requests
app.use(logger("dev"));

// If deployed, use the deployed database. Otherwise use the local newsScrape database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/newsScrape";

// Connect to the Mongo DB
mongoose.connect(MONGODB_URI, {
	useNewUrlParser: true,
	useUnifiedTopology: true
});

// Routes

// Route for Homepage
app.get("/", function(req, res) {
	res.render("home");
});

// A GET route for scraping the nytimes website
app.get("/scrape", function(req, res) {
	// First, we grab the body of the html with request
	axios.get("https://www.nytimes.com/").then(function(response) {
		// Then, we load that into cheerio and save it to $ for a shorthand selector
		var $ = cheerio.load(response.data);

		var articles = [];
		// Now, we grab every story-body class within the div, and do the following:
		$(".assetWrapper").each(function(i, element) {
			var head = $(this)
				.find("h2")
				.text()
				.trim();

			// Grab the URL of the article
			var url = $(this)
				.find("a")
				.attr("href");

			// Grab the summary of the article
			var sum = $(this)
				.find("p")
				.text()
				.trim();

			// So long as our headline and sum and url aren't empty or undefined, do the following
			if (head && sum && url) {
				// This section uses regular expressions and the trim function to tidy our headlines and summaries
				// We're removing extra lines, extra spacing, extra tabs, etc.. to increase to typographical cleanliness.
				var headNeat = head
					.replace(/(\r\n|\n|\r|\t|\s+)/gm, " ")
					.trim();
				var sumNeat = sum.replace(/(\r\n|\n|\r|\t|\s+)/gm, " ").trim();

				// Initialize an object we will push to the articles array
				var dataToAdd = {
					headline: headNeat,
					summary: sumNeat,
					url: "https://www.nytimes.com" + url
				};
			}

			// Push new article into articles array
			console.log("dataToAdd", dataToAdd);
			articles.push(dataToAdd);
			// Create a new Article using the `result` object built from scraping
			db.Article.create(dataToAdd)
				.then(function(dbArticle) {
					// View the added result in the console
					console.log("Add articles to the DB --->", dbArticle);
				})
				.catch(function(err) {
					// If an error occurred, send it to the client
					return res.json(err);
				});
		});
		console.log(articles);
		// If we were able to successfully scrape and save an Article, send a message to the client
		res.render("index", { articles: articles });
	});
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
	// Grab every document in the Articles collection
	db.Article.find({})
		.then(function(dbArticle) {
			// If we were able to successfully find Articles, render them on the index page
			// res.json(dbArticle);
			res.render("index", { article: dbArticle });
		})
		.catch(function(err) {
			// If an error occurred, send it to the client
			res.json(err);
		});
});

// GET all the articles that favorite is set to true
// and render them to the favorite.handlebars page
app.get("/favorites", function(req, res) {
	db.Article.find({ favorite: true })
		.then(function(ArticleFav) {
			// res.json(data);
			res.render("favorite", { article: ArticleFav });
		})
		.catch(function(err) {
			res.status(404).send(err);
		});
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
	// Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
	db.Article.findOne({ _id: req.params.id })
		// ..and populate all of the notes associated with it
		.populate("note")
		.then(function(dbArticle) {
			// If we were able to successfully find an Article with the given id, send it back to the client
			res.json(dbArticle);
		})
		.catch(function(err) {
			// If an error occurred, send it to the client
			res.json(err);
		});
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
	// Create a new note and pass the req.body to the entry
	db.Note.create(req.body)
		.then(function(dbNote) {
			// If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
			// { new: true } tells the query that we want it to return the updated User -- it returns the original by default
			// Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
			return db.Article.findOneAndUpdate(
				{ _id: req.params.id },
				{ note: dbNote._id },
				{ new: true }
			);
		})
		.then(function(dbArticle) {
			// If we were able to successfully update an Article, send it back to the client
			res.json(dbArticle);
		})
		.catch(function(err) {
			// If an error occurred, send it to the client
			res.json(err);
		});
});

// PUT (UPDATE) a article by its _id
// Will set the article favorite to whatever the value
// of the req.body.favorite boolean is

app.put("/articles/:id", function(req, res) {
	db.Article.findByIdAndUpdate(
		req.params.id,
		{ favorite: req.body.favorite },
		{ new: true }
	)

		.then(function(dbArticle) {
			res.json(dbArticle);
		})
		.catch(function(err) {
			res.status(400).send(err);
		});
});

// Listen on the port
app.listen(PORT, function() {
	console.log("Listening on port: " + PORT);
});
