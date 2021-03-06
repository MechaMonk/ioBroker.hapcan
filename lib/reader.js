const tools = require('./tools.js');
const windows1250 = require('./windows-1250.js');
// eslint-disable-next-line no-unused-vars
const Creator = require('./creator.js');
const EventEmitter = require('events');

const rgbStatesNames = ['red', 'green', 'blue', 'master'];

class Reader extends EventEmitter {

    /**
     * @param {ioBroker.Adapter} adapter
     * @param {Creator} creator
     */
    constructor(adapter, creator) {
        super();

        this.adapter = adapter;
        this.creator = creator;

        /** @type {string[]} */
        this.descriptions = [];
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
                setImmediate(() => this.read300frame(flags, node, group, data));
                break;
            }
            case 0x301: { // Button
                setImmediate(() => this.read301frame(flags, node, group, data));
                break;
            }
            case 0x302: { // Relay
                setImmediate(() => this.read302frame(flags, node, group, data));
                break;
            }
            case 0x304: { // Thermometer, thermostat
                setImmediate(() => this.read304frame(flags, node, group, data));
                break;
            }
            case 0x308: { // RGB LED Controller
                setImmediate(() => this.read308frame(flags, node, group, data));
                break;
            }
            case 0x309: { // Open Collector
                setImmediate(() => this.read309frame(flags, node, group, data));
                break;
            }
            case 0x109: { // Status request frame
                // TODO: missing implementation of Status request frame
                this.adapter.log.warn('[Reader] Status request frame not implemented');
                break;
            }
            case 0x10E: { // Node description request frame
                setImmediate(() => this.read10Eframe(flags, node, group, data));
                break;
            }
            case 0x113: { // Uptime request frame
                // TODO: missing implementation of Uptime request frame
                this.adapter.log.warn('[Reader] Uptime request frame not implemented');
                break;
            }
            case 0x115: { // Health check frame
                // TODO: missing implementation of Health check frame
                this.adapter.log.warn('[Reader] Health check frame not implemented');
                break;
            }
            default: {
                const frameTypeValue = tools.hex2string2(frameType);
                this.adapter.log.warn('[Reader] Frame type ' + frameTypeValue + ' not implemented.');
            }
        }
    }

    /**
 * Node description
 * @param {number} flags
 * @param {number} node
 * @param {number} group
 * @param {number[]} data
 */
    async read10Eframe(flags, node, group, data) {
        // this.adapter.log.info('[Reader] [read10Eframe]');
        if (flags != 0x01) {
            this.adapter.log.error('Invalid 10E frame. Expected flags=01.');
            return;
        }
        const deviceId = this.defaultDeviceId(node, group);

        const buffer = Buffer.from(data.filter((value) => value != 0));
        const description = windows1250.decode(buffer.toString('binary'));
        // this.adapter.log.info(`Device ${deviceId} description = ???${description}???`);

        const _this = this;
        const removeDeviceId =
            /**
             * @param {string} deviceId
             */
            function (deviceId) {
                const index = _this.descriptions.indexOf(deviceId);
                if (index >= 0) {
                    // _this.adapter.log.info(`[Reader] [read10Eframe] remove ${deviceId}`);
                    _this.descriptions.splice(index, 1);
                    return true;
                }
                return false;
            };

        const append = removeDeviceId(deviceId);
        if (!append) {
            // this.adapter.log.info(`[Reader] [read10Eframe] push ${deviceId}`);
            this.descriptions.push(deviceId);
            // Wait for 2nd part of name for 5 seconds
            setTimeout(() => { removeDeviceId(deviceId); }, 5000);
        }

        this.creator.updateDeviceName(deviceId, description, append);
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
            this.adapter.log.error('Invalid 300 frame. Expected D0=FF.');
            return;
        }
        const deviceId = this.defaultDeviceId(node, group);
        const deviceName = this.defaultDeviceName(node, group);

        // 
        const YEAR = tools.bcd2number(data[1]);
        const MONTH = tools.bcd2number(data[2]);
        const DAY = tools.bcd2number(data[3]);
        //const DAY_OF_WEEK = tools.bcd2number(data[4]);
        const HOUR = tools.bcd2number(data[5]);
        const MINUTE = tools.bcd2number(data[6]);
        const SECOND = tools.bcd2number(data[7]);

        const dateTimeUTC = new Date(YEAR + 2000, MONTH - 1, DAY, HOUR, MINUTE, SECOND);
        const dateTimeLocalIso = tools.dateToLocalISO(dateTimeUTC);
        // this.adapter.log.info(`dateTime = ${dateTime}`);
        // this.adapter.log.info(`dateTimeIso = ${dateTimeIso}`);

        await this.creator.createRtc(node, group, { id: deviceId, name: deviceName });
        await this.adapter.setStateAsync(`${deviceId}.rtc.date_time1`, { val: dateTimeLocalIso, ack: true });
        await this.adapter.setStateAsync(`${deviceId}.rtc.date_time2`, { val: dateTimeLocalIso, ack: true });
        await this.adapter.setStateAsync(`${deviceId}.rtc.date`, { val: dateTimeLocalIso.slice(0, 10), ack: true });
        await this.adapter.setStateAsync(`${deviceId}.rtc.time`, { val: dateTimeLocalIso.slice(11, 19), ack: true });
        await this.adapter.setStateAsync(`${deviceId}.rtc.timestamp`, { val: dateTimeUTC, ack: true });
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
            this.adapter.log.error('Invalid 301 frame. Expected D0=FF & D1=FF.');
            return;
        }
        const deviceId = this.defaultDeviceId(node, group);
        const deviceName = this.defaultDeviceName(node, group);

        // input channel: 0x01 (button 1) ??? 0x0E (button 14)
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

        const channel = tools.hex2string(CHANNEL);
        const enabled = (BUTTON != 0x01);
        const closed = (BUTTON == 0xFF || BUTTON == 0xFE || BUTTON == 0xFD);
        const status = tools.hex2string2(BUTTON); // TODO: enum

        await this.creator.createButtons(node, group, { id: deviceId, name: deviceName }, CHANNEL);
        await this.adapter.setStateAsync(`${deviceId}.buttons.${channel}_enabled`, { val: enabled, ack: true });
        await this.adapter.setStateAsync(`${deviceId}.buttons.${channel}_closed`, { val: closed, ack: true });
        await this.adapter.setStateAsync(`${deviceId}.buttons.${channel}_status`, { val: status, ack: true });

        const ledEnabled = (LED != 0x01);
        const ledOn = (LED == 0xFF);

        await this.creator.createLeds(node, group, { id: deviceId, name: deviceName }, CHANNEL);
        await this.adapter.setStateAsync(`${deviceId}.leds.${channel}_enabled`, { val: ledEnabled, ack: true });
        await this.adapter.setStateAsync(`${deviceId}.leds.${channel}_on`, { val: ledOn, ack: true });
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
            this.adapter.log.error('Invalid 302 frame. Expected D0=FF & D1=FF.');
            return;
        }
        const deviceId = this.defaultDeviceId(node, group);
        const deviceName = this.defaultDeviceName(node, group);

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

        const channel = tools.hex2string(CHANNEL);
        const closed = (STATUS == 0xFF);

        await this.creator.createRelays(node, group, { id: deviceId, name: deviceName }, CHANNEL);
        await this.adapter.setStateAsync(`${deviceId}.relays.${channel}_closed`, { val: closed, ack: true });
    }

    /**
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    async read304frame(flags, node, group, data) {
        if (data[0] != 0xFF || data[1] != 0xFF) {
            this.adapter.log.error('Invalid 304 frame. Expected D0=FF & D1=FF.');
            return;
        }
        // const thermometerChannelId = 'thermometer';
        // const thermostatChannelId = 'thermostat';
        const deviceId = this.defaultDeviceId(node, group);
        const deviceName = this.defaultDeviceName(node, group);

        if (data[2] == 0x11) {
            // Current temperature frame

            // most significant byte of measured temperature 0xFC90 ??? 0x07D0 (-55??C ??? +125??C), resolution 0.0625??C
            const TEMPMSB = data[3];
            // least significant byte of measured temperature
            const TEMPLSB = data[4];
            // most significant byte of thermostat value 0xFC90 ??? 0x07D0 (-55??C ??? +125??C), resolution 0.0625??C
            const SETPOMSB = data[5];
            // least significant byte of thermostat value
            const SETPOLSB = data[6];
            // switching hysteresis 0x00 ??? 0xFF (0.0625??C ??? 16.0000??C), resolution 0.0625??C
            const HYSTER = data[7];

            const temperature = Number(Number(((TEMPMSB * 256) + TEMPLSB) * 0.0625).toFixed(1));
            const setpoint = Number(Number(((SETPOMSB * 256) + SETPOLSB) * 0.0625).toFixed(2));
            const hysteresis = Number(Number(HYSTER * 0.0625).toFixed(4));

            await this.creator.createThermometer(node, group, { id: deviceId, name: deviceName });
            await this.creator.createThermostat(node, group, { id: deviceId, name: deviceName });
            await this.adapter.setStateAsync(`${deviceId}.thermometer.temperature`, { val: temperature, ack: true });
            await this.adapter.setStateAsync(`${deviceId}.thermostat.setpoint`, { val: setpoint, ack: true });
            await this.adapter.setStateAsync(`${deviceId}.thermostat.hysteresis`, { val: hysteresis, ack: true });
        } else if (data[2] == 0x12) {
            // Thermostat frame

            // current thermostat status (0x00: temperature below setpoint, 0xFF: temperature above setpoint, 0x80: power up value)
            const THERMPOSITION = data[3];
            // thermostat state (0x00: turned off, 0xFF: turned on)
            const THERMSTATE = data[7];

            const position = (THERMPOSITION == 0x00) ? 'BELOW' : (THERMPOSITION == 0xFF) ? 'ABOVE' : (THERMPOSITION == 0x80) ? 'POWERUP' : '?';
            const enabled = (THERMSTATE == 0xFF);

            await this.creator.createThermostat(node, group, { id: deviceId, name: deviceName });
            await this.adapter.setStateAsync(`${deviceId}.thermostat.position`, { val: position, ack: true });
            await this.adapter.setStateAsync(`${deviceId}.thermostat.enabled`, { val: enabled, ack: true });
        } else if (data[2] == 0x13) {
            // Controller frame
            // TODO: missing implementation of Controller frame
            this.adapter.log.warn('[Reader] Controller frame not implemented');
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

            await this.creator.createThermometer(node, group, { id: deviceId, name: deviceName });
            await this.adapter.setStateAsync(`${deviceId}.thermometer.error_code`, { val: errorCode, ack: true });
            await this.adapter.setStateAsync(`${deviceId}.thermometer.error_message`, { val: errorMessage, ack: true });
        } else {
            const d2Value = tools.hex2string2(data[2]);
            this.adapter.log.warn('[Reader] Unknown 304 frame sub-type. D2=' + d2Value + '.');
        }
    }

    /**
     * RGB LED Controller
 * @param {number} flags
 * @param {number} node
 * @param {number} group
 * @param {number[]} data
 */
    async read308frame(flags, node, group, data) {
        if (data[0] != 0xFF || data[1] != 0xFF) {
            this.adapter.log.error('Invalid 308 frame. Expected D0=FF & D1=FF.');
            return;
        }
        const deviceId = this.defaultDeviceId(node, group);
        const deviceName = this.defaultDeviceName(node, group);

        // this.adapter.log.info(`[Reader] 308: ${Buffer.from(data).toString('hex').toUpperCase()}`);

        // Output channel (0x01 ??? red, 0x02 ??? green, 0x03 ??? blue, 0x04 - MASTER)
        const CHANNEL = data[2];
        // Current status of output 0x00 ??? 0xFF
        const STATUS = data[3];
        // Current status of all channels (0x00 ??? if all channels are turned off, 0xFF ??? if master channel and any colour channel is on).
        // This byte can be used to toggle relay which turns on the power supply for the LED. This byte is only available in MASTER channel frame.
        const RELAY = data[4];
        // Instruction that is waiting for execution, or 0xFF if none instruction
        // const INSTR1 = data[5];
        // Second byte of instruction that is waiting for execution, or 0xFF
        // const INSTR2 = data[6];
        // delay value of waiting instruction, or 0x00 if none waiting
        // const TIMER = data[7];

        if (CHANNEL < 1 || CHANNEL > 4) {
            this.adapter.log.error(`Invalid 308 frame. Channel ???${CHANNEL}??? is out of range.`);
            return;
        }
        const channelName = rgbStatesNames[CHANNEL - 1];
        const anyChannelOn = (RELAY !== 0x00);

        await this.creator.createRgb(node, group, { id: deviceId, name: deviceName }, { index: CHANNEL, name: channelName });
        await this.adapter.setStateAsync(`${deviceId}.rgb.${channelName}`, { val: STATUS, ack: true });
        await this.adapter.setStateAsync(`${deviceId}.rgb.relay`, { val: anyChannelOn, ack: true });
    }

    /**
     * Open Collector
     * @param {number} flags
     * @param {number} node
     * @param {number} group
     * @param {number[]} data
     */
    async read309frame(flags, node, group, data) {
        if (data[0] != 0xFF || data[1] != 0xFF || data[4] != 0xFF || data[6] != 0xFF) {
            this.adapter.log.error('Invalid 309 frame. Expected D0=FF & D1=FF & D4=FF & D6=FF & .');
            return;
        }
        const deviceId = this.defaultDeviceId(node, group);
        const deviceName = this.defaultDeviceName(node, group);

        // output channel
        const CHANNEL = data[2];
        // actual status of outputs:
        // 0x00 output off
        // 0xFF output on
        const STATUS = data[3];
        // instruction that is waiting for execution, or 0xFF if none instruction
        // const INSTR1 = data[5];
        // delay value of waiting instruction, or 0x00 if none waiting
        // const TIMER = data[7];

        const channel = tools.hex2string(CHANNEL);
        const closed = (STATUS == 0xFF);

        await this.creator.createOCs(node, group, { id: deviceId, name: deviceName }, CHANNEL);
        await this.adapter.setStateAsync(`${deviceId}.oc.${channel}_on`, { val: closed, ack: true });
    }

    /**
     * @param {number} node
     * @param {number} group
     */
    defaultDeviceName(node, group) {
        const _node = node.toString(10);
        const _group = group.toString(10);
        return `(${_node}, ${_group})`;
    }

    /**
 * @param {number} node
 * @param {number} group
 */
    defaultDeviceId(node, group) {
        const _node = tools.hex2string2(node);
        const _group = tools.hex2string2(group);
        return `${_node}_${_group}`;
    }
}


module.exports = Reader;