const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const LibrarySchema = new Schema({
    name: {
      type: String,
      unique: true
    },
    books: [
      {
        type: Schema.Types.ObjectId,
        ref: "Book"
      }
    ]
  });
  
  // day 
  
  // exercise
    // type
    // name
    // weight
    // reps
    // sets
    // distance
    // duration

  const Library = mongoose.model("Library", LibrarySchema);
  
  module.exports = Library;