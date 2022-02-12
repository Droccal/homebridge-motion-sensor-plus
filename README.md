# Homebridge Motion Sensor

This is a [homebridge](https://github.com/nfarina/homebridge) plugin to make a Raspberry Pi connected with a motion sensor for example:

- PIR Sensor
- Ultrasonic sensor
- Radar sensor

There are a few adjustments that can be made via the config.

## Config
After name the most important config is the gpio pin where the sensor is connected of course.

### delaySeconds
In case we don't want to immediately notify that a movement was noticed we can delay here by x seconds. This might only make sense if your sensor has a higher resolution than a "standard" PIR sensor (which in my case could only report every 5s). 

After the defined timeframe the plugin will check again if there was a movement and will then propagate the detected state.

### timeoutSeconds
Here we can define a number of seconds to wait until checking for a new movement. Most sensors like the philips hue have a timeout of 20s and will then check for a new movement.

### cacheSeconds
The radar is very sensitive to movements, even if there was a movement some milliseconds ago, and we check right now for a new movement (for example after the timeout) - we could get a "no movement" - which means that state will be propagated. 

To avoid for example lights flickering we can define a cache timeout to check if there was a movement in the last x seconds. 

### recognitionValue
This is only relevant when not using an PIR sensor. While the pir sensor will notify on gpio with a "1" that a movement is detected, the radar will work the other way round (due to the doppler effect).

This means for the radar a recognized movement is notified with a "0" on the gpio pin. In this case we have to define the config value as "false".


## Notice
Feel free to fork or use the plugin in any way you want. Also if you would like to have a feature feel free to add an issue/request in github.