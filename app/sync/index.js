const buildFromFolder = require("models/template").buildFromFolder;
const Blog = require("models/blog");
const Update = require("./update");
const localPath = require("helper/localPath");
const renames = require("./renames");
const lockfile = require("proper-lockfile");
const messenger = require("./messenger");

const LOCK_STALE_TIMEOUT_MS = 10 * 1000;
const LOCK_UPDATE_INTERVAL_MS = 3 * 1000; // lowered from 5s to avoid ECOMPROMISED errors?
const PROCESS_STARTED = Date.now();

function sync(blogID, callback) {
  if (typeof blogID !== "string") {
    throw new TypeError("Expected blogID with type:String as first argument");
  }

  if (typeof callback !== "function") {
    throw new TypeError(
      "Expected callback with type:Function as second argument"
    );
  }

  Blog.get({ id: blogID }, async function (err, blog) {
    if (err || !blog || !blog.id || blog.isDisabled) {
      return callback(new Error("Cannot sync blog " + blogID));
    }

    const { log, status } = messenger(blog);

    log("Starting sync");

    let release;

    try {
      log("Acquiring lock on folder");

      // Only retry at startup to handle stale locks from killed processes
      const timeSinceStart = Date.now() - PROCESS_STARTED;
      const retries =
        timeSinceStart < LOCK_STALE_TIMEOUT_MS
          ? { retries: 1, minTimeout: LOCK_STALE_TIMEOUT_MS + 1000 } // 11s total
          : { retries: 3, minTimeout: 750 }; // 0.75s, 1.5s, 3s = 5.25s total

      release = await lockfile.lock(localPath(blogID, "/"), {
        stale: LOCK_STALE_TIMEOUT_MS,
        update: LOCK_UPDATE_INTERVAL_MS,
        retries,
      });
      log("Successfully acquired lock on folder");
    } catch (e) {
      log("Failed to acquire lock on folder");
      return callback(new Error("Failed to acquire folder lock"));
    }

    // we want to know if folder.update or folder.rename is called
    let changes = false;
    let _update = new Update(blog, log, status);
    let path = localPath(blogID, "/");

    // Right now localPath returns a path with a trailing slash for some
    // crazy reason. This means that we need to remove the trailing
    // slash for this to work properly. In future, you should be able
    // to remove this line when localPath works properly.
    if (path.slice(-1) === "/") path = path.slice(0, -1);

    const folder = {
      path,
      update: function () {
        changes = true;
        _update.apply(_update, arguments);
      },
      status,
      log,
    };

    // We acquired a lock on the resource!
    // This function is to be called when we are finished
    // with the lock on the user's folder.
    folder.status("Syncing");

    // Pass methods to trigger folder updates back to the
    // function which wanted to modify the blog's folder.
    callback(null, folder, function (syncError, callback) {
      log("Sync callback invoked");
      folder.status("Synced");

      if (typeof syncError === "function")
        throw new Error("Pass an error or null as first argument to done");

      if (typeof callback !== "function")
        throw new Error("Pass a callback to done");

      log("Checking for renamed files");
      renames(blogID, async function (err) {
        if (err) {
          folder.status("Error checking file renames");
          log("Error checking file renames");
          console.log(err);
        }

        log("Building templates from folder");
        buildFromFolder(blogID, async function (err) {
          if (err) {
            folder.status("Error building templates from folder");
            log("Error building templates in folder");
            console.log(err);
          }

          // We could do these next two things in parallel
          // but it's a little bit of refactoring...
          log("Releasing lock");
          await release();
          log("Finished sync");

          if (!changes) {
            return callback(syncError);
          }

          log("Updating cacheID of blog");
          Blog.set(blogID, { cacheID: Date.now() }, async function (err) {
            if (err) {
              log("Error updating cacheID of blog");
            }
            callback(syncError);
          });
        });
      });
    });
  });
}

module.exports = sync;
