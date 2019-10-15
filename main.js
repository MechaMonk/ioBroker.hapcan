
const utils = require('@iobroker/adapter-core');
const AsyncLock = require('./lib/async-lock.js');
const Listener = require('./lib/listener.js');
const Decoder = require('./lib/decoder.js');
const Encoder = require('./lib/encoder.js');

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
        this.encoder = new Encoder();
        this._lock = new AsyncLock();

        this.listener.on('chunk', (chunk) => this.decoder.put(chunk));
        this.decoder.on('frame', (frameType, flags, node, group, data) => this.readFrame(frameType, flags, node, group, data));
        this.encoder.on('frame', (data) => this.listener.write(data));

        this.listener.on('logInfo', (msg) => this.log.info(msg));
        this.listener.on('logWarn', (msg) => this.log.warn(msg));
        this.listener.on('logError', (msg) => this.log.error(msg));
        this.decoder.on('logInfo', (msg) => this.log.info(msg));
        this.decoder.on('logWarn', (msg) => this.log.warn(msg));
        this.decoder.on('logError', (msg) => this.log.error(msg));
        this.encoder.on('logInfo', (msg) => this.log.info(msg));
        this.encoder.on('logWarn', (msg) => this.log.warn(msg));
        this.encoder.on('logError', (msg) => this.log.error(msg));

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
     * Relays
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    async read302frame(flags, node, group, data) {
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
        // const INSTR1 = data[5];
        // second byte of instruction that is waiting for execution, or 0xFF
        // const INSTR2 = data[6];
        // delay value of waiting instruction, or 0x00 if none waiting
        // const TIMER = data[7];
        // TODO: handle timer & waiting instruction (how?)

        const channel = this.hex2string(CHANNEL);
        const closed = (STATUS == 0xFF);

        await this.createRelays(node, group, { id: deviceId, name: deviceName }, 6);
        // TODO: get ids from create() function
        await this.setStateAsync(`${deviceId}.relays.${channel}_closed`, { val: closed, ack: true });
    }

    /**
     * Real Time Clock
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    async read300frame(flags, node, group, data) {
        if (data[0] != 0xFF) {
            this.log.error('Invalid 300 frame. Expected D0=FF.');
            return;
        }
        const _node = this.hex2string2(node);
        const _group = this.hex2string2(group);
        const deviceId = _node + '_' + _group;
        const deviceName = 'Node ' + _node + ', group ' + _group;

        // 
        const YEAR = this.bcd2number(data[1]);
        const MONTH = this.bcd2number(data[2]);
        const DAY = this.bcd2number(data[3]);
        //const DAY_OF_WEEK = this.bcd2number(data[4]);
        const HOUR = this.bcd2number(data[5]);
        const MINUTE = this.bcd2number(data[6]);
        const SECOND = this.bcd2number(data[7]);

        const dateTime = new Date(YEAR + 2000, MONTH, DAY, HOUR, MINUTE, SECOND);
        const dateTimeIso = dateTime.toISOString();

        await this.createRtc(node, group, { id: deviceId, name: deviceName });
        // TODO: get ids from create() function
        await this.setStateAsync(`${deviceId}.rtc.date_time_local`, { val: dateTime, ack: true });
        await this.setStateAsync(`${deviceId}.rtc.date_time`, { val: dateTime, ack: true });
        await this.setStateAsync(`${deviceId}.rtc.date`, { val: dateTimeIso.slice(0, 10), ack: true });
        await this.setStateAsync(`${deviceId}.rtc.time`, { val: dateTimeIso.slice(11, 19), ack: true });
    }

    /**
 * Buttons
 * @param {number} flags
 * @param {number} node
 * @param {number} group
 * @param {number[]} data
 */
    async read301frame(flags, node, group, data) {
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

        // TODO: read count from firmware
        const channelsCount = 14;

        const channel = this.hex2string(CHANNEL);
        const enabled = (BUTTON != 0x01);
        const closed = (BUTTON == 0xFF || BUTTON == 0xFE || BUTTON == 0xFD);
        const status = this.hex2string2(BUTTON); // TODO: enum

        await this.createButtons(node, group, { id: deviceId, name: deviceName }, channelsCount);
        // TODO: get ids from create() function
        await this.setStateAsync(`${deviceId}.buttons.${channel}_enabled`, { val: enabled, ack: true });
        await this.setStateAsync(`${deviceId}.buttons.${channel}_closed`, { val: closed, ack: true });
        await this.setStateAsync(`${deviceId}.buttons.${channel}_status`, { val: status, ack: true });

        const ledEnabled = (LED != 0x01);
        const ledOn = (LED == 0xFF);

        await this.createLeds(node, group, { id: deviceId, name: deviceName }, channelsCount);
        // TODO: get ids from create() function
        await this.setStateAsync(`${deviceId}.leds.${channel}_enabled`, { val: ledEnabled, ack: true });
        await this.setStateAsync(`${deviceId}.leds.${channel}_on`, { val: ledOn, ack: true });
    }

    /**
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    async read304frame(flags, node, group, data) {
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

            await this.createThermometer(node, group, { id: deviceId, name: deviceName });
            await this.createThermostat(node, group, { id: deviceId, name: deviceName });
            // TODO: get ids from create() function
            await this.setStateAsync(`${deviceId}.thermometer.temperature`, { val: temperature, ack: true });
            await this.setStateAsync(`${deviceId}.thermostat.setpoint`, { val: setpoint, ack: true });
            await this.setStateAsync(`${deviceId}.thermostat.hysteresis`, { val: hysteresis, ack: true });
        } else if (data[2] == 0x12) {
            // Thermostat frame

            // current thermostat status (0x00: temperature below setpoint, 0xFF: temperature above setpoint, 0x80: power up value)
            const THERMPOSITION = data[3];
            // thermostat state (0x00: turned off, 0xFF: turned on)
            const THERMSTATE = data[7];

            const position = (THERMPOSITION == 0x00) ? 'BELOW' : (THERMPOSITION == 0xFF) ? 'ABOVE' : (THERMPOSITION == 0x80) ? 'POWERUP' : '?';
            const enabled = (THERMSTATE == 0xFF);

            await this.createThermostat(node, group, { id: deviceId, name: deviceName });
            // TODO: get ids from create() function
            await this.setStateAsync(`${deviceId}.thermostat.position`, { val: position, ack: true });
            await this.setStateAsync(`${deviceId}.thermostat.enabled`, { val: enabled, ack: true });
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

            await this.createThermometer(node, group, { id: deviceId, name: deviceName });
            // TODO: get ids from create() function
            await this.setStateAsync(`${deviceId}.thermometer.error_code`, { val: errorCode, ack: true });
            await this.setStateAsync(`${deviceId}.thermometer.error_message`, { val: errorMessage, ack: true });
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
    async readFrame(frameType, flags, node, group, data) {
        switch (frameType) {
            case 0x300: { // Real Time Clock
                this.read300frame(flags, node, group, data);
                break;
            }
            case 0x301: { // Button
                this.read301frame(flags, node, group, data);
                break;
            }
            case 0x302: { // Relay
                this.read302frame(flags, node, group, data);
                break;
            }
            case 0x304: { // Thermometer, thermostat
                this.read304frame(flags, node, group, data);
                break;
            }
            case 0x109: { // Status request frame
                // TODO: missing implementation of Status request frame
                this.log.warn('Status request frame not implemented');
                break;
            }
            case 0x113: { // Uptime request frame
                // TODO: missing implementation of Uptime request frame
                this.log.warn('Uptime request frame not implemented');
                break;
            }
            case 0x115: { // Health check frame
                // TODO: missing implementation of Health check frame
                this.log.warn('Health check frame not implemented');
                break;
            }
            default: {
                const frameTypeValue = this.hex2string2(frameType);
                this.log.warn('Frame type ' + frameTypeValue + ' not implemented.');
            }
        }
    }

    /**
           * @param {string} id
           * @param {ioBroker.State | null | undefined} state
           */
    async updateState(id, state) {
        await this.getObjectAsync(id).then(async stateObject => {
            if (stateObject === undefined || stateObject == null) {
                this.log.warn(`Object ${id} NOT found. State change ignored.`);
                return;
            } else if (stateObject.type !== 'state') {
                this.log.warn(`Object ${id} is NOT the state object. State change ignored.`);
                return;
            }
            if (!stateObject.common.write) {
                this.log.warn(`State object ${id} is NOT writable. State change ignored.`);
                return;
            }
            if (state === undefined || state == null) {
                this.log.warn(`State of ${id} is empty. State change ignored.`);
                return;
            }
            // this.log.info(`State object ${id} found`);
            // this.log.info(`typeof result = ${typeof result}`);

            // ex: 'hapcan.0.01_03.leds.1_on'
            // Delete state & channel id
            const channelId = id.slice(0, id.lastIndexOf('.'));
            // this.log.info(channelId);
            await this.getObjectAsync(channelId).then(async channelObject => {
                if (channelObject === undefined || channelObject == null) {
                    this.log.warn(`Channel ${id} NOT found. State change ignored.`);
                    return;
                } else if (channelObject.type !== 'channel') {
                    this.log.warn(`Object ${id} is NOT the channel object. State change ignored.`);
                    return;
                }

                const deviceId = channelId.slice(0, channelId.lastIndexOf('.'));
                // this.log.info(deviceId);
                await this.getObjectAsync(deviceId).then(async deviceObject => {
                    if (deviceObject === undefined || deviceObject == null) {
                        this.log.warn(`Device ${id} NOT found. State change ignored.`);
                        return;
                    } else if (deviceObject.type !== 'device') {
                        this.log.warn(`Object ${id} is NOT the device object. State change ignored.`);
                        return;
                    }

                    await this.encoder.writeState(deviceObject, channelObject, stateObject, state);
                });
            });
        });
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
            if (!state.ack) {
                this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                this.updateState(id, state);
            }
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
     * @param {number} node
     * @param {number} group
     * @param {{id: string, name:string}} device
     * @param {{id: string, name:string, type:string}} channel
     * @returns {Promise<{found: boolean, states: ioBroker.StateObject[]}>}
     */
    async createDeviceChannel2(node, group, device, channel) {
        // this.log.info('createDeviceChannel2');
        let found = false;
        let states = [];

        const fullDeviceId = this.namespace + '.' + device.id;
        const fullChannelId = fullDeviceId + '.' + channel.id;

        await this.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
        if (found) {
            // this.log.info('Device ' + fullDeviceId + ' found.');
            await this.getChannelsOfAsync(device.id).then(result => { found = result.some(value => value._id === fullChannelId); });
        } else {
            //this.log.info('Device ' + fullDeviceId + ' NOT found. Creating.');
            await this.createDeviceAsync(device.id, { name: device.name }, { node: node, group: group });
            this.log.info('Device ' + fullDeviceId + ' created.');
        }
        if (!found) {
            //this.log.info('Channel ' + fullChannelId + ' NOT found. Creating.');
            await this.createChannelAsync(device.id, channel.id, { name: channel.name }, { type: channel.type });
            this.log.info('Channel ' + fullChannelId + ' created.');
        } else {
            // this.log.info('Channel ' + fullChannelId + ' found.');
            await this.getStatesOfAsync(device.id, channel.id).then(result => states = result);
        }

        //this.log.info(JSON.stringify(states));
        return { found, states };
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {{id: string, name:string}} device
    * @param {{id: string, name:string, type:string}} channel
    * @returns {Promise<{found: boolean, states: ioBroker.StateObject[]}>}
    */
    async createDeviceChannel(node, group, device, channel) {
        const _this = this;

        // Read device – create if not exists, read channels – create if not exist: the sequence of operations has to be executed as atom operation.
        // Two frames from the same device = 2 × try to create.
        // So lock access to ioBroker objects database.

        const lockName = 'devices & channels';

        // this.log.info('createDeviceChannel[1], isBusy =  ' + this._lock.isBusy(lockName));
        return this._lock.acquire(lockName, function () {
            // _this.log.info('createDeviceChannel[2], isBusy =  ' + _this._lock.isBusy(lockName));
            return _this.createDeviceChannel2(node, group, device, channel);
        }, {});
    }

    /**
    * @param {ioBroker.StateObject[]} states
    * @param {string} deviceId
    * @param {string} channelId
    * @param {string} stateId
    * @param {Partial<ioBroker.StateCommon>} common
    * @param {Record<string, any>} native
    */
    async checkCreateState(states, deviceId, channelId, stateId, common, native) {
        const fullStateId = `${this.namespace}.${deviceId}.${channelId}.${stateId}`;
        if (!states.some(value => value._id === fullStateId)) {
            return this.createStateAsync(deviceId, channelId, stateId, common, native);
        }
    }

    /**
    * @param {number} node
    * @param {number} group
     * @param {{id:string, name:string}} device
     */
    async createThermometer(node, group, device) {
        const channel = { id: 'thermometer', name: 'Thermometer', type: 'thermometer' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        await this.checkCreateState(result.states, device.id, channel.id, 'temperature',
            {
                name: 'Temperature',
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, 'error_code',
            {
                name: 'Error code',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, 'error_mssage',
            {
                name: 'Error message',
                type: 'string',
                role: 'text',
                read: true,
                write: false,
            },
            {
            });
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {{id:string, name:string}} device
    */
    async createThermostat(node, group, device) {
        const channel = { id: 'thermostat', name: 'Thermostat', type: 'thermostat' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        await this.checkCreateState(result.states, device.id, channel.id, 'setpoint',
            {
                name: 'Setpoint',
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
                read: true,
                write: true,
            },
            {
                type: 'setpoint'
            });
        await this.checkCreateState(result.states, device.id, channel.id, 'hysteresis',
            {
                name: 'Hysteresis',
                type: 'number',
                role: 'value.temperature',
                unit: '°C',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, 'position',
            {
                name: 'Position',
                type: 'string',
                role: 'indicator.state',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, 'enabled',
            {
                name: 'Enabled',
                type: 'boolean',
                role: 'indicator.plugged',
                read: true,
                write: true,
            },
            {
                type: 'enabled'
            });
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {{id:string, name:string}} device
    * @param {number} buttonsCount
    */
    async createButtons(node, group, device, buttonsCount) {
        const channel = { id: 'buttons', name: 'Buttons', type: 'buttons' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        for (let i = 1; i <= buttonsCount; i++) {
            const iValue = this.hex2string(i);
            await this.checkCreateState(result.states, device.id, channel.id, `${iValue}_status`,
                {
                    name: `${iValue} Status`,
                    type: 'string',
                    role: 'indicator.state',
                    read: true,
                    write: false
                },
                {
                    index: i
                });
            await this.checkCreateState(result.states, device.id, channel.id, `${iValue}_closed`,
                {
                    name: `${iValue} Closed`,
                    type: 'boolean',
                    role: 'button',
                    read: true,
                    write: false,
                },
                {
                    index: i
                });
            await this.checkCreateState(result.states, device.id, channel.id, `${iValue}_enabled`,
                {
                    name: `${iValue} Enabled`,
                    type: 'boolean',
                    role: 'indicator.plugged',
                    read: true,
                    write: false,
                },
                {
                    index: i
                });
        }
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {{id:string, name:string}} device
    * @param {number} ledsCount
    */
    async createLeds(node, group, device, ledsCount) {
        const channel = { id: 'leds', name: 'LEDs', type: 'leds' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        for (let i = 1; i <= ledsCount; i++) {
            const iHex = this.hex2string(i);
            await this.checkCreateState(result.states, device.id, channel.id, `${iHex}_on`,
                {
                    name: `${iHex} On`,
                    type: 'boolean',
                    role: 'switch',
                    read: true,
                    write: true,
                },
                {
                    index: i
                });
            await this.checkCreateState(result.states, device.id, channel.id, `${iHex}_enabled`,
                {
                    name: `${iHex} Enabled`,
                    type: 'boolean',
                    role: 'indicator.plugged',
                    read: true,
                    write: false,
                },
                {
                    index: i
                });
        }
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {{id:string, name:string}} device
    * @param {number} relaysCount
    */
    async createRelays(node, group, device, relaysCount) {
        const channel = { id: 'relays', name: 'Relays', type: 'relays' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        for (let i = 1; i <= relaysCount; i++) {
            const iHex = this.hex2string(i);
            await this.checkCreateState(result.states, device.id, channel.id, `${iHex}_closed`,
                {
                    name: `${iHex} Closed`,
                    type: 'boolean',
                    role: 'switch',
                    read: true,
                    write: true,
                },
                {
                    index: i
                });
        }
    }

    /**
* @param {number} node
* @param {number} group
* @param {{id:string, name:string}} device
*/
    async createRtc(node, group, device) {
        const channel = { id: 'rtc', name: 'Real Time Clock', type: 'rtc' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        await this.checkCreateState(result.states, device.id, channel.id, `date_time_local`,
            {
                name: 'RTC (local)',
                type: 'object',
                role: 'date',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, `date_time`,
            {
                name: 'RTC (ISO UTC)',
                type: 'object',
                role: 'value.datetime',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, `date`,
            {
                name: 'RTC (ISO UTC date)',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, `time`,
            {
                name: 'RTC (ISO UTC time)',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            {
            });
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

    /**
    * @param {number} bcdValue
    */
    bcd2number(bcdValue) {
        const tensDigit = (bcdValue & 0xF0) >> 4;
        const unitDigit = bcdValue & 0x0F;
        return 10 * tensDigit + unitDigit;
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