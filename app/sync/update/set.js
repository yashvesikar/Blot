var rebuildDependents = require("./rebuildDependents");
var Ignore = require("./ignore");
var Entry = require("models/entry");
var Preview = require("./preview");
var isPreview = require("./drafts").isPreview;
var async = require("async");
var WRONG_TYPE = "WRONG_TYPE";
var PUBLIC_FILE = "PUBLIC_FILE";
var isHidden = require("build/prepare/isHidden");
var build = require("build");
var pathNormalizer = require("helper/pathNormalizer");

function isPublic(path) {
  const normalizedPath = pathNormalizer(path).toLowerCase();
  return (
    // blot specific rule not to turn files inside
    // a folder called public into blog posts
    normalizedPath.startsWith("/public/") ||
    // blot specific rule to ignore files and folders
    // whose name begins with an underscore
    normalizedPath.includes("/_") ||
    // convention to ingore dotfiles or folders
    normalizedPath.includes("/.")
  );
}

function isTemplate(path) {
  return pathNormalizer(path).toLowerCase().startsWith("/templates/");
}

function buildAndSet(blog, path, callback) {
  build(blog, path, function (err, entry) {
    if (err && err.code === "WRONGTYPE")
      return Ignore(blog.id, path, WRONG_TYPE, callback);

    if (err) return callback(err);

    Entry.set(blog.id, entry.path, entry, function (err) {
      if (err) return callback(err);
      // This file is a draft, write a preview file
      // to the users Dropbox and continue down
      // We look up the remote path later in this module...
      if (entry.draft && !isHidden(entry.path)) {
        Preview.write(blog.id, path, callback);
      } else {
        callback();
      }
    });
  });
}

module.exports = function (blog, path, callback) {
  // if typoeof callback is not function, throw error
  if (typeof callback !== "function") {
    throw new Error("sync.set: callback must be a function");
  }

  // if typeof blog is not object, return error
  if (typeof blog !== "object") {
    return callback(new Error("sync.set: blog must be an object"));
  }

  // if typeof path is not string, return error
  if (typeof path !== "string") {
    return callback(new Error("sync.set: path must be a string"));
  }

  path = pathNormalizer(path);

  var queue = {};

  isPreview(blog.id, path, function (err, is_preview) {
    if (err) return callback(err);

    // The file is public. Its name begins
    // with an underscore, or it's inside a folder
    // whose name begins with an underscore. It should
    // therefore not be a blog post.
    if (isPublic(path)) {
      queue.ignore = Ignore.bind(this, blog.id, path, PUBLIC_FILE);
    }

    // This file should become a blog post or page!
    if (!isPublic(path) && !isTemplate(path) && !is_preview) {
      queue.buildAndSet = buildAndSet.bind(this, blog, path);
    }

    async.parallel(queue, function (err) {
      if (err) return callback(err);
      rebuildDependents(blog.id, path, callback);
    });
  });
};
