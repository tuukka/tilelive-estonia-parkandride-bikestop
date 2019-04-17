"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');
const zlib = require('zlib');
var osmtogeojson = require('osmtogeojson');

const api = "http://localhost:8080";

const overpassQuery = "https://overpass-api.de/api/interpreter?data=%2F*%0AThis%20has%20been%20generated%20by%20the%20overpass-turbo%20wizard.%0AThe%20original%20search%20was%3A%0A%E2%80%9Cpark_ride%3D*%20in%20estonia%E2%80%9D%0A*%2F%0A%5Bout%3Ajson%5D%5Btimeout%3A25%5D%3B%0A%2F%2F%20fetch%20area%20%E2%80%9Cestonia%E2%80%9D%20to%20search%20in%0Aarea%283600079510%29-%3E.searchArea%3B%0A%2F%2F%20gather%20results%0A%28%0A%20%20%2F%2F%20query%20part%20for%3A%20%E2%80%9Cpark_ride%3D*%E2%80%9D%0A%20%20node%5B%22park_ride%22%5D%28area.searchArea%29%3B%0A%20%20way%5B%22park_ride%22%5D%28area.searchArea%29%3B%0A%20%20relation%5B%22park_ride%22%5D%28area.searchArea%29%3B%0A%29%3B%0A%2F%2F%20print%20results%0Aout%20body%3B%0A%3E%3B%0Aout%20skel%20qt%3B";

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
            getTileIndex(overpassQuery, (err, hubTileIndex) => {
                if (err) {
                    callback(err);
                    return;
                }
                this.hubTileIndex = hubTileIndex;
                callback(null, this);
            })
        })
    };

    getTile(z, x, y, callback) {
        let facilityTile = this.facilityTileIndex.getTile(z, x, y)
        let hubTile = this.hubTileIndex.getTile(z, x, y)

        if (facilityTile === null) {
            facilityTile = {features: []}
        }

        if (hubTile === null) {
            hubTile = {features: []}
        }

        const data = Buffer.from(vtPbf.fromGeojsonVt({facilities: facilityTile, hubs: hubTile}));

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
            name: "HSL Park & Ride"
        })
    }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
    tilelive.protocols['estoniaparkandridebikestop:'] = GeoJSONSource
}
