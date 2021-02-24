const mongoose = require("mongoose");

const Schema = mongoose.Schema;

// date
// exercise
    // type
    // name
    // weight
    // reps
    // sets
    // distance
    // duration

const WorkoutSchema = new Schema({
  day: {
    type: Date,
    default: Date.now,
  },
  
  exercises: [
      {
      
      type: {
        type: String,
    },
      name: {
        type: String,
    },
      weight: {
        type: Number,
    },
      reps: {
        type: Number,
    },
      sets: {
        type: Number,
    },
      distance: {
        type: Number,
    },
      duration: {
        type: Number,
    },
  }]
});

const Workout = mongoose.model("Workout", WorkoutSchema);
module.exports = Workout;

  
  

  