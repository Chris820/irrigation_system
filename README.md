# Raspberry Pi based automated irrigation system

August 2021: Entirely rewritten for a node.js server with a React front-end.
Although I'm still using Python to take the water tank level measurements

## Features
- Monitors water tank levels (SKU: SEN0208), and logs hourly
- 7 day programmable schedule, per channel
- Current support for 2 channels, but extensible
- Triggers the switching of 5v relays (SKU: CE05279) and thus 12v solenoids via the RPi.GPIO.
- Web-browser based UI, served over local network

## Installation
1. Ensure Node.js and Python are installed on your Raspberry Pi
2. Clone respository
3. `npm install`
4. Build the client: `cd client && npm run build`

## Operation
To simply start the server: `node index.js`

Or to ensure the server stays running even after a device reboot I would recommend using [pm2](https://pm2.keymetrics.io). Install pm2 globally, then follow instructions given at [Persistent applications](https://pm2.keymetrics.io/docs/usage/startup/).

## TODO
- Consider a timer function using a range input

## Screenshots
<img src="https://github.com/Chris820/irrigation_system/blob/master/screen-1.png" alt="" width="250" height="445" /> <img src="https://github.com/Chris820/irrigation_system/blob/master/screen-2.png" alt="" width="250" height="445" /> <img src="https://github.com/Chris820/irrigation_system/blob/master/screen-3.png" alt="" width="250" height="445" />
