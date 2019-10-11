import _ from "lodash";
import { spawn, wait } from "@nebulario/core-process";
import killTree from "tree-kill";
import * as IO from "./io";
const uuidv4 = require("uuid/v4");

const OPERATION_DATA = {};
export const get = id => OPERATION_DATA[id] || null;

export const waitFor = async (operation, status, until = true, tag) => {
  if (!operation) {
    return;
  }

  while ((operation.status !== status) === until) {
    if (operation.status === "stop" || operation.process === null) {
      break;
    }
    /*console.log(
      tag +
        " -- Waiting until( " +
        until +
        " ) " +
        status +
        "  " +
        operation.operationid +
        "--" +
        operation.status
    );*/
    await wait(10);
  }
};

const control = async (operation, cxt) => {
  const { operationid } = operation;

  console.log(operationid + ":Operation in control: " + operation.status);

  await waitFor(operation, "stopping", true, "GATE");

  console.log(operationid + ":Stop operation control: " + operation.status);

  if (operation.process !== null) {
    console.log(operationid + ":Kill operation process with SIGINT");
    const killingProcess = operation.process;
    if (killingProcess) {
      killTree(killingProcess.pid, "SIGINT");
      operation.process = null;
      console.log(operationid + ":Operation process killed");
    }
  } else {
    console.log(operationid + ":Promise based operation, no process to kill");
  }

  if (operation.status !== "stop") {
    await waitFor(operation, "stopping", false, "TAIL");
  }
};

const executor = async (operation, handler, cxt) => {
  const { operationid } = operation;

  const spawnInfo = handler(operation.params, cxt);
  if (!spawnInfo) {
    operation.status = "stop";
    operation.process = null;
    console.log(operationid + ":No process for the operation.");
    return;
  }

  const { promise: runtimePromise, process: runtimeProcess } = spawnInfo;

  operation.process = runtimeProcess;

  if (runtimeProcess) {
    console.log(
      operationid + ":Execution process based " + operation.process.pid
    );
    await runtimePromise;
  } else {
    console.log(operationid + ":Execution promise based");
    await runtimePromise(operation, cxt);
  }

  operation.status = "stop";
  operation.process = null;
  console.log(operationid + ":Finished execution");
};

const loop = async function(operation, handler, cxt) {
  const { operationid, config } = operation;

  while (operation.restart === true) {
    try {
      operation.status = "active";
      operation.process = "pending...";

      console.log(
        operationid +
          ":Starting operation control and execution:" +
          operation.restart
      );
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
        IO.sendEvent(
          "error",
          {
            operationid,
            error: e.message + " code " + e.code
          },
          cxt
        );
      }

      if (operation.restart !== true) {
        throw e;
      }
    } finally {
      operation.status = "stop";
    }
  }
};

export const start = (handler, params, config, cxt) => {
  const operationid = uuidv4();

  const operation = {
    operationid,
    status: "stop",
    params,
    restart: true,
    config
  };

  console.log("OPERATION STARTED: " + operationid);
  OPERATION_DATA[operationid] = operation;
  loop(operation, handler, cxt)
    .catch(function(err) {
      console.log("ERROR OPERATION: " + operationid);
    })
    .then(function(control, execution) {
      console.log("FINISH OPERATION: " + operationid);
      delete OPERATION_DATA[operation.operationid];
    });

  return operation;
};

export const restart = async (operation, cxt) => {
  if (operation) {
    stop(operation, true, cxt);
    await waitFor(operation, "stopping", false, "STOP_CURRENT");
  }
};

export const stop = (operation, restart, cxt) => {
  if (operation) {
    operation.restart = restart;
    operation.status = "stopping";
  }
};
