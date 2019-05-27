import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import YAML from 'yamljs'

export const load = (filename, isYaml = false) => {

  const content = fs.readFileSync(filename, 'utf8')
  return isYaml ?
    YAML.parse(content) :
    JSON.parse(content);
}

export const save = (filename, content, isYaml = false) => {
  fs.writeFileSync(
    filename, isYaml ?
    YAML.stringify(content, 10, 2) :
    JSON.stringify(content, null, 2), 'utf8');

}



export const sync = (folder, {
  filename,
  path: pathToVersion,
  version
}, isYaml = false, setter = null) => {

  const contentFile = path.join(folder, filename);
  const native = load(contentFile, isYaml)

  const modNative = setter ?
    setter(native, pathToVersion, version) :
    _.set(native, pathToVersion, version)

  save(contentFile, modNative, isYaml);
}
