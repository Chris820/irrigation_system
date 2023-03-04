const express = require('express')
const app = express()
const http = require('http').Server(app)
const fs = require('fs')
const nodeCron = require('node-cron')
const io = require('socket.io')(http)
const gpio = require('rpi-gpio')
const gpiop = gpio.promise

// Serve the build directory from :5000
const webroot = __dirname + '/client/build'
app.use(express.static(webroot))
http.listen(5000)
console.log('Server is listening')


// Define and make connections to the Raspberry Pi GPIO
// Note: 0/False is 'on' and True/1 is 'off', this is confusing I know, sorry.
// Just so that the relay board should be normally closed
const GardenTrigger = 13;
const LawnTrigger = 7;
gpiop.setup(GardenTrigger, gpio.DIR_OUT).then(() => {return gpiop.write(GardenTrigger, true)});
gpiop.setup(LawnTrigger, gpio.DIR_OUT).then(() => {return gpiop.write(LawnTrigger, true)});


// Do the switching
io.sockets.on('connection', function(socket) {
  uiFeedback('Connected to server');
  socket.on('garden', function(data) {
    var fb = 'off';
    if (data === 1) fb = 'on'; 
    uiFeedback('Garden '+ fb);
    gpio.write(GardenTrigger, !data);
  });
  socket.on('lawn', function(data) {
    var fb = 'off';
    if (data === 1) fb = 'on'; 
    uiFeedback('Lawn '+fb);
    gpio.write(LawnTrigger, !data);
  });
  socket.on('cleanUp', function(data) {
    uiFeedback('Cleaning up');
    gpio.write(GardenTrigger, 1);
    gpio.write(LawnTrigger, 1);
  });
  socket.on('update_garden_schedule', function(data) {
    uiFeedback('Updated garden schedule');
    fs.writeFile('./data/gardenSchedule.json', JSON.stringify(data), err => {if (err) throw err;});
  });
  socket.on('update_lawn_schedule', function(data) {
    uiFeedback('Updated lawn schedule');
    fs.writeFile('./data/lawnSchedule.json', JSON.stringify(data), err => {if (err) throw err;});
  });
});


// Cron job to check for and run any saved schedules
// Every minute
nodeCron.schedule('* * * * *', checkForSchedules);
async function checkForSchedules() {
  // What's the day and time?
  const currentdate = new Date();
  const nowday = currentdate.getDay();  
  const nowtime = ('0' + currentdate.getHours()).slice(-2) + ':' + ('0' + currentdate.getMinutes()).slice(-2);
  // Read the garden schedule
  fs.readFile('./data/gardenSchedule.json', (err, data) => {
    if (err) {throw err;}
    const parsedData = JSON.parse(data);    
    parsedData.days.forEach((day) => {
      // Check if today isChecked
      if (Number(day.value) === Number(nowday) && day.isChecked) {
        // Do the switching if nowtime matches
        if(parsedData.start === nowtime) gpio.write(GardenTrigger, 0);
        if(parsedData.end === nowtime) gpio.write(GardenTrigger, 1);
      }
    })
  });
  // Read the lawn schedule
  fs.readFile('./data/lawnSchedule.json', (err, data) => {
    if (err) {throw err;}
    const parsedData = JSON.parse(data);    
    parsedData.days.forEach((day) => {
      // Check if today isChecked
      if (Number(day.value) === Number(nowday) && day.isChecked) {
        // Do the switching if nowtime matches
        if(parsedData.start === nowtime) gpio.write(LawnTrigger, 0);
        if(parsedData.end === nowtime) gpio.write(LawnTrigger, 1);
      }
    })
  });
}


// Cron job to get current tank levels
// On the hour
nodeCron.schedule('0 * * * *', getCurrentTankLevel);
async function getCurrentTankLevel() {
  uiFeedback('Checking tank levels');
  // Set up vars
  var timestamp = Date.now();
  var tank1_full = 270;
  var tank1_empty = 1800;
  var tank2_full = 340;
  var tank2_empty = 1800;

  // Our Python script will take a bunch of measurements...
  // Remove any outliers, then return back an average
  fs.readFile('./data/tank1Raw.txt', 'utf8' , (err, data) => {
    if (err) {throw err;}
    var rawLevel1 = Number(data);
    // Calculate the levels as a percentage
    var percentage1 = Number(Math.abs(100 - ((rawLevel1 - tank1_full) * 100) / (tank1_empty - tank1_full)).toFixed(1));
    if (percentage1 > 100) percentage1 = 100;
    // Write to the json files
    fs.writeFile('./data/tank1Level.json', JSON.stringify([timestamp, percentage1]), err => {if (err) throw err;});
    // Append to the raw history text file
    fs.appendFile('./data/tank1RawHistory.txt', timestamp+'|'+rawLevel1+"\n", function (err) {if (err) throw err;});
  });
  
  // Levels of the second tank are monitored by a different computer on the network
  // Measurements are written to a text file in a manner nearly identical to what's here in measure.py
  // Then at one minute before the hour, a cron job rsyncs this file into the /data folder
  fs.readFile('./data/tank2Raw.txt', 'utf8' , (err, data) => {
    if (err) {throw err;}
    var rawLevel2 = Number(data);
    // Calculate the levels as a percentage
    var percentage2 = Number(Math.abs(100 - ((rawLevel2 - tank2_full) * 100) / (tank2_empty - tank2_full)).toFixed(1));
    if (percentage2 > 100) percentage2 = 100;
    // Write to the json files
    fs.writeFile('./data/tank2Level.json', JSON.stringify([timestamp, percentage2]), err => {if (err) throw err;});
    // Append to the raw history text file
    fs.appendFile('./data/tank2RawHistory.txt', timestamp+'|'+rawLevel2+"\n", function (err) {if (err) throw err;});
  });
}

// Cron job to (re)build history of tank levels. 
// One minute past the hour.
nodeCron.schedule('1 * * * *', updateHistory);
async function updateHistory() {
  uiFeedback('Rebuilding the history');
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


// API endpoints for tank level data and schedules, taken from above json files
app.get('/api/tank1Level', (req, res) => {
  fs.readFile('./data/tank1Level.json', (err, data) => {
    if (err) {throw err;}
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/tank2Level', (req, res) => {
  fs.readFile('./data/tank2Level.json', (err, data) => {
    if (err) {throw err;}
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/tank1History', (req, res) => {
  fs.readFile('./data/tank1History.json', (err, data) => {
    if (err) {throw err;}
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/tank2History', (req, res) => {
  fs.readFile('./data/tank2History.json', (err, data) => {
    if (err) {throw err;}
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/gardenSchedule', (req, res) => {
  fs.readFile('./data/gardenSchedule.json', (err, data) => {
    if (err) {throw err;}
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});
app.get('/api/lawnSchedule', (req, res) => {
  fs.readFile('./data/lawnSchedule.json', (err, data) => {
    if (err) {throw err;}
    let parsedData = JSON.parse(data);
    res.send(parsedData);
  });
});

// API endpoints for source-of-truth GPIO states
app.get('/api/isGardenActive', (req, res) => {
  gpio.read(GardenTrigger, (err, value) => {
    res.send(!value);
  });
});
app.get('/api/isLawnActive', (req, res) => {
  gpio.read(LawnTrigger, (err, value) => {
    res.send(!value);
  });
});


// Feedback
async function uiFeedback(message) {
  fs.appendFile('./data/feedback.txt', message+"\n", function (err) {if (err) throw err;});
}
app.get('/api/feedback', (req, res) => {
  fs.readFile('./data/feedback.txt', 'utf8' , (err, data) => {
    if (err) {throw err;}
    var feedback = data.split("\n")
    let parsedData = JSON.parse(JSON.stringify(feedback.slice(-2)));
    res.send(parsedData);
  });
});
