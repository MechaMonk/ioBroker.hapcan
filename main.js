
const utils = require('@iobroker/adapter-core');
const Creator = require('./lib/creator.js');
const Decoder = require('./lib/decoder.js');
const Encoder = require('./lib/encoder.js');
const Listener = require('./lib/listener.js');
const Reader = require('./lib/reader.js');

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

        this.on('ready', this.onReady.bind(this));
        this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('stateChange', this.onStateChange.bind(this));
        //this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    connect() {
        // HAPCAN:
        this.listener.connect(this.config.gateIPAddress, this.config.gatePort);

        // Testing:
        //this.listener.connect('192.168.7.200', 22222);
    }

    /**
       * Is called when databases are connected and adapter received configuration.
       */
    async onReady() {
        const decoder = new Decoder(this.log);
        const encoder = new Encoder(this.getObjectAsync, this.log, this.config);
        const creator = new Creator(this);
        const reader = new Reader(this, creator);

        const _this = this;
        const reconnect =
            /**
             * @param {boolean} had_error
             */
            function (had_error) {
                if (had_error) {
                    if (_this.config.reconnectInterval > 0) {
                        _this.log.info(`Reconnect scheduled in ${_this.config.reconnectInterval} seconds`);
                        setTimeout(() => {
                            _this.connect();
                        }, _this.config.reconnectInterval * 1000);
                    } else {
                        _this.log.info(`Reconnect disabled (value ${_this.config.reconnectInterval} in adapter configuration)`);
                    }
                }
            };

        /**
         * @param {string} id
         * @param {ioBroker.State | null | undefined} state
         **/
        const onStateChange = function (id, state) {
            if (state) {
                // The state was changed
                if (!state.ack) {
                    _this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
                    encoder.updateState(id, state);
                }
                //this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            } else {
                // The state was deleted
                //this.log.info(`state ${id} deleted`);
            }
        };

        this.listener.on('close', reconnect);
        this.listener.on('chunk', (chunk) => decoder.put(chunk));
        decoder.on('frame', (frameType, flags, node, group, data) => reader.readFrame(frameType, flags, node, group, data));
        encoder.on('frame', (data) => this.listener.write(data));
        creator.on('deviceCreated', (node, group) => setTimeout(() => encoder.nodeDescriptionRequest(node, group), 3000));
        // TODO: creator.on('channelCreated', (node, group) => { });

        this.listener.on('log.info', (message) => this.logInfo(message));
        this.listener.on('log.warn', (message) => this.log.warn(message));
        this.listener.on('log.error', (message) => this.log.error(message));

        this.on('stateChange', onStateChange);

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
    }

    /**
     * @param {string} message
     */
    async logInfo(message) {
        this.log.info(message);
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