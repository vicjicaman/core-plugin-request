import _ from "lodash";
const uuidv4 = require("uuid/v4");

export const getEvents = data => {
  const rawInput = data.split("\n");

  //console.log("RAW EVENTS INPUT");
  //console.log(rawInput);

  const rawEvents = _.filter(
    rawInput,
    l => l.startsWith("EIO{") && l.endsWith("}EIO")
  );

  const events = _.map(rawEvents, re =>
    JSON.parse(re.substr(3, re.length - 6))
  );

  //return events;
  //console.log(data);
  //console.log(events)
  //console.log(rawInput)

  const last = rawInput[rawInput.length - 1];

  return {
    events,
    pending: last.endsWith("}EIO") ? "" : last
  };
};

export const sendEvent = (event, payload, cxt = {}) => {
  const { commandid, requestid } = cxt;

  const ev = {
    id: uuidv4(),
    requestid,
    commandid,
    event,
    payload
  };

  console.log("EIO" + JSON.stringify(ev) + "EIO");
};

export const sendOutput = (out, cxt) => {
  out.stdout &&
    sendEvent(
      "out",
      {
        data: out.stdout
      },
      cxt
    );

  out.stderr &&
    sendEvent(
      "warning",
      {
        data: out.stderr
      },
      cxt
    );
};

export const print = (ev, data, cxt) => sendEvent(ev, { data }, cxt);
