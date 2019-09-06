import * as IO from './io';
import fs from 'fs';
import * as Operation from './operation';


const TASK_DATA = {};

export const register = (taskid, handlers, cxt) => {

  if (!handlers) {
    TASK_DATA[taskid] = null;
    return;
  }

  const {
    listen,
    transform,
    init,
    start,
    clear
  } = handlers;

  const task = {
    taskid,
    phases: {
      listen: async (params, cxt) => {

        const {
          listening: {
            operationid
          }
        } = params;

        const op = Operation.get(operationid);

        try {

          await listen({
            ...params,
            operation: op
          }, cxt);

        } catch (err) {
          IO.sendEvent("warning", {
            operationid,
            data: "LISTEN_ERROR: "+err.toString()
          }, cxt);
        }

      },
      transform,
      clear,
      init,
      start: async (params, cxt) => {

        const config = {
          onError: (operation, e, cxt) => {
            if (e.code === null) {

              IO.sendEvent("warning", {
                operationid,
                data: "code: " + e.code + " - " + e.message
              }, cxt);
              return true;
            }

            return false;
          }
        };

        const {
          operationid
        } = Operation.start(start, params, config, cxt);

        return {
          operationid
        };

      },
      restart: async ({
        operationid
      }, cxt) => {
        const op = Operation.get(operationid);
        Operation.restart(op, cxt);
        await Operation.waitFor(op, "running");
      },
      stop: async ({
        operationid
      }, cxt) => {
        const op = Operation.get(operationid);
        Operation.stop(op, cxt);
        await Operation.waitFor(op, "stop");
      }
    }
  };

  TASK_DATA[taskid] = task;
}


export const perform = async (commandid, params, cxt) => {
  const [taskid, phase] = commandid.split(".");
  const task = TASK_DATA[taskid];

  if (task === null) {
    return null;
  }

  const {
    phases
  } = task;

  const phaseFn = phases[phase];

  if (!phaseFn) {
    return null;
  }

  return await phaseFn(params, cxt);
}
