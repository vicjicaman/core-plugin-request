import * as IO from './io';
import fs from 'fs';
import * as Operation from './operation';
import {exec, wait} from '@nebulario/core-process';

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

    IO.sendEvent("plugin.terminated", {});

    PLUGIN_DATA.status = "finish";

    setTimeout(() => {
      process.exit(
        err
        ? 1
        : 0);
    }, 1000).unref();
  };

}

//await Process.exec(['mkdir -p ' + outputPath], {}, {}, cxt);
//if (!fs.existsSync(outputPath)) {
//  await exec(['mkdir -p ' + outputPath], {}, {}, cxt);
//}

// "cd /home/victor/nodeflow/workspace/namespaces/repoflow.com/instances/local-ui-graph-master/modules/dll-react;git status --porcelain --no-renames"

process.on('SIGTERM', shutdown('SIGTERM')).on('SIGINT', shutdown('SIGINT')).on('uncaughtException', shutdown('uncaughtException'));

export const run = async (cmdHandlers) => {
  PLUGIN_DATA.status = "running";
  const payloadB64 = process.argv[2];
  const params = JSON.parse(Buffer.from(payloadB64, 'base64').toString('ascii'));

  const {pluginid, paths} = params;
  const cxt = {
    pluginid,
    paths
  };
  console.log("Starting plugin " + pluginid);
  console.log(paths);

  if (paths && paths.absolute) {
    if (!fs.existsSync(paths.absolute)) {
      await exec(['mkdir -p ' + paths.absolute], {}, {}, cxt);
    }
  }

  process.stdin.on('data', async function(rawData) {
    const data = rawData.toString();

    const events = IO.getEvents(data)

    for (const evt of events) {

      if (evt.event === "request") {
        const {requestid, commandid, params} = evt.payload;

        const cxt = {
          commandid,
          requestid,
          plugin: PLUGIN_DATA,
          paths
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
      }

      if (evt.event === "plugin.finish") {
        PLUGIN_DATA.status = "stop"
      }
    }

  });

  while (PLUGIN_DATA.status !== "stop") {
    await wait(100);
  }

  const runOperationId = PLUGIN_DATA.run.operationid;
  const buildOperationId = PLUGIN_DATA.build.operationid;

  const buildOperation = await Operation.get(buildOperationId);
  const runOperation = await Operation.get(runOperationId);

  await Operation.stop(buildOperationId, cxt);
  await Operation.waitFor(buildOperation, "stop");
  await Operation.stop(runOperation, cxt);
  await Operation.waitFor(runOperation, "stop");

  console.log("END OF INSTANCE");
  IO.sendEvent("plugin.finished", {});

}

const handleRequest = async ({
  dependencies,
  run,
  build,
  publish
}, {
  commandid,
  params
}, cxt) => {
  let out = null;

  const runOperation = Operation.get(PLUGIN_DATA.run.operationid);
  const buildOperation = Operation.get(PLUGIN_DATA.build.operationid);

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

  if (buildOperation === null && build.start && commandid === "build.start") {
    const {operationid} = Operation.start(build.start, params, cxt);
    PLUGIN_DATA.build.operationid = operationid;
    out = {
      operationid
    };
  }

  if (buildOperation && commandid === "build.restart") {
    Operation.restart(buildOperation, cxt);
    out = {};
  }

  if (buildOperation && commandid === "build.stop") {
    Operation.stop(buildOperation, cxt);
    await Operation.waitFor(buildOperation, "stop");
    PLUGIN_DATA.build.operationid = null;
    out = {};
  }

  //////////////////////////////////////////////////////////////////////////////

  if (runOperation === null && run.start && commandid === "run.start") {
    const {operationid} = Operation.start(run.start, params, cxt);
    PLUGIN_DATA.run.operationid = operationid;
    out = {
      operationid
    };
  }

  if (runOperation && commandid === "run.restart") {
    Operation.restart(runOperation, cxt);
    out = {};
  }

  if (runOperation && commandid === "run.stop") {
    Operation.stop(runOperation, cxt);
    await Operation.waitFor(runOperation, "stop");
    PLUGIN_DATA.run.operationid = null;
    out = {};
  }

  //////////////////////////////////////////////////////////////////////////////

  return out;
}
