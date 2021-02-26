const path = require("path");
const router = require("express").Router();
const Workout = require("../models");
// const id = req.params.id;
// const body = req.body;
const db = require("../models")

module.exports = app => {

  // get workouts
app.get("/api/workouts", (req, res) => {
  db.Workout.aggregate([{
      $addFields:{
        totalDuration:{
        $sum: '$exercises.duration',
        }
      }
  }],
  (err,data)=>{
      if(err){res.send(error)
      } else{console.log(data)
        res.send(data)}
      })
  })


  // put workouts 
app.put("/api/workouts/:id", ({body, params}, res) => {
    db.Workout.findOneAndUpdate (
        {_id: params.id},{
        $push: { exercises: body }
        },
    (err,data)=>{
      if(err){res.send(error)
      } else{console.log(data)
      res.send(data)}
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

  // get workouts range
  app.get("/api/workouts/range", (req, res) => {
    db.Workout.aggregate([{
        $addFields:{
        totalDuration:{
        $sum: '$exercises.duration',
        }}
      }])
      .limit(20)
      .then((data) => {
        console.log(data);
        console.log("hello");
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
    res.sendFile(path.join(__dirname, "../public/stats.html"));
});

app.get("/exercise", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/exercise.html"));
});

app.get("/index", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});
};
