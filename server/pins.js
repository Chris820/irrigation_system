// Physical pin numbers (as printed on the 40-pin header diagram) to the BCM GPIO
// numbers pigpio uses. Pins missing here are power or ground.
const PHYSICAL_TO_BCM = {
  3: 2, 5: 3, 7: 4, 8: 14, 10: 15, 11: 17, 12: 18, 13: 27, 15: 22, 16: 23,
  18: 24, 19: 10, 21: 9, 22: 25, 23: 11, 24: 8, 26: 7, 27: 0, 28: 1, 29: 5,
  31: 6, 32: 12, 33: 13, 35: 19, 36: 16, 37: 26, 38: 20, 40: 21,
}

export function toBcm(physical) {
  const bcm = PHYSICAL_TO_BCM[physical]
  if (bcm === undefined) throw new Error(`Physical pin ${physical} is not a GPIO pin`)
  return bcm
}
