const path = require("path");
const router = require("express").Router();
const Workout = require("../models");
const id = req.params.id;
const body = req.body;

// get workouts
app.get("/api/workouts", (req, res) => {
  db.Workout.aggregate({})
    .then(data => {
      res.json(data);
    })
    .catch(err => {
      res.json(err);
    });
});

// put workouts 
app.put("/api/workouts", ({body}, res) => {
    db.Workout.create(body)
      .then(({_id}) => db.Workout.findOneAndUpdate({}, 
        { $push: { exercises: body } }, 
        { new: true }))
      .then(data) => {
        res.json(data);
      })
      .catch(err => {
        res.json(err);
      });
  });

// post workouts

app.post("/api/workouts", (req, res) => {
    db.Workout.create({})
      .then(data => {
        res.json(data);
      })
      .catch(err => {
        res.json(err);
      });
  });



// html routes
// get from all three html pages
// stats, index, exercise