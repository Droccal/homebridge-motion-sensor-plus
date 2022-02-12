const gpio = require('rpi-gpio');
gpio.setMode(gpio.MODE_BCM);

let Service, Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-motion-sensor-plus",'Motion Plus Sensor', MotionSensor);
};

class MotionSensor {
    constructor(log, config) {
        this.log = log;
        this.name = config.name;
        this.pirPin = config.pirPin;
        this.timeoutSeconds = config.timeoutSeconds ?? 10 // default is 10 seconds
        this.delayMilliseconds = config.delayMilliseconds ?? 0
        this.recognitionValue = config.recognitionValue ?? true
        this.cacheSeconds = config.cacheSeconds ?? 0

        this.currentlyWaiting = false
        this.afterTimeoutMotionDetected = false
        this.lastMovement = new Date()
    }

    identify(callback) {
        this.log('Identify requested!');
        callback(null);
    }

    getSensorData(cb) {
        gpio.read(this.pirPin, (err, value) => {
            if (err) {
                console.error(err); // eslint-disable-line no-console
                return;
            }
            cb(value)
        })
    }

    async startSensorMonitoring() {
        while (true) {
            this.getSensorData(async (sensor) => {
                let movement = (sensor === this.recognitionValue)

                if (movement) {
                    this.lastMovement = Date.now()
                    // we can wait a defined amount of seconds before setting the motion
                    if (!this.currentlyWaiting) {
                        this.log.info("Motion detected: " + movement)
                        this.waitForDelay()
                    }
                }
            })

            await new Promise(r => setTimeout(r, 100))
        }
    }

    async waitForDelay() {
        this.currentlyWaiting = true

        if (this.delayMilliseconds === 0) {
            this.service.setCharacteristic(Characteristic.MotionDetected, true);
            await this.waitForTimeout()
        } else {
            await new Promise(r => setTimeout(r, this.delayMilliseconds))

            if (this.movementWithinCache()) {
                this.service.setCharacteristic(Characteristic.MotionDetected, true);
                await this.waitForTimeout()
            } else {
                this.service.setCharacteristic(Characteristic.MotionDetected, false);
            }
        }
    }

    async waitForTimeout() {
        do {
            await new Promise(r => setTimeout(r, this.timeoutSeconds * 1000))

            if (this.movementWithinCache()) {
                this.log.info("Got movement while waiting, using cached")
                this.afterTimeoutMotionDetected = true
                this.currentlyWaiting = true
            } else {
                this.getSensorData(async (sensor) => {
                    let afterTimeout = (sensor === this.recognitionValue)
                    this.log.info("After timeout: " + afterTimeout)

                    this.afterTimeoutMotionDetected = afterTimeout
                    this.service.setCharacteristic(Characteristic.MotionDetected, afterTimeout);
                })
            }
        } while (this.afterTimeoutMotionDetected)

        this.currentlyWaiting = false
    }

    movementWithinCache() {
        let timeSinceLastMovement = Math.floor((Date.now() - this.lastMovement) / 1000)
        return timeSinceLastMovement < this.cacheSeconds
    }

    getServices() {
        const informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Encore Dev Labs')
            .setCharacteristic(Characteristic.Model, 'Pi Motion Sensor')
            .setCharacteristic(Characteristic.SerialNumber, 'Raspberry Pi');

        this.service = new Service.MotionSensor(this.name);
        this.service
            .getCharacteristic(Characteristic.MotionDetected)
            .on('get', (callback) => {
                this.getSensorData((sensor) => {
                    let current = (sensor === this.recognitionValue)
                    callback(null, current)
                })
            });

        gpio.setup(this.pirPin, gpio.DIR_IN, gpio.EDGE_BOTH, () => {
            this.startSensorMonitoring()
        });

        this.service
            .getCharacteristic(Characteristic.Name)
            .on('get', callback => {
                callback(null, this.name)
            });

        return [informationService, this.service];
    }
}