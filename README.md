# Raspberry Pi based automated garden irrigation system

August 2021: Entirely rewritten for a node.js server with a React front-end.
Although I'm still using Python to take the water tank level measurements

## TODO
- Write another nodeCron to check for and run any saved schedules
- Consider a timer function using a range input
- Finish displaying the feedback in the UI instead of console log

## Features
- Monitors water tank levels (SKU: SEN0208), and logs hourly
- 7 day programmable schedule, per channel
- Current support for 2 channels, but extensible
- Triggers the switching of 5v relays (SKU: CE05279) and thus 12v solenoids via the RPi.GPIO.
- Web-browser based UI, served over local network

## Installation
1. Clone respository
2. `npm install`
3. Build the client: `cd client && npm run build`
4. Start the server `node index.js`

## Screenshots
<img src="https://github.com/Chris820/irrigation_system/blob/master/screen-1.png" alt="" width="250" height="445" /> <img src="https://github.com/Chris820/irrigation_system/blob/master/screen-2.png" alt="" width="250" height="445" /> <img src="https://github.com/Chris820/irrigation_system/blob/master/screen-3.png" alt="" width="250" height="445" />
