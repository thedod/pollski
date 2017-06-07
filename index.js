var express = require('express'),
    bot = require('./bot.js'); // this require() will log an error if you don't have your .env file setup correctly

var app = express();

app.use(express.static('public')); // serve static files like index.html http://expressjs.com/en/starter/static-files.html

app.all(process.env.TICK_PATH, function(request, response) {
  console.log("checking notifications...");
  if (bot.tick()) {
    response.sendStatus(200);
  } else {
    response.sendStatus(500);
  }
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
  console.log("✨🔮✨")
});
