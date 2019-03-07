import _ from 'lodash'
import {spawn, wait} from '@nebulario/core-process';
import killTree from 'tree-kill';
import * as IO from './io';
const uuidv4 = require('uuid/v4');

export const exec = async (cmd, args, opts, evtHnd, cxt) => {

  const {promise: runtimePromise, process: runtimeProcess} = await spawn(cmd, args, opts, evtHnd, cxt);

  try {
    await runtimePromise;
  } catch (e) {
    console.log("EXECUTION_ERROR: " + e.toString());
  } //finally {
  //killTree(runtimeProcess.pid, 'SIGTERM');
  //}

}

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

  while (operation.status !== "stopping") {
    await wait(100);
  }

  console.log("KILL OPERATION PROCESS SIGINT!");
  const killingProcess = operation.process;
  if (killingProcess) {
    killTree(killingProcess.pid, 'SIGINT');
  }
  let i = 0;
  while (operation.status === "stopping" && operation.process) {
    i++;
    console.log("Waiting interruption " + i + "--------------------" + killingProcess.pid);
    await wait(500);
  }

  operation.process = null;

}

const executor = async (operation, handler, cxt) => {
  const {promise: runtimePromise, process: runtimeProcess} = handler(operation.params, cxt);
  operation.process = runtimeProcess;
  console.log("Started execution promise<================================")
  await runtimePromise;
  console.log("Finished execution promise<===============================")
  operation.status = "stop";
  operation.process = null;
}

const loop = async function(operation, handler, cxt) {
  const {operationid} = operation;

  while (operation.restart === true) {

    IO.sendEvent("plugin.operation.started", {
      operationid
    }, cxt);

    try {
      operation.status = "active";
      operation.restart = false;
      await Promise.all([
        control(operation, cxt),
        executor(operation, handler, cxt)
      ]);
      await wait(2500);
    } catch (e) {

      IO.sendEvent("plugin.operation.error", {
        operationid,
        error: e.message
      }, cxt);

      console.log("OPERATION_ERROR: " + e.toString());
      if (operation.restart !== true) {
        throw e;
      }
    } finally {

      IO.sendEvent("plugin.operation.stopped", {
        operationid
      }, cxt);

      operation.status = "stop";
    }
  }

}

export const start = (handler, params, cxt) => {
  const operationid = uuidv4();

  const operation = {
    operationid,
    status: "stop",
    params,
    restart: true
  }

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
