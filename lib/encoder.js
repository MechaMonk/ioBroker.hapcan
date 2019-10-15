const EventEmitter = require('events');


class Encoder extends EventEmitter {
    constructor() {
        super();

        // TODO: move to configuration
        this.compId1 = 0xEE;
        this.compId2 = 0xEE;
    }

    /**
    * @param {ioBroker.DeviceObject} deviceObject
    * @param {ioBroker.ChannelObject} channelObject
    * @param {ioBroker.StateObject} stateObject
    * @param {ioBroker.State} state
    */
    async writeState(deviceObject, channelObject, stateObject, state) {
        // this.emit('logInfo', JSON.stringify(deviceObject));
        // this.emit('logInfo', JSON.stringify(channelObject));
        // this.emit('logInfo', JSON.stringify(stateObject));
        // this.emit('logInfo', JSON.stringify(state));

        if (await this.checkNodeGroupType(deviceObject, channelObject)) {
            switch (channelObject.native.type) {
                case 'leds': {
                    if (await this.checkNativeIndex(stateObject)) {
                        return this.writeStateLeds(deviceObject.native.node, deviceObject.native.group, stateObject.native.index, state);
                    }
                    break;
                }
                case 'relays': {
                    if (await this.checkNativeIndex(stateObject)) {
                        return this.writeStateRelays(deviceObject.native.node, deviceObject.native.group, stateObject.native.index, state);
                    }
                    break;
                }
                case 'thermostat': {
                    if (await this.checkNativeType(stateObject)) {
                        return this.writeStateThermostat(deviceObject, channelObject, stateObject, state);
                    }
                    break;
                }
                default: {
                    this.emit('logWarn', `State change for channel type „${channelObject.native.type}” not implemented.`);
                }
                // this.emit('logInfo', `state.val = ${state.val}`);
            }
        }
    }

    /**
    * @param {ioBroker.DeviceObject} deviceObject
    * @param {ioBroker.ChannelObject} channelObject
    * @param {ioBroker.StateObject} stateObject
    * @param {ioBroker.State} state
    */
    async writeStateThermostat(deviceObject, channelObject, stateObject, state) {
        switch (stateObject.native.type) {
            case 'setpoint': {
                if (typeof state.val != 'number') {
                    this.emit('logWarn', `State ${stateObject._id} has invalid type of „val”. State change ignored.`);
                    return false;
                }
                return this.writeStateSetpoint(deviceObject.native.node, deviceObject.native.group, state);
            }
            case 'enabled': {
                if (typeof state.val != 'boolean') {
                    this.emit('logWarn', `State ${stateObject._id} has invalid type of „val”. State change ignored.`);
                    return false;
                }
                return this.writeStateEnabled(deviceObject.native.node, deviceObject.native.group, channelObject, state);
            }
            default: {
                this.emit('logInfo', JSON.stringify(state));
                this.emit('logWarn', `State change for state type „${stateObject.native.type}” not implemented.`);
            }
        }
    }

    /**
    * @param {ioBroker.StateObject} stateObject
    */
    async checkNativeIndex(stateObject) {
        if (!('index' in stateObject.native)) {
            this.emit('logWarn', `Object ${stateObject._id} has NOT „native.index”. State change ignored.`);
            return false;
        }
        if (typeof stateObject.native.index != 'number') {
            this.emit('logWarn', `Object ${stateObject._id} has invalid type of „native.index”. State change ignored.`);
            return false;
        }
        return true;
    }

    /**
* @param {ioBroker.StateObject} stateObject
*/
    async checkNativeType(stateObject) {
        if (!('type' in stateObject.native)) {
            this.emit('logWarn', `Object ${stateObject._id} has NOT „native.type”. State change ignored.`);
            return false;
        }
        if (typeof stateObject.native.type != 'string') {
            this.emit('logWarn', `Object ${stateObject._id} has invalid type of „native.type. State change ignored.`);
            return false;
        }
        return true;
    }

    /**
    * @param {ioBroker.DeviceObject} deviceObject
    * @param {ioBroker.ChannelObject} channelObject
    */
    async checkNodeGroupType(deviceObject, channelObject) {
        if (!('node' in deviceObject.native)) {
            this.emit('logWarn', `Device ${deviceObject._id} has NOT „native.node”. State change ignored.`);
            return false;
        }
        if (typeof deviceObject.native.node != 'number') {
            this.emit('logWarn', `Device ${deviceObject._id} has invalid type of „native.node”. State change ignored.`);
            // this.emit('logWarn', typeof deviceObject.native.node);
            return false;
        }
        if (!('group' in deviceObject.native)) {
            this.emit('logWarn', `Device ${deviceObject._id} has NOT „native.group”. State change ignored.`);
            return false;
        }
        if (typeof deviceObject.native.group != 'number') {
            this.emit('logWarn', `Device ${deviceObject._id} has invalid type of „native.group”. State change ignored.`);
            // this.emit('logWarn', typeof deviceObject.native.group);
            return false;
        }

        if (!('type' in channelObject.native)) {
            this.emit('logWarn', `Channel ${channelObject._id} has NOT „native.type”. State change ignored.`);
            return false;
        }

        return true;
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {number} ledIndex 1-based index of LED
    * @param {ioBroker.State} state
    */
    async writeStateLeds(node, group, ledIndex, state) {
        const turnOffLed = 0x00;
        const turnOnLed = 0x01;
        //const toggleLed = 0x02;

        const ledNumber16 = 0x0001 << (ledIndex - 1);
        const ledNumberL = ledNumber16 & 0x00FF;
        const ledNumberH = (ledNumber16 & 0xFF00) >> 8;

        const channel = ledIndex;

        // Send „state change”.
        this.emitFrame(0x10A, node, group, state.val ? turnOnLed : turnOffLed, ledNumberL, ledNumberH, 0xFF, 0xFF, 0xFF);

        // Send „status request” for changed channel only.
        // „channel” field is ignored for firmware < univ_3-1-3-1-rev65535, module sends status of all channels.
        this.emitFrame(0x109, node, group, 0xFF, 0xFF, channel, 0xFF, 0xFF, 0xFF);
    }

    /**
* @param {number} node
* @param {number} group
* @param {number} relayIndex 1-based index of relay
* @param {ioBroker.State} state
*/
    async writeStateRelays(node, group, relayIndex, state) {
        const turnOffRelay = 0x00;
        const turnOnRelay = 0x01;
        //const toggleRelay = 0x02;

        const channel = 0x01 << (relayIndex - 1);
        // TODO: what to do with the timer? how can be used in ioBroker?
        const timer = 0x00;

        this.emitFrame(0x10A, node, group, state.val ? turnOnRelay : turnOffRelay, channel, timer, 0xFF, 0xFF, 0xFF);
    }

    /**
* @param {number} node
* @param {number} group
* @param {ioBroker.State} state
*/
    async writeStateSetpoint(node, group, state) {
        const setSetpoint = 0x03;

        const setpoint16 = state.val / 0.0625;
        const setpointH = ((setpoint16 & 0xFF00) >> 8);
        const setpointL = (setpoint16 & 0x00FF);

        this.emitFrame(0x10A, node, group, setSetpoint, setpointH, setpointL, 0xFF, 0xFF, 0xFF);
    }

    /**
* @param {number} node
* @param {number} group
* @param {ioBroker.State} state
*/
    async writeStateEnabled(node, group, channel, state) {
        const turnOff = 0x06;
        const turnOn = 0x07;

        const moduleThermostat = 0x01;
        // TODO: controller
        //const moduleController = 0x02;
        //const moduleBoth = 0x03;

        this.emitFrame(0x10A, node, group, state.val ? turnOn : turnOff, moduleThermostat, 0xFF, 0xFF, 0xFF, 0xFF);
    }

    /**
      * @param {number} frameId
      * @param {number} node
      * @param {number} group
      * @param {number} instr1
      * @param {number} instr2
      * @param {number} instr3
      * @param {number} instr4
      * @param {number} instr5
      * @param {number} instr6
      */
    async emitFrame(frameId, node, group, instr1, instr2, instr3, instr4, instr5, instr6) {
        const frameIdH = ((frameId & 0x0FF0) >> 4);
        const frameIdL = ((frameId & 0x000F) << 4);
        let checksum = 0;
        const frameData = [0xAA, frameIdH, frameIdL, this.compId1, this.compId2, instr1, instr2, node, group, instr3, instr4, instr5, instr6, checksum, 0xA5];
        for (let i = 1; i < frameData.length - 2; i++) {
            checksum += frameData[i];
        }
        frameData[frameData.length - 2] = checksum;

        const buffer = Buffer.from(frameData);
        this.emit('frame', buffer);
    }
}


module.exports = Encoder;