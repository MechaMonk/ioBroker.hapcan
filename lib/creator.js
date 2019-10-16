const EventEmitter = require('events');
const AsyncLock = require('./async-lock.js');
//const utils = require('@iobroker/adapter-core');


class Creator extends EventEmitter {
    /**
     * @param {ioBroker.Adapter} adapter
     */
    constructor(adapter) {
        super();
        this._adapter = adapter;
        this._lock = new AsyncLock();
    }

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

        const fullDeviceId = this._adapter.namespace + '.' + device.id;
        const fullChannelId = fullDeviceId + '.' + channel.id;

        await this._adapter.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
        if (found) {
            // this.log.info('Device ' + fullDeviceId + ' found.');
            await this._adapter.getChannelsOfAsync(device.id).then(result => { found = result.some(value => value._id === fullChannelId); });
        } else {
            //this.log.info('Device ' + fullDeviceId + ' NOT found. Creating.');
            await this._adapter.createDeviceAsync(device.id, { name: device.name }, { node: node, group: group });
            this._adapter.log.info('Device ' + fullDeviceId + ' created.');
        }
        if (!found) {
            //this.log.info('Channel ' + fullChannelId + ' NOT found. Creating.');
            await this._adapter.createChannelAsync(device.id, channel.id, { name: channel.name }, { type: channel.type });
            this._adapter.log.info('Channel ' + fullChannelId + ' created.');
        } else {
            // this.log.info('Channel ' + fullChannelId + ' found.');
            await this._adapter.getStatesOfAsync(device.id, channel.id).then(result => states = result);
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

        // Read device, create if not exists, read channels, create if not exist: the sequence of operations has to be executed as atom operation.
        // Two frames from the same device = 2 × try to create.
        // So lock access to ioBroker objects database.

        const lockName = 'devices & channels';

        // this.log.info('createDeviceChannel[1], isBusy =  ' + this._lock.isBusy(lockName));
        return this._lock.acquire(lockName, function () {
            // _this.log.info('createDeviceChannel[2], isBusy =  ' + _this._lock.isBusy(lockName));
            return _this.createDeviceChannel2(node, group, device, channel);
        }, {});
    }
}


module.exports = Creator;