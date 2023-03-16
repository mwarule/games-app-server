const express = require("express");
const cors = require("cors");
const dbConfig = require("./app/config/db.config")
const app = express();
const http = require('http');
const server = http.createServer(app);
const socket = require("./app/utils/ludo.socket")

var corsOptions = {
  origin: "http://localhost:4200"
};

socket.init(server)

app.use(cors(corsOptions));

const connectDB = require("./connect");

// parse requests of content-type - application/json
app.use(express.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to bpe application." });
});

const start = async () => {
  try {
      console.log('Eshtablishing database connection...')
      // await connectDB(`mongodb+srv://${dbConfig.USERNAME}:${dbConfig.PASSWORD}${dbConfig.HOST}/${dbConfig.DB}`);
      await connectDB(`mongodb://${dbConfig.HOST}:${dbConfig.PORT}/${dbConfig.DB}`);
      console.log('Connected to database...')
      const PORT = process.env.PORT || 8080;
      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}.`);
      });
  } catch (error) {
      console.log(error);
      console.log("Failed to connect to the database, server is not running.");
  }
};

require('./app/routes/auth.routes')(app);
require('./app/routes/user.routes')(app);
require('./app/routes/game.routes')(app);
start();