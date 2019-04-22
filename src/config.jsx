import fs from 'fs'
import path from 'path'
import * as JSON from './json.jsx'

export const replace = (content, config) => {
  let replaced = content;

  for (const configVar in config) {
    const configVal = config[configVar];
    replaced = replaced.replace(new RegExp("\\$\\{" + configVar + "\\}", 'g'), typeof configVal === 'object' ? configVal.value : configVal);
  }

  return replaced;
}

export const get = (folder, file, config) => {

  const content = fs.readFileSync(path.join(folder, file), "utf8");
  const out = {
    ...config
  };

  const lines = content.split('\n');
  for (const line of lines) {
    const i = line.indexOf('=');
    const key = line.substr(0, i);
    const val = line.substr(i + 1);

    if (val) {
      const replaced = replace(val, out);

      if (replaced.charAt(0) === '"' && replaced.charAt(replaced.length - 1) === '"') {
        out[key] = replaced.substr(1, replaced.length - 2);
      } else {
        out[key] = replaced;
      }

    }
  }

  return out;
}


export const load = (folder, file = "config.json") => {

  const config = JSON.load(path.join(folder, file));

  const dependenciesConfigValues = {};

  for (const moduleid in config.dependencies) {
    const {
      version
    } = config.dependencies[moduleid];


    if (version.startsWith("file:")) {
      const localFolder = path.join(folder, version.replace("file:", ""));
      const depConfig = JSON.load(path.join(localFolder, "dist", "config.json"));

      for (const entry in depConfig) {
        dependenciesConfigValues[entry + '@' + moduleid] = depConfig[entry].value;
      }

    } else {
      // get the content from the namespace

    }
    //

  }

  return dependenciesConfigValues;
}



export const dependencies = (folder, file = "config.json") => {
  const config = JSON.load(path.join(folder, file));

  const dependencies = [];

  for (const moduleid in config.dependencies) {
    const {
      version
    } = config.dependencies[moduleid];
    dependencies.push({
      dependencyid: 'dependency|config.json|dependencies.' + moduleid + '.version',
      kind: "config",
      filename: "config.json",
      path: 'dependencies.' + moduleid + '.version',
      fullname: moduleid,
      version
    });
  }

  return dependencies;
}
