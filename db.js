var pg = require("pg");

var conString =
  "postgres://hvuxtjoa:GuO_Ixu9ckeoWNTAskpmDL7a2Dgj7l6S@surus.db.elephantsql.com/hvuxtjoa";
var client = new pg.Client(conString);
client.connect(function (err) {
  if (err) {
    return console.error("could not connect to postgres", err);
  }
});

module.exports = client;
