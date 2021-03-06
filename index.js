const gpio = require('rpi-gpio');
gpio.setMode(gpio.MODE_BCM);

let Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-motion-sensor-plus", 'Motion Plus Sensor', MotionSensor);
};

class MotionSensor {
    constructor(log, config) {
        this.log = log
        this.name = config.name
        this.gpioPin = config.gpioPin
        this.timeoutSeconds = config.timeoutSeconds ?? 10 // default is 10 seconds
        this.delayMilliseconds = config.delayMilliseconds ?? 0
        this.delayCacheSeconds = config.delayCacheSeconds ?? 0
        this.cacheSeconds = config.cacheSeconds ?? 0
        this.sensorType = config.sensorType ?? "pir"

        this.recognitionValue = this.sensorType !== "radar"

        this.currentlyWaiting = false
        this.afterTimeoutMotionDetected = false
        this.lastMovement = new Date()
        this.motionDetected = false
        this.propertyMonitoring = true
    }

    identify(callback) {
        this.log('Identify requested!');
        callback(null);
    }

    getSensorData(cb) {
        gpio.read(this.gpioPin, (err, value) => {
            cb(value, err)
        })
    }

    async startSensorMonitoring() {
        let error
        while (error === undefined) {
            this.getSensorData(async (sensor, err) => {
                if (err) {
                    error = new Error("The sensor cant be found on the configured gpio pin")
                }
                this.motionDetected = (sensor === this.recognitionValue)
                if (this.motionDetected) {
                    this.lastMovement = Date.now()
                }
            })
            await new Promise(r => setTimeout(r, 100))
        }
        return error
    }

    async startPropertyMonitoring() {
        while (this.propertyMonitoring) {
            if (this.motionDetected) {
                if (!this.currentlyWaiting) {
                    this.log.info("Motion detected")
                    await this.waitForDelay()
                }
            }

            await new Promise(r => setTimeout(r, 100))
        }
    }

    async waitForDelay() {
        this.currentlyWaiting = true

        if (this.delayMilliseconds === 0) {
            this.log.debug("No delay defined, waiting for timeout")
            this.service.setCharacteristic(Characteristic.OccupancyDetected, true);
            await this.waitForTimeout()
        } else {
            await new Promise(r => setTimeout(r, this.delayMilliseconds))

            if (this.delayCacheSeconds > 0 && this.movementWithinCache(this.lastMovement, this.delayCacheSeconds)) {
                this.log.debug("Got movement while waiting after delay, using cached")
                this.service.setCharacteristic(Characteristic.OccupancyDetected, true);
                await this.waitForTimeout()
            } else {
                this.getSensorData(async (sensor) => {
                    if (sensor === this.recognitionValue) {
                        this.service.setCharacteristic(Characteristic.OccupancyDetected, true);
                        this.log.debug("New movement after delay")
                        await this.waitForTimeout()
                    } else {
                        this.log.debug("No movement after cache")
                        this.service.setCharacteristic(Characteristic.OccupancyDetected, false);
                    }
                })
            }
        }
    }

    async waitForTimeout() {
        do {
            await new Promise(r => setTimeout(r, this.timeoutSeconds * 1000))

            if (this.cacheSeconds > 0 && this.movementWithinCache(this.lastMovement, this.cacheSeconds)) {
                this.log.debug("Got movement while waiting, using cached")
                this.afterTimeoutMotionDetected = true
                this.currentlyWaiting = true
            } else {
                this.getSensorData(async (sensor) => {
                    let afterTimeout = (sensor === this.recognitionValue)
                    this.log.debug("After timeout: " + afterTimeout)

                    this.afterTimeoutMotionDetected = afterTimeout
                    this.service.setCharacteristic(Characteristic.OccupancyDetected, afterTimeout);
                })
            }
        } while (this.afterTimeoutMotionDetected)

        this.currentlyWaiting = false
    }

    movementWithinCache(lastMove, cache) {
        let timeSinceLastMovement = Math.floor((Date.now() - lastMove) / 1000)
        return timeSinceLastMovement < cache
    }

    getServices() {
        const informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Encore Dev Labs')
            .setCharacteristic(Characteristic.Model, 'Pi Motion Sensor')
            .setCharacteristic(Characteristic.SerialNumber, 'Raspberry Pi');

        this.service = new Service.OccupancySensor(this.name);

        gpio.setup(this.gpioPin, gpio.DIR_IN, gpio.EDGE_BOTH, () => {
            this.startSensorMonitoring().then(err => {
                if(err !== undefined){
                    this.log.info("It seems the gpio pin that was defined is not connected to a sensor")
                    this.propertyMonitoring = false
                }
            })
        });
        this.startPropertyMonitoring()

        this.service
            .getCharacteristic(Characteristic.Name)
            .on('get', callback => {
                callback(null, this.name)
            });

        return [informationService, this.service];
    }
}