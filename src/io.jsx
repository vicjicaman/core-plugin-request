import _ from 'lodash'
const uuidv4 = require('uuid/v4');

export const getEvents = data => {
  const rawInput = data.split("\n");

  //console.log("RAW EVENTS INPUT");
  //console.log(rawInput);

  const rawEvents = _.filter(rawInput, l => l.startsWith("MIO{"));
  return _.map(rawEvents, re => JSON.parse(re.substr(3)))
}

export const sendEvent = (event, payload, cxt = {}) => {
  const {commandid, requestid} = cxt;

  const ev = {
    id: uuidv4(),
    requestid,
    commandid,
    event,
    payload
  }

  console.log("SIO" + JSON.stringify(ev));
}
