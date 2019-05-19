import _ from 'lodash'
import {
  spawn,
  wait
} from '@nebulario/core-process';
import killTree from 'tree-kill';
import * as IO from './io';
const uuidv4 = require('uuid/v4');

const OPERATION_DATA = {};
export const get = id => OPERATION_DATA[id] || null;

export const waitFor = async (operation, status) => {

  if (!operation) {
    return;
  }

  while (operation.status !== status) {
    await wait(100);
  }
}

const control = async (operation, cxt) => {

  const {
    operationid
  } = operation;

  while (operation.status !== "stopping") {
    await wait(100);
  }

  if (operation.process !== null) {
    console.log(operationid + ":KILL OPERATION PROCESS SIGINT");
    const killingProcess = operation.process;
    if (killingProcess) {
      killTree(killingProcess.pid, 'SIGINT');
      operation.process = null;
      console.log(operationid + ":NULLIFY 5")
    }
  } else {
    console.log(operationid + ":NO PROCESS TO KILL");
  }
  let i = 0;
  while (operation.status === "stopping") {
    i++;
    console.log("Waiting stopping for " + operation.operationid + "---------------------" + i);
    await wait(500);
  }

}

const executor = async (operation, handler, cxt) => {

  const {
    operationid
  } = operation;

  const spawnInfo = handler(operation.params, cxt);
  if (!spawnInfo) {
    operation.status = "stop";
    operation.process = null;
    console.log(operationid + ":NULLIFY 3")
    return;
  }


  const {
    promise: runtimePromise,
    process: runtimeProcess
  } = spawnInfo;



  operation.process = runtimeProcess;
  console.log(operationid + ":Started execution promise===============================")
  if (operation.process) {
    console.log(operationid + ":" + operation.process.pid)
  }

  if (runtimeProcess) {
    await runtimePromise;
  } else {
    await runtimePromise(operation, cxt);
  }

  console.log(operationid + ":Finished execution promise<===============================")
  operation.status = "stop";
  operation.process = null;
  console.log(operationid + ":NULLIFY 2")
}

const loop = async function(operation, handler, cxt) {
  const {
    operationid,
    config
  } = operation;

  while (operation.restart === true) {

    try {
      operation.status = "active";

      console.log(operationid + ":OPERATION_SETUP:" + operation.restart);
      operation.restart = false;
      await Promise.all([
        control(operation, cxt),
        executor(operation, handler, cxt)
      ]);
    } catch (e) {

      let handled = false;
      if (config && config.onError) {
        handled = config.onError(operation, e, cxt);
      }

      console.log(operationid + ":OPERATION_ERROR: " + e.toString());

      if (!handled && operation.restart !== true) {
        IO.sendEvent("error", {
          operationid,
          error: e.message + " code " + e.code
        }, cxt);
      }

      if (operation.restart !== true) {
        throw e;
      }
    } finally {
      operation.status = "stop";
    }
  }
}

export const start = (handler, params, config, cxt) => {
  const operationid = uuidv4();

  const operation = {
    operationid,
    status: "stop",
    params,
    restart: true,
    config
  }

  console.log("OPERATION STARTED: " + operationid);
  OPERATION_DATA[operationid] = operation;
  loop(operation, handler, cxt).catch(function(err) {
    console.log("ERROR OPERATION: " + operationid);
  }).then(function(control, execution) {
    console.log("FINISH OPERATION: " + operationid);
    delete OPERATION_DATA[operation.operationid];
  })

  return operation;
}

export const restart = (operation, cxt) => {
  if (operation) {
    stop(operation, cxt);
    operation.restart = true;
  }
}

export const stop = (operation, cxt) => {
  if (operation) {
    operation.restart = false;
    operation.status = "stopping";
  }
}
