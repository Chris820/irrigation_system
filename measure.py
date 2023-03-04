#!/usr/bin/python

# Import required libraries
import time
import RPi.GPIO as GPIO

# Use physical pin numbers instead of BCM pin numbers
GPIO.setmode(GPIO.BOARD)
# Set pins to use for trigger(output) and echo(input)
GPIO.setup(16,GPIO.OUT) # trigger
GPIO.setup(18,GPIO.IN) # echo

# Take a bunch of measurements
measurements = []
i = 0
while i < 10:
  i +=1 
  # Set trigger to False, then..
  GPIO.output(16, False)
  time.sleep(.1)
  # Send 10us pulse to trigger
  GPIO.output(16, True)
  time.sleep(.00001)
  GPIO.output(16, False)

  # Record times for leading and trailing edge of echo
  while GPIO.input(18)==0:
    start = time.time()
  while GPIO.input(18)==1:
    stop = time.time()
  # Calculate echo length
  elapsed = stop-start
  # Multiply by the speed of sound (cm/second) then half to get the distance
  distance = ( elapsed * 34326 ) / 2
  # Add it to the list
  measurements.append(distance)
  # Wait a bit so as not to thrash the sensor
  time.sleep(.125)

# Find the mode to the nearest whole centimetre
rounded = []
for measure in measurements:
  rounded.append(round(measure))
mode = max(rounded, key = rounded.count)

# Filter the measures to only include results that cluster around the mode
filtered = []
for measure in measurements:
  if round(measure) == mode:
    filtered.append(measure)
    
# Find the average in millimeters
result = (sum(filtered) / len(filtered)) * 10

# Write the result to text file
f = open('data/tank1Raw.txt', 'w')
f.write(str(result))
f.close()

# Print the result
print (result)

# Cleanup the GPIO
GPIO.cleanup()
