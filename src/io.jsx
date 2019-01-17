import _ from 'lodash'
const uuidv4 = require('uuid/v4');
import fs from 'fs';

export const saveJson = (folder, json) => fs.writeFileSync(folder, JSON.stringify(json, null, 2), 'utf8');
export const loadJson = (folder) => JSON.parse(fs.readFileSync(folder, 'utf8'));

export const getEvents = data => {
  const rawInput = data.split("\n");
  const rawEvents = _.filter(rawInput, l => l.startsWith("MIO{"));
  return _.map(rawEvents, re => JSON.parse(re.substr(3)))
}

export const sendEvent = (event, payload, cxt = {}) => {
  const {requestid} = cxt;

  const ev = {
    id: uuidv4(),
    requestid,
    event,
    payload
  }

  console.log("SIO" + JSON.stringify(ev));
}
