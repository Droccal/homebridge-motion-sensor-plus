## [1.0.1] 14.02.2022

- remove separate "get" for sensor status from Homebridge, since this destroyed the whole waiting logic
- change to Occupancy sensor instead of Motion sensor
- change most log levels to debug (to avoid spamming)

## [1.0.0] 12.02.2022
- fork from Homebridge Pir Motion Sensor V2 (which seem to be offline in github)
- build whole new logic for monitoring and reacting on movement
- have detailed config for how movements are reported