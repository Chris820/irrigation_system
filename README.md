# Raspberry Pi based automated irrigation system

A Node.js server and React app for watering the gardens and keeping track of the rain-water tanks.

- August 2021: rewritten for a Node.js server with a React front-end.
- September 2026: refactored (thanks Claude). SQLite storage, pigpio for all GPIO, a better scheduler, vibed UI because I CBF.

## Features
- Monitors water tank levels (SKU: SEN0208) hourly, with history.
  Tank 2's sensor is on a second Pi and read over the network via Remote GPIO.
- Multiple weekly schedules per zone (days, start time, duration), each can be switched on/off
- Manual runs with a timer. Every run switches itself off, and nothing runs longer than `maxRunMinutes`
- "Pause schedules" for when the rains are 'ere
- Switches 5v relays (SKU: CE05279), and so 12v ac solenoids
- Live web UI over the local network
- Activity log

## How it fits together
```
node server (main Pi)
 ├── SQLite (data/irrigation.db)
 ├── pigpiod on localhost ─────────── relays, tank 1 sensor
 └── pigpiod on the tank 2 Pi (LAN) ── tank 2 sensor
```
All GPIO goes through each Pi's [pigpio](https://abyz.me.uk/rpi/pigpio/) daemon.
Pins are physical pin numbers (as on the 40-pin header diagram), set in [server/config.js](server/config.js) along with
zones, tanks and calibration. They're converted to the BCM numbers pigpio uses when the server starts.

## Setup

### Main Pi
1. Raspberry Pi OS Bookworm (or Bullseye). 
2. Node.js 22.13 or later. On a 32-bit Pi (armv7l), install Node 22
   with [nvm](https://github.com/nvm-sh/nvm) or the official `linux-armv7l` tarball.
3. Install pigpio and start it now and at boot: `sudo apt install pigpio && sudo systemctl enable --now pigpiod`
4. Clone this repository, then `npm install` and `npm run build`.
5. Set the tank 2 Pi's address in .env: `TANK2_HOST=192.168.1.x`

### Tank 2 Pi
1. Allow remote connections to pigpiod: `sudo raspi-config` → Interface Options → Remote GPIO → Yes.
2. Allow only the main Pi to connect. `-n` is an option to the `pigpiod` daemon, set in a systemd override.
   raspi-config's Remote GPIO setting adds its own override (`public.conf`), so name this one to sort after it:
   ```sh
   sudo tee /etc/systemd/system/pigpiod.service.d/zz-allow-main-pi.conf <<'EOF'
   [Service]
   ExecStart=
   ExecStart=/usr/bin/pigpiod -n <main Pi IP>
   EOF
   sudo systemctl daemon-reload
   sudo systemctl enable pigpiod
   sudo systemctl restart pigpiod
   ps aux | grep [p]igpiod   # should show the -n option
   ```
   Give both Pis a fixed IP (eg: a DHCP reservation on your router).
3. Now, test it from the main Pi: `PIGPIO_ADDR=<tank2 ip> pigs hwver` should print a number.

## Operation
`npm start`, then browse to `http://<pi>:5000`.

To keep it running after a reboot, use [pm2](https://pm2.keymetrics.io):
`TANK2_HOST=... pm2 start server/index.js --name irrigation`, then follow [Persistent applications](https://pm2.keymetrics.io/docs/usage/startup/).

The server switches every zone off when it stops. If pigpiod can't be reached, the UI still loads,
and the problem is shown in the activity log and on any action that needs it.

- Every run has an end time, and nothing runs longer than `maxRunMinutes`. The server switches off
  anything past its end time and re-writes every relay pin. Zones are switched off when the server starts and stops.

## Development
Works on any machine, using mock GPIO hosts that simulate the relays and sensors.

```sh
npm install
npm run seed        # Generates a year of fake tank readings and some schedules
npm run build       # Build the client
npm run dev         # API server on :5001, mock GPIO
npm run dev:client  # Vite on :5173, proxying to the server
npm test
npm run lint
```

## Screenshots
<img src="https://github.com/Chris820/irrigation_system/blob/master/screen-1.png" alt="" width="250" height="445" /> <img src="https://github.com/Chris820/irrigation_system/blob/master/screen-2.png" alt="" width="250" height="445" /> <img src="https://github.com/Chris820/irrigation_system/blob/master/screen-3.png" alt="" width="250" height="445" />
