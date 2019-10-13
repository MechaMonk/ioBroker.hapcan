const EventEmitter = require('events');


class Decoder extends EventEmitter {
    constructor() {
        super();
        this.buffer = '';
    }

    /**
     * @param {Buffer} chunk
     */
    async put(chunk) {
        const hexChunk = chunk.toString('hex').toUpperCase();
        //console.log('[Decoder] [put] chunk = ' + hexChunk);
        this.buffer += hexChunk;


        // Split frames
        let index = this.buffer.indexOf('A5AA');
        while (index > 0) {
            const dataFrame = this.buffer.substr(0, index + 2);
            await this.parseFrame(dataFrame);
            //counter++;
            this.buffer = this.buffer.substr(index + 2);
            index = this.buffer.indexOf('A5AA');
        }

        // Last (or the only) frame.
        // Frame length = 30, stop marker = 'A5'.
        if (this.buffer.length == 30) {
            if (this.buffer.substr(28, 2) == 'A5') {
                await this.parseFrame(this.buffer);
                //counter++;
                this.buffer = '';
            }
        }
    }

    /**
    * @param {string} hexData
    */
    async parseFrame(hexData) {
        //this.emit('logInfo', '[Decoder] [parseFrame] frameData = ' + hexData);

        // frame: [start AA], 12 bytes, [chksum], [stop A5]
        if (hexData.length == 30) {
            if (hexData.substr(0, 2) != 'AA' || hexData.substr(28, 2) != 'A5') {
                this.emit('logWarn', '[Decoder] [parseFrame] Invalid frame: ' + hexData);
                return;
            }
        } else if (hexData.length == 26) {
            if (hexData.substr(0, 2) != 'AA' || hexData.substr(24, 2) != 'A5') {
                this.emit('logWarn', '[Decoder] [parseFrame] Invalid frame: ' + hexData);
                return;
            }
            // TODO: parse special frame
            this.emit('logWarn', '[Decoder] [parseFrame] Special frame ignored: ' + hexData);
            return;
        }

        // FrameType: 12 bits
        const frameType = parseInt(hexData.substr(2, 3), 16);
        // Flags: 4 bits
        const flags = parseInt(hexData.substr(5, 1), 16);
        const node = parseInt(hexData.substr(6, 2), 16);
        const group = parseInt(hexData.substr(8, 2), 16);
        const data = new Array(8);
        let i;
        for (i = 0; i < 8; i++) {
            data[i] = parseInt(hexData.substr(10 + 2 * i, 2), 16);
        }
        const chksum = parseInt(hexData.substr(26, 2), 16);

        let checksumCounted = 0;
        for (i = 1; i <= 12; i++) {
            checksumCounted += parseInt(hexData.substr(i * 2, 2), 16);
        }
        checksumCounted &= 0xFF;
        if (checksumCounted != chksum) {
            this.emit('logWarn', '[Decoder] [parseFrame] Invalid frame, checksum validation failed. Expected: ' + chksum.toString(16).toUpperCase().padStart(2, '0') + ', actual: ' + checksumCounted.toString(16).toUpperCase().padStart(2, '0'));
            return;
        }

        // let msg = '[HAPCAN]';
        // msg += ' | frameType=' + frameType.toString(16).toUpperCase().padStart(3, '0');
        // msg += ' | flags=' + flags.toString(16).toUpperCase().padStart(1, '0');
        // msg += ' | node=' + node.toString(16).toUpperCase().padStart(2, '0');
        // msg += ' | group=' + group.toString(16).toUpperCase().padStart(2, '0');
        // msg += ' | data=';
        // for (i = 0; i < 8; i++) {
        //     if (i > 0) {
        //         msg += ':';
        //     }
        //     msg += data[i].toString(16).toUpperCase().padStart(2, '0');
        // }
        // msg += ' |';
        // this.emit('logInfo', msg);

        this.emit('frame', frameType, flags, node, group, data);

        /*
        // Testing
        const digit1 = parseInt(frameData.substr(18, 2), 16);
        const digit2 = parseInt(frameData.substr(16, 2), 16);
        const digit3 = parseInt(frameData.substr(14, 2), 16);
        const digit4 = parseInt(frameData.substr(12, 2), 16);
        const frameCounter = digit1 + 10 * digit2 + 100 * digit3 + 1000 * digit4;
        if (this.counter != frameCounter) {
            throw 'counter = ' + this.counter + ', frameCounter = ' + frameCounter;
        }
        this.counter++;
    
        // Long run (max 10000000)
        for (let i = 0; i < 1000000; i++) { }
        */
    }
}


module.exports = Decoder;