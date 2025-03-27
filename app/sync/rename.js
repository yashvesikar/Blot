const drop = require("./update/drop");
const mkdir = require("./update/mkdir");
const Entry = require("models/entry");
const ensure = require("helper/ensure");
const fs = require("fs-extra");
const localPath = require("helper/localPath");
const clfdate = require("helper/clfdate");
const basename = require("path").basename;

const rename = (blog, log) => (path, oldPath, options, callback) => {
  ensure(blog, "object")
    .and(log, "function")
    .and(path, "string")
    .and(oldPath, "string")
    .and(options, "object")
    .and(callback, "function");

  log(clfdate(), blog.id.slice(0, 12), "rename", oldPath);
  log(clfdate(), blog.id.slice(0, 12), "----->", path);

  fs.stat(localPath(blog.id, path), function (err, stat) {
    if (err) return callback(err);

    if (stat.isDirectory()) return mkdir(blog.id, path, options, callback);

    Entry.get(blog.id, oldPath, function (deletedEntry) {
      if (!deletedEntry) {
        console.log(
          "Warning: No entry found at " +
            oldPath +
            " when trying to rename it to " +
            path
        );
        return callback();
      }

      drop(blog.id, oldPath, options, function (err) {
        if (err) return callback(err);

        Entry.set(
          blog.id,
          path,
          {
            ...deletedEntry,
            path,
            id: path,
            pathDisplay: path,
            name: basename(path),
          },
          callback
        );
      });
    });
  });
};

module.exports = rename;
