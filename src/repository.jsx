import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs'
import {
  exec
} from '@nebulario/core-process';

export const clone = async (url, repositoryid) => {
  await exec(["git clone git@" + url + " " + repositoryid], {}, {}, {});
}
