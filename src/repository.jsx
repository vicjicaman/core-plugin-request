import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs'
import {
  exec
} from '@nebulario/core-process';

export const clone = async (params, repositoryid, dest) => {

  const {
    module: {
      code: {
        paths: {
          absolute: {
            folder
          }
        }
      }
    },
    modules
  } = params;

  await exec(["git clone git@" + repositoryid + " " + dest], {
    cwd: folder
  }, {}, {});
}
