import fs from 'fs'
import md5 from 'md5'

export const watch  = (filenameToWatch, cb) => {

  let md5Previous = null;
  let fsWait = false;
  return fs.watch(filenameToWatch, (event, filename) => {
    if (filename) {
      if (fsWait) return;
      fsWait = setTimeout(() => {
        fsWait = false;
      }, 100);
      const md5Current = md5(fs.readFileSync(filenameToWatch));
      if (md5Current === md5Previous) {
        return;
      }
      md5Previous = md5Current;
      cb(event, filename);
    }
  });

}
