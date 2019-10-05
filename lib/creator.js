const EventEmitter = require('events');

class Creator extends EventEmitter {
    constructor() {
        super();
        this.counter = 0;
    }


}

module.exports = Creator;