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

        if (!('node' in deviceObject.native)) {
            this.emit('logWarn', `Device ${deviceObject._id} has NOT „native.node”. State change ignored.`);
            return;
        }
        if (typeof deviceObject.native.node != 'number') {
            this.emit('logWarn', `Device ${deviceObject._id} has invalid type of „native.node”. State change ignored.`);
            // this.emit('logWarn', typeof deviceObject.native.node);
            return;
        }
        if (!('group' in deviceObject.native)) {
            this.emit('logWarn', `Device ${deviceObject._id} has NOT „native.group”. State change ignored.`);
            return;
        }
        if (typeof deviceObject.native.group != 'number') {
            this.emit('logWarn', `Device ${deviceObject._id} has invalid type of „native.group”. State change ignored.`);
            // this.emit('logWarn', typeof deviceObject.native.group);
            return;
        }

        if (!('type' in channelObject.native)) {
            this.emit('logWarn', `Channel ${channelObject._id} has NOT „native.type”. State change ignored.`);
            return;
        }

        if (channelObject.native.type == 'leds') {
            if (!('index' in stateObject.native)) {
                this.emit('logWarn', `Object ${stateObject._id} has NOT „native.index”. State change ignored.`);
                return;
            }
            if (typeof stateObject.native.index != 'number') {
                this.emit('logWarn', `Object ${stateObject._id} has invalid type of „native.index”. State change ignored.`);
                return;
            }
            await this.writeStateLeds(deviceObject.native.node, deviceObject.native.group, stateObject.native.index, state);
        } else if (channelObject.native.type == 'relays') {
            if (!('index' in stateObject.native)) {
                this.emit('logWarn', `Object ${stateObject._id} has NOT „native.index”. State change ignored.`);
                return;
            }
            if (typeof stateObject.native.index != 'number') {
                this.emit('logWarn', `Object ${stateObject._id} has invalid type of „native.index”. State change ignored.`);
                return;
            }
            await this.writeStateRelays(deviceObject.native.node, deviceObject.native.group, stateObject.native.index, state);
        } else {
            this.emit('logWarn', `State change for channel type „${channelObject.native.type}” not implemented.`);
        }
        // this.emit('logInfo', `state.val = ${state.val}`);
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

        const instr1 = state.val ? turnOnLed : turnOffLed;
        const instr2 = ledNumberL;
        const instr3 = ledNumberH;
        const instr4 = 0xFF;
        const instr5 = 0xFF;
        const instr6 = 0xFF;

        const channel = ledIndex;

        // Send „state change”.
        let checksum = 0;
        const frameData = [0xAA, 0x10, 0xA0, this.compId1, this.compId2, instr1, instr2, node, group, instr3, instr4, instr5, instr6, checksum, 0xA5];
        for (let i = 1; i < frameData.length - 2; i++) {
            checksum += frameData[i];
        }
        frameData[frameData.length - 2] = checksum;

        const buffer1 = Buffer.from(frameData);
        this.emit('frame', buffer1);

        // Send „status request” for changed channel only.
        // „channel” field is ignored for firmware < univ_3-1-3-1-rev65535, module sends status of all channels.
        checksum = 0;
        const statusRequest = [0xAA, 0x10, 0x90, this.compId1, this.compId2, 0xFF, 0xFF, node, group, channel, 0xFF, 0xFF, 0xFF, checksum, 0xA5];
        for (let i = 1; i < statusRequest.length - 2; i++) {
            checksum += statusRequest[i];
        }
        statusRequest[statusRequest.length - 2] = checksum;
        const buffer2 = Buffer.from(statusRequest);
        this.emit('frame', buffer2);
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

        const instr1 = state.val ? turnOnRelay : turnOffRelay;
        const instr2 = channel;
        const instr3 = timer;
        const instr4 = 0xFF;
        const instr5 = 0xFF;
        const instr6 = 0xFF;

        // Send „state change”.
        let checksum = 0;
        const frameData = [0xAA, 0x10, 0xA0, this.compId1, this.compId2, instr1, instr2, node, group, instr3, instr4, instr5, instr6, checksum, 0xA5];
        for (let i = 1; i < frameData.length - 2; i++) {
            checksum += frameData[i];
        }
        frameData[frameData.length - 2] = checksum;

        const buffer = Buffer.from(frameData);
        this.emit('frame', buffer);

        // When state changes, module sends status automatically.
    }
}


module.exports = Encoder;