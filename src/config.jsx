import fs from 'fs'
import path from 'path'

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
