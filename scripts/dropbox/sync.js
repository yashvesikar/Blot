var resetToBlot = require("clients/dropbox/sync/reset-to-blot");
var get = require("../get/blog");
var each = require("../each/blog");
var async = require("async");
console.warn("Warning: this uses an internal method of the Dropbox client.");
console.log('Consider debugging with "export DEBUG=clients:dropbox*"');
var fixEntryDates = require("./fix-entry-dates");

function runFullSync(blog, callback) {
  var publish = function () {
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(
      console,
      ["Dropbox sync", blog.title, blog.id + ":"].concat(args)
    );
  };

  resetToBlot(blog.id, publish).then(
    function () {
      callback();
    },
    function (err) {
      callback(err);
    }
  );
}

function main(blog, next) {
  console.log("Syncing", blog.title, blog.id, new Date(blog.cacheID));
  runFullSync(blog, async function (err) {
    if (err) {
      console.error(
        "Error syncing blog",
        blog.title,
        blog.id,
        "-",
        err.message || err
      );
      return next();
    }

    try {
      await fixEntryDates(blog.id);
    } catch (fixErr) {
      console.error(
        "Error fixing entry dates for blog",
        blog.title,
        blog.id,
        "-",
        fixErr.message || fixErr
      );
    }

    next();
  });
}

if (process.argv[2]) {
  get(process.argv[2], function (err, user, blog) {
    if (err) throw err;
    main(blog, function (err) {
      if (err) {
        console.error("Sync finished with error", err.message || err);
      }
      console.log("Done!");
      process.exit();
    });
  });
} else {
  var blogs = [];

  each(
    function (user, blog, next) {
      if (blog && !blog.isDisabled && blog.client === "dropbox")
        blogs.push(blog);

      next();
    },
    function () {
      // Sort blogs to sync least recently synced first
      blogs.sort(function (a, b) {
        return a.cacheID > b.cacheID ? 1 : -1;
      });

      async.eachSeries(blogs, main, function (err) {
        if (err) {
          console.error("Sync finished with error", err.message || err);
        }

        console.log("Done!");
        process.exit();
      });
    }
  );
}
