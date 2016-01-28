"use strict"
const geojsonVt = require('geojson-vt');
const vtPbf = require('vt-pbf');
const request = require('requestretry');

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
    getTileIndex("https://p.hsl.fi/api/v1/facilities.geojson?limit=1000", (err, tileIndex) => {
      if (err){
        callback(err);
        return;
      }
      this.tileIndex = tileIndex;
      callback(null, this);
    })
  };

  getTile(z, x, y, callback){
    let tile = this.tileIndex.getTile(z, x, y)

    if (tile === null){
      tile = {features: []}
    }

    callback(null, vtPbf.fromGeojsonVt({ 'facilities': tile}), {"content-encoding": "none"})
  }

  getInfo(callback){
    callback(null, {
      format: "pbf",
      vector_layers: [{
        "description": "",
        "id": "facilities"
      }]
    })
  }
}

module.exports = GeoJSONSource

module.exports.registerProtocols = (tilelive) => {
  tilelive.protocols['hslparkandride:'] = GeoJSONSource
}
