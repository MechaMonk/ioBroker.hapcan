const tools = require('./tools.js');
const EventEmitter = require('events');
const AsyncLock = require('./async-lock.js');
//const utils = require('@iobroker/adapter-core');


class Creator extends EventEmitter {
    /**
     * @param {ioBroker.Adapter} adapter
     */
    constructor(adapter) {
        super();
        this.adapter = adapter;
        this._lock = new AsyncLock();
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
    * @param {number} buttonIndex 1-based index of button
    */
    async createButtons(node, group, device, buttonIndex) {
        const channel = { id: 'buttons', name: 'Buttons', type: 'buttons' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        const iValue = tools.hex2string(buttonIndex);
        await this.checkCreateState(result.states, device.id, channel.id, `${iValue}_status`,
            {
                name: `${iValue} Status`,
                type: 'string',
                role: 'indicator.state',
                read: true,
                write: false
            },
            {
                index: buttonIndex
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
                index: buttonIndex
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
                index: buttonIndex
            });
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {{id:string, name:string}} device
    * @param {number} ledIndex 1-based index of LED
    */
    async createLeds(node, group, device, ledIndex) {
        const channel = { id: 'leds', name: 'LEDs', type: 'leds' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        const iHex = tools.hex2string(ledIndex);
        await this.checkCreateState(result.states, device.id, channel.id, `${iHex}_on`,
            {
                name: `${iHex} On`,
                type: 'boolean',
                role: 'switch',
                read: true,
                write: true,
            },
            {
                index: ledIndex
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
                index: ledIndex
            });
    }

    /**
    * @param {number} node
    * @param {number} group
    * @param {{id:string, name:string}} device
    * @param {number} relayIndex 1-based index of relay
    */
    async createRelays(node, group, device, relayIndex) {
        const channel = { id: 'relays', name: 'Relays', type: 'relays' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        const iHex = tools.hex2string(relayIndex);
        await this.checkCreateState(result.states, device.id, channel.id, `${iHex}_closed`,
            {
                name: `${iHex} Closed`,
                type: 'boolean',
                role: 'switch',
                read: true,
                write: true,
            },
            {
                index: relayIndex
            });
    }

    /**
* @param {number} node
* @param {number} group
* @param {{id:string, name:string}} device
*/
    async createRtc(node, group, device) {
        const channel = { id: 'rtc', name: 'Real Time Clock', type: 'rtc' };
        const result = await this.createDeviceChannel(node, group, device, channel);
        await this.checkCreateState(result.states, device.id, channel.id, `date_time1`,
            {
                name: 'Date + time (local)',
                type: 'object',
                role: 'date',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, `date_time2`,
            {
                name: 'Date + time (local)',
                type: 'object',
                role: 'value.datetime',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, `date`,
            {
                name: 'Date (local)',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, `time`,
            {
                name: 'Time (local)',
                type: 'string',
                role: 'value',
                read: true,
                write: false,
            },
            {
            });
        await this.checkCreateState(result.states, device.id, channel.id, `timestamp`,
            {
                name: 'UTC date + time',
                type: 'object',
                role: 'value.datetime',
                read: true,
                write: false,
            },
            {
            });
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

        const create = async function () {
            // _this.log.info('createDeviceChannel[2], isBusy =  ' + _this._lock.isBusy(lockName));
            let found = false;
            let states = [];

            const fullDeviceId = _this.adapter.namespace + '.' + device.id;
            const fullChannelId = fullDeviceId + '.' + channel.id;

            await _this.adapter.getDevicesAsync().then(result => { found = result.some(value => value._id === fullDeviceId); });
            if (found) {
                // this.log.info('Device ' + fullDeviceId + ' found.');
                await _this.adapter.getChannelsOfAsync(device.id).then(result => { found = result.some(value => value._id === fullChannelId); });
            } else {
                //this.log.info('Device ' + fullDeviceId + ' NOT found. Creating.');
                await _this.adapter.createDeviceAsync(device.id, { name: device.name }, { node: node, group: group });
                _this.adapter.log.info('Device ' + fullDeviceId + ' created.');
                _this.emit('deviceCreated', node, group);
            }
            if (!found) {
                //this.log.info('Channel ' + fullChannelId + ' NOT found. Creating.');
                await _this.adapter.createChannelAsync(device.id, channel.id, { name: channel.name }, { type: channel.type });
                _this.adapter.log.info('Channel ' + fullChannelId + ' created.');
                _this.emit('channelCreated', node, group);
            } else {
                // this.log.info('Channel ' + fullChannelId + ' found.');
                await _this.adapter.getStatesOfAsync(device.id, channel.id).then(result => states = result);
            }

            //this.log.info(JSON.stringify(states));
            return { found, states };
        };

        // Read device, create if not exists, read channels, create if not exist: the sequence of operations has to be executed as atom operation.
        // Two frames from the same device = 2 × try to create.
        // So lock access to ioBroker objects database.

        const lockName = 'devices & channels';

        // this.log.info('createDeviceChannel[1], isBusy =  ' + this._lock.isBusy(lockName));
        return this._lock.acquire(lockName, create, {});
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
        const fullStateId = `${this.adapter.namespace}.${deviceId}.${channelId}.${stateId}`;
        if (!states.some(value => value._id === fullStateId)) {
            return this.adapter.createStateAsync(deviceId, channelId, stateId, common, native);
        }
    }

    /**
     * @param {string} deviceId
     * @param {string} description
     * @param {boolean} append
     */
    async updateDeviceName(deviceId, description, append) {
        const _this = this;

        const update =
            /**
             * @param { ioBroker.DeviceObject[] } result
             */
            async function (result) {
                const fullDeviceId = `${_this.adapter.namespace}.${deviceId}`;
                const device = result.find(value => value._id === fullDeviceId);
                if (device === undefined) {
                    _this.adapter.log.warn('Device ' + fullDeviceId + ' NOT found. Device name NOT set.');
                } else {
                    // this.adapter.log.info('Device ' + fullDeviceId + ' found.');
                    if (append) {
                        _this.adapter.log.info(`Appending name „${description}” to „${device.common.name}”`);
                        device.common.name += description;
                    } else {
                        _this.adapter.log.info(`Setting name „${description}”, current = „${device.common.name}”`);
                        device.common.name = description;
                    }
                    await _this.adapter.setObjectAsync(fullDeviceId, device);
                }
            };

        const read = async function () {
            await _this.adapter.getDevicesAsync().then(update);
        };

        const lockName = 'devices';
        return this._lock.acquire(lockName, read, {});
    }
}


module.exports = Creator;