
const utils = require('@iobroker/adapter-core');
const Listener = require('./lib/listener.js');
const Decoder = require('./lib/decoder.js');
//const Creator = require('./lib/creator.js');

class Hapcan extends utils.Adapter {
    /**
       * @param {Partial<ioBroker.AdapterOptions>} [options={}]
       */
    constructor(options) {
        super({
            ...options,
            name: 'hapcan'
        });

        this.listener = new Listener();
        this.decoder = new Decoder();
        //this.creator = new Creator();

        this.listener.on('chunk', (chunk) => this.decoder.put(chunk));
        this.decoder.on('frame', (frameType, flags, node, group, data) => this.create(frameType, flags, node, group, data));

        this.listener.on('logInfo', (msg) => this.log.info(msg));
        this.listener.on('logWarn', (msg) => this.log.warn(msg));
        this.listener.on('logError', (msg) => this.log.error(msg));
        this.decoder.on('logInfo', (msg) => this.log.info(msg));
        this.decoder.on('logWarn', (msg) => this.log.warn(msg));
        this.decoder.on('logError', (msg) => this.log.error(msg));
        // this.creator.on('logInfo', (msg) => this.log.info(msg));
        // this.creator.on('logWarn', (msg) => this.log.warn(msg));
        // this.creator.on('logError', (msg) => this.log.error(msg));

        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        //this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    connect() {
        // HAPCAN:
        this.listener.connect('192.168.7.22', 1010);

        // Testing:
        //this.listener.connect('192.168.7.200', 22222);
    }

    /**
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    create302frame(flags, node, group, data) {
        if (data[0] != 0xFF || data[1] != 0xFF) {
            this.log.error('Invalid 302 frame. Expected D0=FF & D1=FF.');
            return;
        }
        const _node = this.hex2string2(node);
        const _group = this.hex2string2(group);
        const deviceId = _node + '_' + _group;
        const deviceName = 'Node ' + _node + ', group ' + _group;

        // output channel
        const CHANNEL = data[2];
        // actual status of outputs:
        // 0x00 relay off
        // 0xFF relay on
        const STATUS = data[3];
        // instruction that is waiting for execution, or 0xFF if none instruction
        const INSTR1 = data[5];
        // second byte of instruction that is waiting for execution, or 0xFF
        const INSTR2 = data[6];
        // delay value of waiting instruction, or 0x00 if none waiting
        const TIMER = data[7];

        const channel = this.hex2string(CHANNEL);
        const closed = (STATUS == 0xFF);

        const relayClosedId = `${deviceId}.relays.${channel}_closed`;

        this.createRelays(deviceId, deviceName, 6);
        this.setState(relayClosedId, { val: closed, ack: true });
    }

    /**
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    create301frame(flags, node, group, data) {
        if (data[0] != 0xFF || data[1] != 0xFF) {
            this.log.error('Invalid 301 frame. Expected D0=FF & D1=FF.');
            return;
        }
        const _node = this.hex2string2(node);
        const _group = this.hex2string2(group);
        const deviceId = _node + '_' + _group;
        const deviceName = 'Node ' + _node + ', group ' + _group;

        // input channel: 0x01 (button 1) … 0x0E (button 14)
        const CHANNEL = data[2];
        // actual input status:
        // 0x00 open
        // 0x01 disabled
        // 0xFF closed
        // 0xFE closed and held for 400ms
        // 0xFD closed and held for 4s
        // 0xFC closed and open within 400ms
        // 0xFB closed and open between 400ms and 4s
        // 0xFA closed and open after 4s
        const BUTTON = data[3];
        // actual LED status:
        // 0x00 off
        // 0xFF on
        // 0x01 disabled
        const LED = data[4];

        const channel = this.hex2string(CHANNEL);
        const enabled = (BUTTON != 0x01);
        const closed = (BUTTON == 0xFF || BUTTON == 0xFE || BUTTON == 0xFD);
        const status = this.hex2string2(BUTTON); // TODO: enum

        const buttonEnabledId = `${deviceId}.buttons.${channel}_enabled`;
        const buttonClosedId = `${deviceId}.buttons.${channel}_closed`;
        const buttonStatusId = `${deviceId}.buttons.${channel}_status`;

        this.createButtons(deviceId, deviceName, 14);
        this.setState(buttonEnabledId, { val: enabled, ack: true });
        this.setState(buttonClosedId, { val: closed, ack: true });
        this.setState(buttonStatusId, { val: status, ack: true });

        const ledEnabled = (LED != 0x01);
        const ledOn = (LED == 0xFF);

        const ledEnabledId = `${deviceId}.leds.${channel}_enabled`;
        const ledOnId = `${deviceId}.leds.${channel}_on`;

        this.createLeds(deviceId, deviceName, 14);
        this.setState(ledEnabledId, { val: ledEnabled, ack: true });
        this.setState(ledOnId, { val: ledOn, ack: true });
    }

    /**
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    create304frame(flags, node, group, data) {
        if (data[0] != 0xFF || data[1] != 0xFF) {
            this.log.error('Invalid 304 frame. Expected D0=FF & D1=FF.');
            return;
        }
        // const thermometerChannelId = 'thermometer';
        // const thermostatChannelId = 'thermostat';
        const _node = this.hex2string2(node);
        const _group = this.hex2string2(group);
        const deviceId = _node + '_' + _group;
        const deviceName = 'Node ' + _node + ', group ' + _group;

        if (data[2] == 0x11) {
            // Current temperature frame

            // most significant byte of measured temperature 0xFC90 … 0x07D0 (-55°C … +125°C), resolution 0.0625°C
            const TEMPMSB = data[3];
            // least significant byte of measured temperature
            const TEMPLSB = data[4];
            // most significant byte of thermostat value 0xFC90 … 0x07D0 (-55°C … +125°C), resolution 0.0625°C
            const SETPOMSB = data[5];
            // least significant byte of thermostat value
            const SETPOLSB = data[6];
            // switching hysteresis 0x00 … 0xFF (0.0625°C … 16.0000°C), resolution 0.0625°C
            const HYSTER = data[7];

            const temperature = Number(Number(((TEMPMSB * 256) + TEMPLSB) * 0.0625).toFixed(1));
            const setpoint = Number(Number(((SETPOMSB * 256) + SETPOLSB) * 0.0625).toFixed(2));
            const hysteresis = Number(Number(HYSTER * 0.0625).toFixed(4));

            const temperatureId = deviceId + '.thermometer.temperature';
            const setpointId = deviceId + '.thermostat.setpoint';
            const hysteresisId = deviceId + '.thermostat.hysteresis';

            this.createThermometer(deviceId, deviceName);
            this.createThermostat(deviceId, deviceName);
            this.setState(temperatureId, { val: temperature, ack: true });
            this.setState(setpointId, { val: setpoint, ack: true });
            this.setState(hysteresisId, { val: hysteresis, ack: true });
        } else if (data[2] == 0x12) {
            // Thermostat frame

            // current thermostat status (0x00: temperature below setpoint, 0xFF: temperature above setpoint, 0x80: power up value)
            const THERMPOSITION = data[3];
            // thermostat state (0x00: turned off, 0xFF: turned on)
            const THERMSTATE = data[7];

            const position = (THERMPOSITION == 0x00) ? 'BELOW' : (THERMPOSITION == 0xFF) ? 'ABOVE' : (THERMPOSITION == 0x80) ? 'POWERUP' : '?';
            const enabled = (THERMSTATE == 0xFF);

            const positionId = deviceId + '.thermostat.position';
            const enabledId = deviceId + '.thermostat.enabled';

            this.createThermostat(deviceId, deviceName);
            this.setState(positionId, { val: position, ack: true });
            this.setState(enabledId, { val: enabled, ack: true });
        } else if (data[2] == 0x13) {
            // Controller frame
            // TODO: missing implementation of Controller frame
            this.log.warn('Controller frame not implemented');
        } else if (data[2] == 0xF0) {
            // Sensor error frame

            // Error code
            const errorCode = data[3];
            let errorMessage = '';
            switch (errorCode) {
                case 0x01: errorMessage = 'Sensor not connected'; break;
                case 0x02: errorMessage = 'Connected more than one sensor or connected wrong type of sensor'; break;
                case 0x03: errorMessage = 'Connected wrong type of sensor'; break;
                case 0x04: errorMessage = 'Communication problem on 1-wire network (CRC problem)'; break;
            }

            const errorCodeId = deviceId + '.thermometer.error_code';
            const errorMessageId = deviceId + '.thermometer.error_message';

            this.createThermometer(deviceId, deviceName);
            this.setState(errorCodeId, { val: errorCode, ack: true });
            this.setState(errorMessageId, { val: errorMessage, ack: true });
        } else {
            const d2Value = this.hex2string2(data[2]);
            this.log.warn('Unknown 304 frame sub-type. D2=' + d2Value + '.');
        }

    }

    /**
     * @param {number} frameType
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    create(frameType, flags, node, group, data) {

        // https://hapcan.com/devices/universal/univ_3/univ_3-1-3-x/univ_3-1-3-1/univ_3-1-3-1a.pdf

        if (frameType == 0x304) {
            // Thermometer, thermostat
            this.create304frame(flags, node, group, data);
        } else if (frameType == 0x301) {
            // Button
            this.create301frame(flags, node, group, data);
        } else if (frameType == 0x302) {
            // Relay
            this.create302frame(flags, node, group, data);
        } else if (frameType == 0x109) {
            // Status request frame
            // TODO: missing implementation of Status request frame
            this.log.warn('Status request frame not implemented');
        } else if (frameType == 0x113) {
            // Uptime request frame
            // TODO: missing implementation of Uptime request frame
            this.log.warn('Uptime request frame not implemented');
        } else if (frameType == 0x115) {
            // Health check frame
            // TODO: missing implementation of Health check frame
            this.log.warn('Health check frame not implemented');
        } else {
            const frameTypeValue = this.hex2string2(frameType);
            this.log.warn('Frame type ' + frameTypeValue + ' not implemented.');
        }
    }

    /**
       * Is called when databases are connected and adapter received configuration.
       */
    async onReady() {
        // Initialize your adapter here
        //const hapcan = this;

        this.connect();
        this.subscribeStates('*');

        //this.objects = {};
        //this.devices = {};
        /*
                this.objects.getObjectView('system', 'channel', { startkey: this.namespace + '.', endkey: this.namespace + '.\u9999' }, (err, res) => {
                    if (res) {
                        for (let i = 0, l = res.rows.length; i < l; i++) {
                            this.objects[res.rows[i].id] = res.rows[i].value;
                        }
                        this.objects.getObjectView('system', 'state', { startkey: this.namespace + '.', endkey: this.namespace + '.\u9999' }, (err, res) => {
                            if (res) {
                                for (let i = 0, l = res.rows.length; i < l; i++) {
                                    this.objects[res.rows[i].id] = res.rows[i].value;
        
                                    if (this.objects[res.rows[i].id].native && this.objects[res.rows[i].id].native.rf_address) {
                                        this.devices[this.objects[res.rows[i].id].native.rf_address] = this.objects[res.rows[i].id];
                                    }
                                }
                            }
                            this.connect();
                            this.subscribeStates('*');
                        });
                    }
                });
        */

        // The adapters config (in the instance object everything under the attribute 'native') is accessible via
        // this.config:
        //this.log.info('config option1: ' + this.config.option1);
        //this.log.info('config option2: ' + this.config.option2);

        /*
            For every state in the system there has to be also an object of type state
            Here a simple template for a boolean variable named 'testVariable'
            Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
            */
        // await this.setObjectAsync('testVariable', {
        //     type: 'state',
        //     common: {
        //         name: 'testVariable',
        //         type: 'boolean',
        //         role: 'indicator',
        //         read: true,
        //         write: true,
        //     },
        //     native: {},
        // });

        // in this template all states changes inside the adapters namespace are subscribed
        //this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
            */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged 'ack'
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw ioboker: ' + result);

        //result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);
    }

    /**
       * Is called when adapter shuts down - callback has to be called under any circumstances!
       * @param {() => void} callback
       */
    onUnload(callback) {
        try {
            this.log.info('cleaned everything up...');
            this.listener.unload();
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
       * Is called if a subscribed object changes
       * @param {string} id
       * @param {ioBroker.Object | null | undefined} obj
       */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            //this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            //this.log.info(`object ${id} deleted`);
        }
    }

    /**
       * Is called if a subscribed state changes
       * @param {string} id
       * @param {ioBroker.State | null | undefined} state
       */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            //this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            //this.log.info(`state ${id} deleted`);
        }
    }

    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires 'common.message' property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === 'object' && obj.message) {
    // 		if (obj.command === 'send') {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info('send command');

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    // 		}
    // 	}
    // }

    /**
     * @param {string} deviceId
     * @param {string} deviceName
     */
    async createThermometer(deviceId, deviceName) {
        const channelId = 'thermometer';
        const temperatureId = 'temperature';
        const errorCodeId = 'error_code';
        const errorMessageId = 'error_message';
        const fullDeviceId = this.namespace + '.' + deviceId;
        const fullChannelId = fullDeviceId + '.' + channelId;

        let found = false;

        await this.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
        if (found) {
            this.log.warn(fullDeviceId + ' found');
            await this.getChannelsOfAsync(deviceId).then(result => { found = result.some(value => value._id === fullChannelId); });
        } else {
            this.log.warn('Device ' + fullDeviceId + ' NOT found. Creating.');
            await this.createDeviceAsync(deviceId, { name: deviceName });
            this.log.warn('Device ' + fullDeviceId + ' created.');
        }
        if (!found) {
            this.log.warn('Channel ' + fullChannelId + ' NOT found. Creating.');
            await this.createChannelAsync(deviceId, channelId);
            this.log.warn('Channel ' + fullChannelId + ' created.');
            this.createState(deviceId, channelId, temperatureId, {
                name: 'Temperature',
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
                read: true,
                write: false,
            });
            this.createState(deviceId, channelId, errorCodeId, {
                name: 'Error code',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
            });
            this.createState(deviceId, channelId, errorMessageId, {
                name: 'Error message',
                type: 'string',
                role: 'text',
                read: true,
                write: false,
            });
        }
    }

    /**
     * @param {string} deviceId
     * @param {string} deviceName
     */
    async createThermostat(deviceId, deviceName) {
        const channelId = 'thermostat';
        const setpointId = 'setpoint';
        const hysteresisId = 'hysteresis';
        const positionId = 'position';
        const enabledId = 'enabled';
        const fullDeviceId = this.namespace + '.' + deviceId;
        const fullChannelId = fullDeviceId + '.' + channelId;

        let found = false;

        await this.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
        if (found) {
            // this.log.warn('Device ' + fullDeviceId + ' found');
            await this.getChannelsOfAsync(deviceId).then(result => { found = result.some(value => value._id === fullChannelId); });
        } else {
            this.log.warn('Device ' + fullDeviceId + ' NOT found. Creating.');
            await this.createDeviceAsync(deviceId, { name: deviceName });
            this.log.warn('Device ' + fullDeviceId + ' created.');
        }
        if (!found) {
            this.log.warn('Channel ' + fullChannelId + ' NOT found. Creating.');
            await this.createChannelAsync(deviceId, channelId);
            this.log.warn('Channel ' + fullChannelId + ' created.');
            this.createState(deviceId, channelId, setpointId, {
                name: 'Setpoint',
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
                read: true,
                write: false,
            });
            this.createState(deviceId, channelId, hysteresisId, {
                name: 'Hysteresis',
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
                read: true,
                write: false,
            });
            this.createState(deviceId, channelId, positionId, {
                name: 'Position',
                type: 'string',
                role: 'indicator.state',
                read: true,
                write: false,
            });
            this.createState(deviceId, channelId, enabledId, {
                name: 'Enabled',
                type: 'boolean',
                role: 'indicator.plugged',
                read: true,
                write: false,
            });
        }
    }

    /**
 * @param {string} deviceId
 * @param {string} deviceName
 * @param {number} buttonsCount
 */
    async createButtons(deviceId, deviceName, buttonsCount) {
        const channelId = 'buttons';
        const fullDeviceId = this.namespace + '.' + deviceId;
        const fullChannelId = fullDeviceId + '.' + channelId;

        let found = false;

        await this.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
        if (found) {
            // this.log.warn('Device ' + fullDeviceId + ' found');
            await this.getChannelsOfAsync(deviceId).then(result => { found = result.some(value => value._id === fullChannelId); });
        } else {
            this.log.warn('Device ' + fullDeviceId + ' NOT found. Creating.');
            await this.createDeviceAsync(deviceId, { name: deviceName });
            this.log.warn('Device ' + fullDeviceId + ' created.');
        }
        if (!found) {
            this.log.warn('Channel ' + fullChannelId + ' NOT found. Creating.');
            await this.createChannelAsync(deviceId, channelId);
            this.log.warn('Channel ' + fullChannelId + ' created.');
            for (let i = 1; i <= buttonsCount; i++) {
                const iValue = this.hex2string(i);
                const statusId = `${iValue}_status`;
                const closedId = `${iValue}_closed`;
                const enabledId = `${iValue}_enabled`;

                this.createState(deviceId, channelId, statusId, {
                    name: 'Status',
                    type: 'string',
                    role: 'indicator.state',
                    read: true,
                    write: false,
                });
                this.createState(deviceId, channelId, closedId, {
                    name: 'Closed',
                    type: 'boolean',
                    role: 'button',
                    read: true,
                    write: false,
                });
                this.createState(deviceId, channelId, enabledId, {
                    name: 'Enabled',
                    type: 'boolean',
                    role: 'indicator.plugged',
                    read: true,
                    write: false,
                });
            }
        }
    }

    /**
* @param {string} deviceId
* @param {string} deviceName
* @param {number} ledsCount
*/
    async createLeds(deviceId, deviceName, ledsCount) {
        const channelId = 'leds';
        const fullDeviceId = this.namespace + '.' + deviceId;
        const fullChannelId = fullDeviceId + '.' + channelId;

        let found = false;

        await this.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
        if (found) {
            // this.log.warn('Device ' + fullDeviceId + ' found');
            await this.getChannelsOfAsync(deviceId).then(result => { found = result.some(value => value._id === fullChannelId); });
        } else {
            this.log.warn('Device ' + fullDeviceId + ' NOT found. Creating.');
            await this.createDeviceAsync(deviceId, { name: deviceName });
            this.log.warn('Device ' + fullDeviceId + ' created.');
        }
        if (!found) {
            this.log.warn('Channel ' + fullChannelId + ' NOT found. Creating.');
            await this.createChannelAsync(deviceId, channelId);
            this.log.warn('Channel ' + fullChannelId + ' created.');
            for (let i = 1; i <= ledsCount; i++) {
                const iValue = this.hex2string(i);
                const onId = `${iValue}_on`;
                const enabledId = `${iValue}_enabled`;

                this.createState(deviceId, channelId, onId, {
                    name: 'On',
                    type: 'boolean',
                    role: 'switch',
                    read: true,
                    write: false,
                });
                this.createState(deviceId, channelId, enabledId, {
                    name: 'Enabled',
                    type: 'boolean',
                    role: 'indicator.plugged',
                    read: true,
                    write: false,
                });
            }
        }
    }

    /**
* @param {string} deviceId
* @param {string} deviceName
* @param {number} relaysCount
*/
    async createRelays(deviceId, deviceName, relaysCount) {
        const channelId = 'relays';
        const fullDeviceId = this.namespace + '.' + deviceId;
        const fullChannelId = fullDeviceId + '.' + channelId;

        let found = false;

        await this.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
        if (found) {
            // this.log.warn('Device ' + fullDeviceId + ' found');
            await this.getChannelsOfAsync(deviceId).then(result => { found = result.some(value => value._id === fullChannelId); });
        } else {
            this.log.warn('Device ' + fullDeviceId + ' NOT found. Creating.');
            await this.createDeviceAsync(deviceId, { name: deviceName });
            this.log.warn('Device ' + fullDeviceId + ' created.');
        }
        if (!found) {
            this.log.warn('Channel ' + fullChannelId + ' NOT found. Creating.');
            await this.createChannelAsync(deviceId, channelId);
            this.log.warn('Channel ' + fullChannelId + ' created.');
            for (let i = 1; i <= relaysCount; i++) {
                const iValue = this.hex2string(i);
                const closedId = `${iValue}_closed`;

                this.createState(deviceId, channelId, closedId, {
                    name: 'Closed',
                    type: 'boolean',
                    role: 'switch',
                    read: true,
                    write: false,
                });
            }
        }
    }

    /**
    * @param {number} hexValue
    */
    hex2string2(hexValue) {
        return this.hex2string(hexValue).padStart(2, '0');
    }

    /**
    * @param {number} hexValue
    */
    hex2string(hexValue) {
        return hexValue.toString(16).toUpperCase();
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
       * @param {Partial<ioBroker.AdapterOptions>} [options={}]
       */
    module.exports = (options) => new Hapcan(options);
} else {
    // otherwise start the instance directly
    new Hapcan();
}







//this.createDevice('Fake device');
/*
                const device = {
                    'rf_address': '06aebc',
                    'initialized': true,
                    'fromCmd': false,
                    'error': false,
                    'valid': true,
                    'mode': 'MANUAL',
                    'dst_active': true,
                    'gateway_known': true,
                    'panel_locked': false,
                    'link_error': true,
                    'battery_low': false,
                    'valve': 0,
                    'setpoint': 20,
                    'temp': 0
                };
*/
/*
                const deviceInfo = {
                    'device_type': 1,
                    'device_name': 'ThermostatSchlafzimmer',
                    'room_name': 'Schlafzimmer',
                    'room_id': 1
                };
*/
//const id = this.namespace + '.devices.contact_' + device.rf_address;
//const objs = [];
/*
                objs.push({
                    _id: id,
                    common: {
                        name: deviceInfo.device_name,
                        role: 'contact'
                    },
                    type: 'channel',
                    native: {
                        rf_address: device.rf_address,
                        device_type: deviceInfo.device_type

                    }
                });
                objs.push({
                    _id: id + '.initialized',
                    common: {
                        name: deviceInfo.device_name + ' initialized',
                        type: 'boolean',
                        role: 'indicator.initialized',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.error',
                    common: {
                        name: deviceInfo.device_name + ' error',
                        type: 'boolean',
                        role: 'indicator.error',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.invalid',
                    common: {
                        name: deviceInfo.device_name + ' invalid',
                        type: 'boolean',
                        role: 'indicator.invalid',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.link_error',
                    common: {
                        name: deviceInfo.device_name + ' link_error',
                        type: 'boolean',
                        role: 'indicator.link',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.battery_low',
                    common: {
                        name: deviceInfo.device_name + ' battery_low',
                        type: 'boolean',
                        role: 'indicator.battery',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
                objs.push({
                    _id: id + '.opened',
                    common: {
                        name: deviceInfo.device_name + ' is opened',
                        type: 'boolean',
                        role: 'state',
                        write: false,
                        read: true
                    },
                    type: 'state',
                    native: {}
                });
*/
/*
         if (id) {
             if (deviceInfo.room_name) {
                 this.getForeignObject('enum.rooms.' + deviceInfo.room_name.replace(/\s|,/g, '_'), (err, obj) => {
                     if (!obj) {
                         obj = {
                             _id: 'enum.rooms.' + deviceInfo.room_name.replace(/\s|,/g, '_'),
                             common: {
                                 name: deviceInfo.room_name,
                                 desc: 'Extracted from MAX! Cube',
                                 members: []
                             },
                             type: 'enum',
                             native: {}
                         };
                     }
                     if (obj.common.members.indexOf(id) === -1) {
                         obj.common.members.push(id);
                         this.setForeignObject(obj._id, obj, (err, obj) => {
                             if (err) {
                                 this.log.error(err);
                             }
                             syncObjects(objs);
                             setStates(device);
                         });
                     } else {
                         syncObjects(objs);
                         setStates(device);
                     }
                 });
             } else {
                 syncObjects(objs);
                 setStates(device);
             }
    }
*/