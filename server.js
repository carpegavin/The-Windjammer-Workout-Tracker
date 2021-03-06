const express = require("express");
const logger = require("morgan");
const mongoose = require("mongoose");
const routes = require("./routes/index")
const PORT = process.env.PORT || 3000;

// const db = require("./models");

const app = express();

app.use(logger("dev"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static("public"));

mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/Workout", { useNewUrlParser: true });

// require("./routes")(app);
// require("./routes/index.js")(app);
app.use(routes)

app.listen(PORT, () => {
    console.log(`App running on port ${PORT}!`);
  });

 module.exports = app;