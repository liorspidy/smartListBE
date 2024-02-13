var pg = require("pg");
require('dotenv').config();

console.log("process.env.DATABASE_URL: ", process.env.DATABASE_URL);
var conString = process.env.DATABASE_URL;
var client = new pg.Client(conString);
client.connect(function (err) {
  if (err) {
    return console.error("could not connect to postgres", err);
  }
});

module.exports = client;
