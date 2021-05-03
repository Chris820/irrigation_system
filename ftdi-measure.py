#!/usr/bin/python3

import time
from pyftdi.ftdi import Ftdi
from pyftdi.gpio import GpioAsyncController

# Set up
gpio = GpioAsyncController()
gpio.configure('ftdi:///1', direction=0x0e, frequency=1e6, initial=0x00)
start = 0
stop = 0

# Set trigger to off, then..
gpio.write(0x00)
time.sleep(.1)
# Send 10us pulse to trigger
gpio.write(0x02)
time.sleep(.00001)
gpio.write(0x00)

# Record times for leading and trailing edge of echo
while gpio.read()==240:
  start = time.time()
while gpio.read()==241:
  stop = time.time()

if start != 0 and stop != 0:
 # Calculate echo length
 elapsed = stop-start
 # Multiply by the speed of sound (mm/second) then half to get the distance
 distance = ( elapsed * 343260 ) / 2
 # Print the output
 print(distance)

# Clean up and close
gpio.write(0x00)
gpio.close()
exit()

## Reference ##
# Ftdi.show_devices()
#TXD 0x01  Orange
#RXD 0x02  Yellow
#RTS 0x04  Green
#CTS 0x08  Brown
#DTR 0x10 (nc)
#DSR 0x20 (nc)
#DCD 0x40 (nc)
#RI  0x80 (nc)
