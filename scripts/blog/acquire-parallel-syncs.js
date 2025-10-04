const Sync = require("sync");
const establishSyncLock = require("clients/icloud/util/establishSyncLock");

const get = require("../get/blog");

get(process.argv[2], async function (err, user, blog) {
  if (err) throw err;

  console.log("attempting to acquire multiple traditional callback-syncs");

  const totalSyncs = 10;

  //   Sync(blog.id, function (err, folder, done) {
  //     if (err) return callback(err);

  //     console.log("acquired sync lock for blog", blog.id);
  //     done(null, () => {
  //       console.log("released sync lock for blog", blog.id);
  //     });
  //   });

  let acquired = 0;
  let completed = 0;

  for (let i = 0; i < totalSyncs; i++) {
    Sync(blog.id, function (err, folder, done) {
      if (err) {
        console.log("failed to acquire sync lock for blog", blog.id, err);
        completed++;
        return;
      }

      acquired++;
      console.log("acquired sync lock for blog", blog.id, acquired);

      setTimeout(() => {
        done(null, () => {
          completed++;
          console.log("released sync lock for blog", blog.id);
        });
      }, 2000);
    });
  }

  console.log("started", totalSyncs, "syncs");
  console.log("waiting to acquire sync lock for blog", blog.id);

  const interval = setInterval(() => {
    if (completed === totalSyncs) {
      console.log("all syncs complete");
      clearInterval(interval);
      useAsync();
    }
  }, 1000);

  const useAsync = async () => {
    console.log("attempting to acquire multiple async-await-syncs");
    console.log();
    console.log();
    console.log();
    await Promise.all(
      [...Array(totalSyncs).keys()].map(async (i) => {
        // Establish sync lock to allow safe file operations
        console.log("waiting to acquire sync lock for blog", blog.id, i + 1);
        try {
          const { done } = await establishSyncLock(blog.id);
          console.log("acquired sync lock for blog", blog.id, i + 1);

          setTimeout(() => {
            done();
            console.log("released sync lock for blog", blog.id, i + 1);
          }, 2000);
        } catch (err) {
          console.log(err);
        }
      })
    );
    console.log("all async-await-syncs complete");
    process.exit();
  };
});
