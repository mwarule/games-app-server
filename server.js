const express = require("express");
const cors = require("cors");
const app = express();
const http = require('http');
const server = http.createServer(app);
const socket = require("./app/utils/ludo.socket")
require('dotenv').config({path: './.env.development'})
var corsOptions = {
  origin: "http://localhost:4200"
};
const path = require('path');
socket.init(server)

app.use(cors(corsOptions));

const connectDB = require("./connect");

// parse requests of content-type - application/json
app.use(express.json());
// parse requests of content-type - application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, './frontend')));
const start = async () => {
  try {
      console.log('Eshtablishing database connection...')
      console.log(process.env.DB_URL)
      console.log(process.env.NODE_ENV)
      await connectDB(process.env.DB_URL);
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