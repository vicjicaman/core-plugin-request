import {
  wait
} from '@nebulario/core-process';
import axios from 'axios'
import * as
IO
from './io';

export const publish = async (urlSrv, params, cxt) => {
  const {
    publish: {
      branchid
    },
    module: {
      moduleid,
      type,
      mode,
      version,
      fullname,
      url,
      code: {
        paths: {
          relative: {
            folder: relativeFolder
          }
        }
      }
    }
  } = params;

  const response = await axios.post(urlSrv + '/' + type, {
    moduleid,
    type,
    mode,
    version,
    fullname,
    url,
    branchid,
    folder: relativeFolder
  }, {
    responseType: 'stream',
    timeout: 60 * 4 * 1000
  });

  let publishOutput = null;
  let publishStreamFinished = false;
  let publishStreamError = null;

  response.data.on('error', (data) => {
    console.log("STREAM_PUBLISH_ERROR");
    publishStreamError = data.toString();
    IO.sendEvent("error", {
      data: data.toString()
    }, cxt);
  });

  response.data.on('data', (raw) => {
    console.log("STREAM_PUBLISH_OUTPUT");
    const rawString = raw.toString();

    try {
      publishOutput = JSON.parse(raw.toString())
    } catch (e) {
      console.log("STREAM_PUBLISH_PARSE:" + rawString);
    }

    if (publishOutput.error) {
      publishStreamError = data.error;
    }

    IO.sendEvent("out", {
      data: rawString
    }, cxt);

  });

  response.data.on('end', function() {
    publishStreamFinished = true;
    IO.sendEvent("done", {}, cxt);
  });

  while (publishStreamFinished === false && publishStreamError === null) {
    await wait(100);
  }

  if (publishOutput !== null) {
    return {
      ...publishOutput,
      error: publishStreamError
    };
  } else {
    return {
      error: "INVALID_PUBLISH_OUTPUT"
    };
  }

}
