// Copyright 2016 Circonus, Inc. All rights reserveplugin.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

'use strict';

const path = require('path');
const child = require('child_process');

class CephOSDPerf {

    /**
     * creates instances
     */
    constructor() {
        this.config = {};

        try {
            this.config = require(path.resolve(path.join(__dirname, '..', '..', 'ceph.json'))); // eslint-disable-line global-require
        } catch (err) {
            if (err.code !== 'MODULE_NOT_FOUND') {
                console.error(err);

                return;
            }
        }

        this.ceph_bin = this.config.ceph_bin || '/usr/bin/ceph';
        this.ceph_cmd = 'osd';
        this.ceph_cmd_args = 'perf';
    }

    /**
     * called by nad to run the plugin
     * @arg {Object} plugin definition
     * @arg {Function} cb callback
     * @arg {Object} req http request object
     * @arg {Object} args instance arguments
     * @arg {String} instance id
     * @returns {Undefined} nothing
     */
    run(plugin, cb, req, args, instance) { // eslint-disable-line max-params, no-unused-vars
        this.probe((err, metrics) => {
            if (err !== null) {
                console.error(err);
                plugin.running = false; // eslint-disable-line no-param-reassign
                cb(plugin, { metric_collection_error: err.message });

                return;
            }
            plugin.running = false; // eslint-disable-line no-param-reassign
            cb(plugin, metrics, instance);
        });
    }

    /**
     * called to start the command
     * @arg {Function} cb callback
     * @returns {Undefined} nothing
     *
     * cb called with err|null, metrics
     */
    probe(cb) {
        const metrics = {};
        const cmd = `${this.ceph_bin} ${this.ceph_cmd} ${this.ceph_cmd_args} -f json 2>/dev/null`;

        this._runCommand(cmd, (err, result) => {
            if (err !== null) {
                cb(err);

                return;
            }

            if ({}.hasOwnProperty.call(result, 'osd_perf_infos')) {
                for (const osd of result.osd_perf_infos) {
                    metrics[`osd${osd.id}`] = osd.perf_stats;
                }
            }

            cb(null, metrics);
        });
    }

    /**
     * runs the command
     * @arg {String} cmd to run
     * @arg {Function} cb callback
     * @returns {Undefined} nothing
     *
     * cb called with err|null, results
     */
    _runCommand(cmd, cb) { // eslint-disable-line class-methods-use-this
        child.exec(cmd, (execErr, stdout, stderr) => {
            if (execErr !== null) {
                cb(new Error(`${execErr} ${stderr}`));

                return;
            }

            let result = null;

            try {
                result = JSON.parse(stdout);
            } catch (parseErr) {
                cb(parseErr);

                return;
            }

            cb(null, result);
        });
    }

}

module.exports = CephOSDPerf;

if (!module.parent) {
    const ceph = new CephOSDPerf();

    ceph.probe((err, metrics) => {
        if (err !== null) {
            throw err;
        }
        console.dir(metrics);
    });
}
