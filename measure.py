#!/usr/bin/python

# Import required libraries
import time
import RPi.GPIO as GPIO

# Use BCM pin numbers instead of physical pin numbers
GPIO.setmode(GPIO.BCM)
# Set pins to use for trigger(output) and echo(input)
GPIO.setup(23,GPIO.OUT) # trigger
GPIO.setup(24,GPIO.IN) #echo

# Set trigger to False, then..
GPIO.output(23, False)
time.sleep(.1)
# Send 10us pulse to trigger
GPIO.output(23, True)
time.sleep(.00001)
GPIO.output(23, False)

# Record pulse times
while GPIO.input(24)==0:
  start = time.time()
while GPIO.input(24)==1:
  stop = time.time()
# Calculate pulse length
elapsed = stop-start
# Multiply by the speed of sound (mm/second) then half to get the distance
distance = ( elapsed * 343260 ) / 2
# Print the output
print distance

# Cleanup the GPIO
GPIO.cleanup()
