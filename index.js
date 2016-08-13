"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');
const zlib = require('zlib');

const getTileIndex = (url, callback) => {
  request({
    url: url,
    maxAttempts: 20,
    retryDelay: 30000
  }, function (err, res, body){
    if (err){
      callback(err);
      return;
    }
    callback(null, geojsonVt(JSON.parse(body), {maxZoom: 20})); //TODO: this should be configurable)
  })
}

class GeoJSONSource {
  constructor(uri, callback){
    getTileIndex("https://p.hsl.fi/api/v1/facilities.geojson?limit=1000", (err, facilityTileIndex) => {
      if (err){
        callback(err);
        return;
      }
      this.facilityTileIndex = facilityTileIndex;
      getTileIndex("https://p.hsl.fi/api/v1/hubs.geojson?limit=1000", (err, hubTileIndex) => {
        if (err){
          callback(err);
          return;
        }
        this.hubTileIndex = hubTileIndex;
        callback(null, this);
      })
    })
  };

  getTile(z, x, y, callback){
    let facilityTile = this.facilityTileIndex.getTile(z, x, y)
    let hubTile = this.hubTileIndex.getTile(z, x, y)

    if (facilityTile === null){
      facilityTile = {features: []}
    }

    if (hubTile === null){
      hubTile = {features: []}
    }

    zlib.gzip(vtPbf.fromGeojsonVt({ facilities: facilityTile, hubs: hubTile}), function (err, buffer) {
      if (err){
        callback(err);
        return;
      }

      callback(null, buffer, {"content-encoding": "gzip"})
    })
  }

  getInfo(callback){
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
  tilelive.protocols['hslparkandride:'] = GeoJSONSource
}
