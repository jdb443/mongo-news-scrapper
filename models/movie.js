// Movie model
// ==========

// Require mongoose
var mongoose = require("mongoose");

// Create the schema class using mongoose's schema method
var Schema = mongoose.Schema;

// Create the movieSchema with the schema object
var movieSchema = new Schema({
    title: {
        type: String,
        trim: true,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: [1, 'Need a rating more then one'],
        max: [10, 'Need a rating no greater then 10']
    },
    director: {
        type: String,
        trim: true,
        required: true
    },
    favorite: {
        type: Boolean,
        default: false
    }
});

// Create the movie model using the movieSchema
var Movie = mongoose.model("Movie", movieSchema);

// Export the movie model
module.exports = Movie;