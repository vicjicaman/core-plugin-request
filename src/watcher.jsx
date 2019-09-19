import fs from "fs";
import md5 from "md5";

export const watch = (filenameToWatch, cb) => {
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
};

export const multiple = (paths, cb) => {
  const res = [];
  for (const path of paths) {
    const watcher = watch(path, cb);
    res.push(watcher);
  }
  return res;
};

export const stop = watchers => {
  if (Array.isArray(watchers)) {
    Array.isArray(watchers).forEach(wt => wt.close());
  } else {
    watchers.close();
  }
};
