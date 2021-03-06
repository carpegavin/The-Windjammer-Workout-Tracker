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
    default: ()=> new Date(),
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

// exercise duration??



const Workout = mongoose.model("Workout", WorkoutSchema);
module.exports = Workout;

  
  

  