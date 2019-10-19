'use strict';

class AsyncLock {
    /**
     * @param {{ timeout?: any; maxPending?: any; } | undefined} [opts]
     */
    constructor(opts) {
        opts = opts || {};

        // format: {key : [fn, fn]}
        // queues[key] = null indicates no job running for key
        this.queues = {};

        // domain of current running func {key : fn}
        // this.domains = {};

        this.timeout = opts.timeout || AsyncLock.DEFAULT_TIMEOUT;
        this.maxPending = opts.maxPending || AsyncLock.DEFAULT_MAX_PENDING;
    }

    /**
 * Acquire Locks
 *
 * @param {String} key     resource key or keys to lock
 * @param {function} fn     async function
 * @param {Object} opts     options
 */
    acquire(key, fn, opts) {
        if (typeof (fn) !== 'function') {
            throw new Error('You must pass a function to execute');
        }

        // faux-deferred promise using new Promise() (as Promise.defer is deprecated)
        let deferredResolve = null;
        let deferredReject = null;
        let deferred = null;

        // will return a promise
        deferred = new Promise(function (resolve, reject) {
            deferredResolve = resolve;
            deferredReject = reject;
        });

        opts = opts || {};

        let resolved = false;
        let timer = null;
        const self = this;

        const done =
            /**
             * @param {boolean} locked
             * @param {Error | undefined} [err]
             * @param {undefined} [ret]
             */
            function (locked, err, ret) {
                if (locked) {
                    if (self.queues[key].length === 0) {
                        delete self.queues[key];
                    }
                    // delete self.domains[key];
                }

                if (!resolved) {
                    if (deferred) {
                        //promise mode
                        if (err) {
                            deferredReject(err);
                        }
                        else {
                            deferredResolve(ret);
                        }
                    }
                    resolved = true;
                }

                if (locked) {
                    //run next func
                    if (!!self.queues[key] && self.queues[key].length > 0) {
                        self.queues[key].shift()();
                    }
                }
            };

        const exec =
            /**
             * @param {boolean} locked
             */
            function (locked) {
                if (resolved) { // may due to timed out
                    return done(locked);
                }

                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }

                // if (locked) {
                //     self.domains[key] = process.domain;
                // }

                // Callback mode
                if (fn.length === 1) {
                    let called = false;
                    fn(function (err, ret) {
                        if (!called) {
                            called = true;
                            done(locked, err, ret);
                        }
                    });
                }
                else {
                    // Promise mode
                    self._promiseTry(function () {
                        return fn();
                    })
                        .then(function (ret) {
                            done(locked, undefined, ret);
                        }, function (error) {
                            done(locked, error);
                        });
                }
            };
        // if (!process.domain) {
        //     exec = process.domain.bind(exec);
        // }

        if (!self.queues[key]) {
            self.queues[key] = [];
            exec(true);
        }
        else if (self.queues[key].length >= self.maxPending) {
            done(false, new Error('Too much pending tasks'));
        }
        else {
            const taskFn = function () {
                exec(true);
            };
            if (opts.skipQueue) {
                self.queues[key].unshift(taskFn);
            } else {
                self.queues[key].push(taskFn);
            }

            const timeout = opts.timeout || self.timeout;
            if (timeout) {
                timer = setTimeout(function () {
                    timer = null;
                    done(false, new Error('async-lock timed out'));
                }, timeout);
            }
        }

        if (deferred) {
            return deferred;
        }
    }

    /**
     * @param {string} key
     */
    isBusy(key) {
        if (!key) {
            return Object.keys(this.queues).length > 0;
        }
        else {
            return !!this.queues[key];
        }
    }

    /**
     * Promise.try() implementation to become independent of Q-specific methods
     * @param {{ (): any; (): void; }} fn
     */
    _promiseTry(fn) {
        try {
            return Promise.resolve(fn());
        } catch (e) {
            return Promise.reject(e);
        }
    }
}



/*
 * Below is how this function works:
 *
 * Equivalent code:
 * self.acquire(key1, function(cb){
 *     self.acquire(key2, function(cb){
 *         self.acquire(key3, fn, cb);
 *     }, cb);
 * }, cb);
 *
 * Equivalent code:
 * let fn3 = getFn(key3, fn);
 * let fn2 = getFn(key2, fn3);
 * let fn1 = getFn(key1, fn2);
 * fn1(cb);
 */
// AsyncLock.prototype._acquireBatch = function (keys, fn, cb, opts) {
//     if (typeof (cb) !== 'function') {
//         opts = cb;
//         cb = null;
//     }

//     const self = this;
//     const getFn = function (key, fn) {
//         return function (cb) {
//             self.acquire(key, fn, cb, opts);
//         };
//     };

//     let fnx = fn;
//     keys.reverse().forEach(function (key) {
//         fnx = getFn(key, fnx);
//     });

//     if (typeof (cb) === 'function') {
//         fnx(cb);
//     }
//     else {
//         return new this.Promise(function (resolve, reject) {
//             // check for promise mode in case keys is empty array
//             if (fnx.length === 1) {
//                 fnx(function (err, ret) {
//                     if (err) {
//                         reject(err);
//                     }
//                     else {
//                         resolve(ret);
//                     }
//                 });
//             } else {
//                 resolve(fnx());
//             }
//         });
//     }
// };


AsyncLock.DEFAULT_TIMEOUT = 0; //Never
AsyncLock.DEFAULT_MAX_PENDING = 1000;


module.exports = AsyncLock;