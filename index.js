const express = require('express');
const app = express();
const http = require('http').Server(app);
const fs = require('fs');
const nodeCron = require('node-cron');
const io = require('socket.io')(http);
const gpio = require('rpi-gpio');
const gpiop = gpio.promise;
const {PythonShell} = require('python-shell');


// Serve the build directory from :8080
const webroot = __dirname + '/client/build';
app.use(express.static(webroot));
http.listen(8080);
console.log("Server is listening");


// Define connections to the Raspberry Pi GPIO
const GardenTrigger = 11;
const LawnTrigger = 13;
gpiop.setup(GardenTrigger, gpio.DIR_OUT);
gpiop.setup(LawnTrigger, gpio.DIR_OUT);


// Do the switching
io.sockets.on('connection', function(socket) {
  console.log('App connection made');
  socket.on('garden', function(data) {
    console.log('garden '+data);
    gpio.write(GardenTrigger, data);
  });
  socket.on('lawn', function(data) {
    console.log('lawn '+data);
    gpio.write(LawnTrigger, data);
  });
  socket.on('cleanUp', function(data) {
    console.log('Cleaning up');
    gpio.write(GardenTrigger, 0);
    gpio.write(LawnTrigger, 0);    
    // TODO clear all schedules
  });
  // TODO Save and clear schedules 
});


// TODO: Write a Cron to run on the minute to check for schedules


// Cron job to log current tank levels
// TODO: Change to just before the hour
nodeCron.schedule("* * * * *", getCurrentTankLevel);
async function getCurrentTankLevel() {
  console.log('Checking tank levels');
  // Set up vars
  var timestamp = Date.now();
  var tank1_full = 270;
  var tank1_empty = 1800;
  var tank2_full = 340;
  var tank2_empty = 1800;
  // Our Python script will take a bunch of measurements...
  // Remove any outliers, then return back an average
  PythonShell.run('measure.py', null, function(err, result) {
    if (!err) var rawLevel1 = Number(result.toString())
    // Calculate the levels as a percentage
    var percentage1 = Number(Math.abs(100 - ((rawLevel1 - tank1_full) * 100) / (tank1_empty - tank1_full)).toFixed(1));
    if (percentage1 > 100) percentage1 = 100;
    // Write to the json files
    fs.writeFile('./data/tank1Level.json', JSON.stringify([timestamp, percentage1]), err => {if (err) throw err;});
    // Append to the raw history text file
    fs.appendFile('./data/tank1RawHistory.txt', timestamp+'|'+rawLevel1+"\n", function (err) {if (err) throw err;});
  }); 
  
  // TODO
  // This is a placeholders for the second tank Python script
  var rawLevel2 = 350;
  // Calculate the levels as a percentage
  var percentage2 = Number(Math.abs(100 - ((rawLevel2 - tank2_full) * 100) / (tank2_empty - tank2_full)).toFixed(1));
  if (percentage2 > 100) percentage2 = 100;
  // Write to the json files
  fs.writeFile('./data/tank2Level.json', JSON.stringify([timestamp, percentage2]), err => {if (err) throw err;});
  // Append to the raw history text file
  fs.appendFile('./data/tank2RawHistory.txt', timestamp+'|'+rawLevel2+"\n", function (err) {if (err) throw err;});
}

// Cron job to (re)build history of tank levels
// TODO: Change to hourly
nodeCron.schedule("* * * * *", updateHistory);
async function updateHistory() {
  console.log('Rebuilding the history');
  // Tank 1: Read the Raw history file
  fs.readFile('./data/tank1RawHistory.txt', 'utf8' , (err, data) => {
    if (err) {throw err;}
    // Set up vars
    var tank1_full = 270;
    var tank1_empty = 1800;
    var tank1History = [];
    // Split the string into an array of rows
    var tank1Rows = data.split("\n");
    // The last row is just a linebreak, junk it
    tank1Rows.pop();
    for (var i = 0, len = tank1Rows.length; i < len; i++) {
      var rowValue = tank1Rows[i].split('|')
      // Calculate the levels as a percentage
      var percentage = Number(Math.abs(100 - ((rowValue[1] - tank1_full) * 100) / (tank1_empty - tank1_full)).toFixed(1));
      if (percentage > 100) percentage = 100;
      // Build the full history array
      tank1History[i] = [Number(rowValue[0]), percentage];
    }
    // And write it to the json file
    fs.writeFile('./data/tank1History.json', JSON.stringify(tank1History), err => {if (err) throw err;});
   });
  // Tank 2: Read the Raw history file
  fs.readFile('./data/tank2RawHistory.txt', 'utf8' , (err, data) => {
    if (err) {throw err;}
    // Set up vars
    var tank2_full = 340;
    var tank2_empty = 1800;
    var tank2History = [];
    // Split the string into an array or rows
    tank2Rows = data.split("\n")
    // The last row is just a linebreak, junk it
    tank2Rows.pop();
    for (var i = 0, len = tank2Rows.length; i < len; i++) {
      var rowValue = tank2Rows[i].split('|')
      // Calculate the levels as a percentage
      var percentage = Number(Math.abs(100 - ((rowValue[1] - tank2_full) * 100) / (tank2_empty - tank2_full)).toFixed(1));
      if (percentage > 100) percentage = 100;
      // Build the full history array
      tank2History[i] = [Number(rowValue[0]), percentage];
    }
    // And write it to the json file
    fs.writeFile('./data/tank2History.json', JSON.stringify(tank2History), err => {if (err) throw err;});
  });
}


// API endpoints for tank level data, taken from above json files
app.get('/api/tank1Level', (req, res) => {
  fs.readFile('./data/tank1Level.json', (err, data) => {
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/tank2Level', (req, res) => {
  fs.readFile('./data/tank2Level.json', (err, data) => {
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/tank1History', (req, res) => {
  fs.readFile('./data/tank1History.json', (err, data) => {
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/tank2History', (req, res) => {
  fs.readFile('./data/tank2History.json', (err, data) => {
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});

// API endpoints for actual GPIO states
app.get('/api/isGardenActive', (req, res) => {   
  gpio.read(GardenTrigger, (err, value) => {    
    res.send(value);
  });
});
app.get('/api/isLawnActive', (req, res) => {   
  gpio.read(LawnTrigger, (err, value) => {    
    res.send(value);
  });
});



