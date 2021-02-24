const path = require("path");
const router = require("express").Router();
const Workout = require("../models");
const id = req.params.id;
const body = req.body;
const db = require("../models")

module.exports = app;

// get workouts
app.get("/api/workouts", (req, res) => {
  db.Workout.aggregate([{
      $addFields:{
          "totalDuration":{
              $sum: "$exercises.duration"
          }
      }
  }],
  (err,data)=>{
      if(err){res.send(error)
      }
       else{console.log(data)
          res.send(data)}
      })
  })


  // put workouts 
app.put("/api/workouts/:id", ({body}, res) => {
    db.Workout.findOneAndUpdate (
        req.params.id,{
        $push: { exercises: body }
        },
        (err,data)=>{
          if(err){res.send(error)
          }
          else{console.log(data)
          res.send(data)}
        }
    );
    },
// post workouts

app.post("/api/workouts", (req, res) => {
    db.Workout.create({})
      .then(data => {
        res.json(data);
      })
      .catch(err => {
        res.json(err);
      });
  }));

  // get workouts range
  app.get("/api/workouts/range", (req, res) => {
    db.Workout.find({})
      .limit(7)
      .then((data) => {
        res.json(data);
      })
      .catch((err) => {
        res.json(err);
      });
  });




// html routes
// get from all three html pages
// stats, index, exercise

app.get("/stats", (req, res) => {
    re.send("/public/stats.html");
});

app.get("/exercise", (req, res) => {
    re.send("/public/exercise.html");
});

app.get("/index", (req, res) => {
    re.send("/public/index.html");
});
