const EventEmitter = require('events');


class Encoder extends EventEmitter {
    /**
     * @param {(id: string, options?: unknown) => Promise<ioBroker.StateObject | ioBroker.ChannelObject | ioBroker.DeviceObject | ioBroker.OtherObject | null | undefined>} getObjectAsync
     * @param {ioBroker.Logger} log
     * @param {ioBroker.AdapterConfig} config
     */
    constructor(getObjectAsync, log, config) {
        super();

        this.getObjectAsync = getObjectAsync;
        this.log = log;
        this.config = config;
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

                    await this.writeState(deviceObject, channelObject, stateObject, state);
                });
            });
        });
    }

    /**
    * @param {ioBroker.DeviceObject} deviceObject
    * @param {ioBroker.ChannelObject} channelObject
    * @param {ioBroker.StateObject} stateObject
    * @param {ioBroker.State} state
    */
    async writeState(deviceObject, channelObject, stateObject, state) {
        // this.log.info(JSON.stringify(deviceObject));
        // this.log.info(JSON.stringify(channelObject));
        // this.log.info(JSON.stringify(stateObject));
        // this.log.info(JSON.stringify(state));

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
                    this.log.warn(`State change for channel type „${channelObject.native.type}” not implemented.`);
                }
                // this.log.info(`state.val = ${state.val}`);
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
                    this.log.warn(`State ${stateObject._id} has invalid type of „val”. State change ignored.`);
                    return false;
                }
                return this.writeStateSetpoint(deviceObject.native.node, deviceObject.native.group, state);
            }
            case 'enabled': {
                if (typeof state.val != 'boolean') {
                    this.log.warn(`State ${stateObject._id} has invalid type of „val”. State change ignored.`);
                    return false;
                }
                return this.writeStateEnabled(deviceObject.native.node, deviceObject.native.group, channelObject, state);
            }
            default: {
                this.log.info(JSON.stringify(state));
                this.log.warn(`State change for state type „${stateObject.native.type}” not implemented.`);
            }
        }
    }

    /**
    * @param {ioBroker.StateObject} stateObject
    */
    async checkNativeIndex(stateObject) {
        if (!('index' in stateObject.native)) {
            this.log.warn(`Object ${stateObject._id} has NOT „native.index”. State change ignored.`);
            return false;
        }
        if (typeof stateObject.native.index != 'number') {
            this.log.warn(`Object ${stateObject._id} has invalid type of „native.index”. State change ignored.`);
            return false;
        }
        return true;
    }

    /**
* @param {ioBroker.StateObject} stateObject
*/
    async checkNativeType(stateObject) {
        if (!('type' in stateObject.native)) {
            this.log.warn(`Object ${stateObject._id} has NOT „native.type”. State change ignored.`);
            return false;
        }
        if (typeof stateObject.native.type != 'string') {
            this.log.warn(`Object ${stateObject._id} has invalid type of „native.type. State change ignored.`);
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
            this.log.warn(`Device ${deviceObject._id} has NOT „native.node”. State change ignored.`);
            return false;
        }
        if (typeof deviceObject.native.node != 'number') {
            this.log.warn(`Device ${deviceObject._id} has invalid type of „native.node”. State change ignored.`);
            // this.log.warn( typeof deviceObject.native.node);
            return false;
        }
        if (!('group' in deviceObject.native)) {
            this.log.warn(`Device ${deviceObject._id} has NOT „native.group”. State change ignored.`);
            return false;
        }
        if (typeof deviceObject.native.group != 'number') {
            this.log.warn(`Device ${deviceObject._id} has invalid type of „native.group”. State change ignored.`);
            // this.log.warn( typeof deviceObject.native.group);
            return false;
        }

        if (!('type' in channelObject.native)) {
            this.log.warn(`Channel ${channelObject._id} has NOT „native.type”. State change ignored.`);
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
        // this.log.info(`[Encoder] [writeStateLeds]`);
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
* @param {number} node
* @param {number} group
*/
    async nodeDescriptionRequest(node, group) {
        this.log.info(`Sending description request to node ${node.toString(16)}_${group.toString(16)}`);
        this.emitFrame(0x10E, node, group, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF);
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
        // this.log.info(`[Encoder] [emitFrame]`);
        if (this.config.compId1 < 0 || this.config.compId1 > 255) {
            this.log.warn(`Invalid compId1, value ${this.config.compId1} is out of range`);
            return;
        }
        if (this.config.compId2 < 0 || this.config.compId2 > 255) {
            this.log.warn(`Invalid compId2, value ${this.config.compId2} is out of range`);
            return;
        }
        const frameIdH = ((frameId & 0x0FF0) >> 4);
        const frameIdL = ((frameId & 0x000F) << 4);
        const compId1 = (this.config.compId1 & 0xFF);
        const compId2 = (this.config.compId2 & 0xFF);
        let checksum = 0;
        const frameData = [0xAA, frameIdH, frameIdL, compId1, compId2, instr1, instr2, node, group, instr3, instr4, instr5, instr6, checksum, 0xA5];
        for (let i = 1; i < frameData.length - 2; i++) {
            checksum += frameData[i];
        }
        frameData[frameData.length - 2] = checksum;

        const buffer = Buffer.from(frameData);
        this.emit('frame', buffer);
        // this.log.info(`[Encoder] [emitFrame] event „frame” emited: ${buffer.toString('hex').toUpperCase()}`);
    }
}


module.exports = Encoder;