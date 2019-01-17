import _ from 'lodash'
import {spawn, wait} from '@nebulario/core-process';
import killTree from 'tree-kill';
const uuidv4 = require('uuid/v4');

export const exec = async (cmd, args, opts, evtHnd, cxt) => {

  const {promise: runtimePromise, process: runtimeProcess} = await handler(cmd, args, opts, evtHnd, cxt);

  try {
    await runtimePromise;
  } catch (e) {
    console.log("EXEC_ERROR: " + e.toString());
  } finally {
    killTree(runtimeProcess.pid, 'SIGTERM');
  }

}

const OPERATION_DATA = {};
export const get = id => OPERATION_DATA[id];

export const start = async (operationid, handler, params, cxt) => {

  const control = async (operation, cxt) => {

    while (operation.status === "active") {
      await wait(100);
    }

    if (operation.status === "stop" || operation.status === "restart") {

      if (operation.process) {
        killTree(operation.process.pid, 'SIGINT');
        operation.process = null;
      }
    }

  }

  const executor = async (operation, cxt) => {

    const {promise: runtimePromise, process: runtimeProcess} = handler(params, cxt);
    operation.process = runtimeProcess;

    try {
      await runtimePromise;
    } finally {
      operation.status = "stop";
    }
  }

  const operation = {
    operationid,
    status: "stop",
    params,
    restart: false
  }

  let k = 0;
  while (k < 5) {
    try {

      operation.status = "running";
      await Promise.all([
        control(operation, cxt),
        executor(operation, cxt)
      ]);

    } catch (e) {
      console.log("OPERATION_ERROR: " + e.toString());
      k++;
      operation.status = "stop";
      if (operation.restart !== true) {
        throw e;
      }
    }
  }

}

export const restart = async (operationid, cxt) => {
  const operation = get(operationid);

  if (operation) {
    operation.restart = true;
    await stop(operationid, cxt);
  }
}

export const stop = async (operationid, cxt) => {
  const operation = get(operationid);
  if (operation) {
    operation.status = "stop";
  }
}
