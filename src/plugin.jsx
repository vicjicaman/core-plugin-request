import * as IO from './io';
import fs from 'fs';
import * as Task from './task';
import {
  exec,
  wait
} from '@nebulario/core-process';

const PLUGIN_DATA = {
  status: "init"
};

function shutdown(signal) {
  return async function(err) {
    console.log(`${signal}...`);
    if (err) {
      console.error(err.stack || err);
    }

    IO.sendEvent("plugin.terminated", {});

    PLUGIN_DATA.status = "finish";

    setTimeout(() => {
      process.exit(
        err ?
        1 :
        0);
    }, 1000).unref();
  };
}

process.on('SIGTERM', shutdown('SIGTERM')).on('SIGINT', shutdown('SIGINT')).on('uncaughtException', shutdown('uncaughtException'));

const waitFor = async (status) => {
  while (PLUGIN_DATA.status !== status) {
    await wait(100);
  }
}

let inputBuffer = "";
export const run = async (pluginid, cmdHandlers) => {
  try {
    PLUGIN_DATA.status = "running";
    const payloadB64 = process.argv[2];

    const decoded = Buffer.from(payloadB64, 'base64').toString('ascii');

    //console.log("PLUGIN INIT");
    //console.log(decoded);

    const params = JSON.parse(decoded);

    const cxt = {
      pluginid
    };
    console.log("Starting plugin... " + pluginid);

    Task.register("build", cmdHandlers.build, cxt);
    Task.register("run", cmdHandlers.run, cxt);

    process.stdin.on('data', async function(rawData) {
      inputBuffer = rawData.toString();

      const {
        events,
        pending
      } = IO.getEvents(inputBuffer);

      inputBuffer = pending;
      //console.log(inputBuffer)

      for (const evt of events) {

        console.log("Handle plugin event... " + evt.event);
        //console.log(JSON.stringify(evt.payload, null, 2));

        if (evt.event === "request") {
          const {
            requestid,
            commandid,
            params
          } = evt.payload;

          const cxt = {
            commandid,
            requestid,
            plugin: PLUGIN_DATA
          };

          try {
            const out = await handleRequest(cmdHandlers, {
              commandid,
              params
            }, cxt);

            IO.sendEvent("request.output", {
              output: out,
              error: null
            }, cxt);

          } catch (e) {
            IO.sendEvent("request.output", {
              output: null,
              error: e.toString()
            }, cxt);
          }
        } else
        if (evt.event === "plugin.finish") {
          PLUGIN_DATA.status = "stopping";
          console.log("Finishing plugin...");
        } else
        if (evt.event === "listen") {

          const {
            listening: {
              taskid
            }
          } = evt.payload;

          Task.perform(taskid + ".listen", evt.payload, cxt);
        }
      }

    });

    await waitFor("stopping");

    // Stop all the performers!!!!

    PLUGIN_DATA.status = "stop";
    console.log("Plugin finished!");
  } catch (e) {
    console.log("PLUGIN_INIT_ERROR:" + e.toString());
    throw e;
  }
}

const handleRequest = async ({
  dependencies,
  publish
}, {
  commandid,
  params
}, cxt) => {
  let out = null;

  //////////////////////////////////////////////////////////////////////////////

  if (publish && commandid === "publish") {
    out = await publish(params, cxt);
  }

  //////////////////////////////////////////////////////////////////////////////

  if (dependencies.list && commandid === "dependencies.list") {
    out = await dependencies.list(params, cxt);
  }

  if (dependencies.sync && commandid === "dependencies.sync") {
    out = await dependencies.sync(params, cxt);
  }

  if (commandid.startsWith("task.")) {
    out = await Task.perform(commandid.replace("task.", ""), params, cxt);
  }
  //////////////////////////////////////////////////////////////////////////////

  return out;
}
