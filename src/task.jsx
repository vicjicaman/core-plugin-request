import * as IO from './io';
import fs from 'fs';
import * as Operation from './operation';


const TASK_DATA = {};

export const register = (taskid, {
  configure,
  transform,
  init,
  start,
  clear
}, cxt) => {

  const task = {
    taskid,
    phases: {
      configure,
      transform,
      clear,
      init,
      start: async (params, cxt) => {

        const {
          operationid
        } = Operation.start(start, params, cxt);


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
  const {
    phases
  } = task;

  const phaseFn = phases[phase];

  if (!phaseFn) {
    return null;
  }

  return await phaseFn(params, cxt);
}
