import * as IO from './io';
import * as Operation from './operation';
import {wait} from '@nebulario/core-process';
const uuidv4 = require('uuid/v4');

const PLUGIN_DATA = {
  status: "init",
  run: {
    operationid: null
  },
  build: {
    operationid: null
  }
};

function shutdown(signal) {
  return async function(err) {
    console.log(`${signal}...`);
    if (err) {
      console.error(err.stack || err);
    }

    IO.sendEvent("plugin.terminated");

    PLUGIN_DATA.status = "finish";

    setTimeout(() => {
      process.exit(
        err
        ? 1
        : 0);
    }, 1000).unref();
  };

}

process.on('SIGTERM', shutdown('SIGTERM')).on('SIGINT', shutdown('SIGINT')).on('uncaughtException', shutdown('uncaughtException'));

export const run = async (cmdHandlers) => {
  PLUGIN_DATA.status = "running";
  const payloadB64 = process.argv[2];
  const params = JSON.parse(Buffer.from(payloadB64, 'base64').toString('ascii'));

  const {pluginid} = params;
  console.log("Starting plugin " + pluginid);

  process.stdin.on('data', async function(rawData) {
    const data = rawData.toString();

    const events = IO.getEvents(data)

    for (const evt of events) {

      if (evt.event === "request") {
        const {requestid, commandid, params} = evt.payload;

        const cxt = {
          requestid,
          plugin: PLUGIN_DATA
        };

        try {
          const out = await handleRequest(cmdHandlers, {
            commandid,
            params
          }, cxt);

          IO.sendEvent("request.output", {
            requestid,
            output: out
          }, cxt);

        } catch (e) {
          IO.sendEvent("request.error", {
            data: e.message
          }, cxt);
        }
      }

      if (evt.event === "finish") {
        PLUGIN_DATA.status = "stop"
      }
    }

  });

  while (PLUGIN_DATA.status === "running") {
    await wait(100);
  }

  const buildOperation = await Operation.get(buildOperationId);
  const runOperation = await Operation.get(runOperationId);

  buildOperation && await Operation.stop(buildOperationId, cxt);
  runOperation && await Operation.stop(buildOperationId, cxt);

  while ((buildOperation && buildOperation.status !== "stop") || (runOperation && runOperation.status !== "stop")) {
    await wait(100);
  }

  IO.sendEvent("plugin.finished", {});

}

const handleRequest = async ({
  dependencies,
  run,
  build,
  publish
}, {
  requestid,
  commandid,
  params
}, cxt) => {
  let out = null;

  const runOperationId = PLUGIN_DATA.run.operationid;
  const buildOperationId = PLUGIN_DATA.build.operationid;

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

  //////////////////////////////////////////////////////////////////////////////

  if (build.init && commandid === "build.init") {
    out = await build.init(params, cxt);
  }

  //////////////////////////////////////////////////////////////////////////////

  if (buildOperationId === null && build.start && commandid === "build.start") {
    PLUGIN_DATA.build.operationid = uuidv4();
    out = await Operation.start(PLUGIN_DATA.build.operationid, build.start, params, cxt);
  }

  if (buildOperationId && commandid === "build.restart") {
    out = await Operation.restart(buildOperationId, cxt);
  }

  if (buildOperationId && commandid === "build.stop") {
    out = await Operation.stop(buildOperationId, cxt);
    PLUGIN_DATA.build.operationid = null;
  }

  //////////////////////////////////////////////////////////////////////////////

  if (runOperationId === null && run.start && commandid === "run.start") {
    PLUGIN_DATA.run.operationid = uuidv4();
    out = await Operation.start(PLUGIN_DATA.run.operationid, run.start, params, cxt);
  }

  if (runOperationId && commandid === "run.restart") {
    out = await Operation.restart(runOperationId, cxt);
  }

  if (runOperationId && commandid === "run.stop") {
    out = await Operation.stop(runOperationId, cxt);
    PLUGIN_DATA.run.operationid = null;
  }

  //////////////////////////////////////////////////////////////////////////////

  return out;
}
