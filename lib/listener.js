const EventEmitter = require('events');
const net = require('net');


class Listener extends EventEmitter {

    constructor() {
        super();

        this.socket = new net.Socket();

        this.socket.on('data', (data) => this.emit('chunk', data));
        this.socket.on('error', this.onError.bind(this));
        this.socket.on('close', this.onClose.bind(this));
        this.socket.on('connect', this.onConnect.bind(this));
        this.socket.on('timeout', this.onTimeout.bind(this));
    }

    /**
     * @param {string} ip
     * @param {number} port
     */
    connect(ip, port) {
        this.emit('log.info', `[Listener]: connecting to ${ip}:${port}...`);
        this.socket.connect(port, ip);
    }

    onConnect() {
        this.emit('log.info', '[Listener]: connected');
    }

    onTimeout() {
        this.emit('log.info', '[Listener]: [onTimeout]');
    }

    /**
 * @param {string} error
 */
    onError(error) {
        this.emit('log.error', '[Listener] [onError]: ' + error);
    }

    /**
     * @param {boolean} had_error
     */
    onClose(had_error) {
        // this.emit('log.info', `[Listener] [onClose], had_error = ${had_error}`);
        this.emit('close', had_error);
    }

    /**
     * @param {Buffer} data
     */
    write(data) {
        this.socket.write(data);
    }

    /**
     * @param {Buffer} data1
     * @param {Buffer} data2
     */
    write2(data1, data2) {
        this.socket.write(data1);
        this.socket.write(data2);
    }

    unload() {
        // this.emit('log.info', '[Listener]: [unload]');
        this.socket.destroy();
    }
}


module.exports = Listener;