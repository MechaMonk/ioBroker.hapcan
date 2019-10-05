const EventEmitter = require('events');
const net = require('net');

class Listener extends EventEmitter {

    constructor() {
        super();

        this.socket = new net.Socket();

        this.socket.on('data', (data) => this.emit('chunk', data));
        this.socket.on('error', this.onError);
        this.socket.on('close', this.onClose);
    }

    /**
     * @param {string} ip
     * @param {number} port
     */
    connect(ip, port) {
        this.socket.connect(port, ip, this.onConnected);
    }

    onConnected() {
        //this.emit('logInfo', '[Listener]: connected to ' + this.socket.remoteAddress + ':' + this.socket.remotePort + '.');
        this.emit('logInfo', '[Listener]: connected');
    }

    unload() {
        this.socket.destroy();
    }

    /**
     * @param {string} error
     */
    onError(error) {
        this.emit('logError', '[Listener] [onError]: ' + error);
    }

    onClose() {
        this.emit('logInfo', '[Listener] [onClose]');
        // TODO: reconnect?
    }
}

module.exports = Listener;