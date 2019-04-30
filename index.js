"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');
const zlib = require('zlib');
var osmtogeojson = require('osmtogeojson');

const api = "http://localhost:8080";

const overpassQuery = "https://estonia-parkandride--tuukkah.repl.co/";

const getTileIndex = (url, callback) => {
    request({
        url: url,
        maxAttempts: 20,
        retryDelay: 30000
    }, function (err, res, body) {
        if (err) {
            callback(err);
            return;
        }
        callback(null, geojsonVt(osmtogeojson(JSON.parse(body)), {
            maxZoom: 20,
            buffer: 1024,
        })); //TODO: this should be configurable)
    })
}

class GeoJSONSource {
    constructor(uri, callback) {
        getTileIndex(overpassQuery, (err, facilityTileIndex) => {
            if (err) {
                callback(err);
                return;
            }
            this.facilityTileIndex = facilityTileIndex;
            /* We don't have hubs for now:
            getTileIndex(overpassQuery, (err, hubTileIndex) => {
                if (err) {
                    callback(err);
                    return;
                }
                this.hubTileIndex = hubTileIndex;*/
                callback(null, this);
            //})
        })
    };

    getTile(z, x, y, callback) {
        let facilityTile = this.facilityTileIndex.getTile(z, x, y)
        // let hubTile = this.hubTileIndex.getTile(z, x, y)

        if (facilityTile === null) {
            facilityTile = {features: []}
        }
/*
        if (hubTile === null) {
            hubTile = {features: []}
        }
*/
        const data = Buffer.from(vtPbf.fromGeojsonVt({facilities: facilityTile, /*hubs: hubTile*/}));

        zlib.gzip(data, function (err, buffer) {
            if (err) {
                callback(err);
                return;
            }

            callback(null, buffer, {"content-encoding": "gzip"})
        })
    }

    getInfo(callback) {
        callback(null, {
            format: "pbf",
            vector_layers: [{
                description: "",
                id: "facilities"
            },
                {
                    description: "",
                    id: "hubs"
                }],
            maxzoom: 20,
            minzoom: 1,
            name: "Estonia Park & Ride"
        })
    }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
    tilelive.protocols['estoniaparkandridebikestop:'] = GeoJSONSource
}
