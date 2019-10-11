import * as IO from "./io";
import fs from "fs";
import * as Operation from "./operation";

const TASK_DATA = {};

export const register = (taskid, handlers, cxt) => {
  if (!handlers) {
    TASK_DATA[taskid] = null;
    return;
  }

  const { listen, transform, init, start, clear } = handlers;

  const task = {
    taskid,
    phases: {
      listen: async (params, cxt) => {
        const {
          listening: { operationid }
        } = params;

        const op = Operation.get(operationid);

        try {
          if (op && listen) {
            await listen(
              {
                ...params,
                operation: op
              },
              { ...cxt, params: op.params }
            );
          }
        } catch (err) {
          IO.sendEvent(
            "warning",
            {
              operationid,
              data: "LISTEN_ERROR: " + err.toString()
            },
            cxt
          );
        }
      },
      transform,
      clear,
      init,
      start: async (params, cxt) => {
        const config = {
          onError: (operation, e, cxt) => {
            if (e.code === null) {
              IO.sendEvent(
                "warning",
                {
                  operationid,
                  data: "code: " + e.code + " - " + e.message
                },
                cxt
              );
              return true;
            }

            return false;
          }
        };

        const { operationid } = Operation.start(start, params, config, cxt);

        return {
          operationid
        };
      },
      restart: async ({ operationid }, cxt) => {
        const op = Operation.get(operationid);
        if (op.status === "active") {
          await Operation.restart(op, { ...cxt, params: op.params });
          await Operation.waitFor(op, "active", true, "RESTART");
        }
      },
      stop: async ({ operationid }, cxt) => {
        console.log("STOP OPERATION " + operationid);

        const op = Operation.get(operationid);
        if (op) {
          Operation.stop(op, false, { ...cxt, params: op.params });
          await Operation.waitFor(op, "stop", true, "STOP");
        }
      }
    }
  };

  TASK_DATA[taskid] = task;
};

export const perform = async (commandid, params, cxt) => {
  const [taskid, phase] = commandid.split(".");
  const task = TASK_DATA[taskid];

  if (task === null) {
    return null;
  }

  const { phases } = task;

  const phaseFn = phases[phase];

  if (!phaseFn) {
    return null;
  }

  return await phaseFn(params, cxt);
};
