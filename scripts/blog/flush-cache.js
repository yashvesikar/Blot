// docker exec -it blot-node-app-1 node scripts/blog/update-cache-id.js [blog-identifier]
// Flushes the cache for blogs
//
// If a blog identifier is provided (handle, domain, or ID), flushes cache only for that blog.
// Otherwise, iterates over all blogs in series and flushes cache for each.
//
// This script:
// 1. Iterates over all blogs in series (or flushes a single blog if identifier provided)
// 2. Calls flushCache directly for each blog
// 3. Reports progress and completion statistics

const eachBlog = require("../each/blog");
const getBlog = require("../get/blog");
const flushCache = require("models/blog/flushCache");
const { promisify } = require("util");

const flushCacheAsync = promisify(flushCache);
const getBlogAsync = (identifier) =>
  new Promise((resolve, reject) => {
    getBlog(identifier, function (err, user, blog) {
      if (blog) resolve(blog);
      reject(new Error("No blog: " + identifier));
    });
  });

async function flushSingleBlog(blogID, handle) {
  try {
    await flushCacheAsync(blogID);
    console.log(
      `✅ Flushed cache for blog ${blogID} (${handle || "no handle"})`
    );
    return { success: true };
  } catch (err) {
    console.error(
      `❌ Failed to flush cache for blog ${blogID} (${handle || "no handle"}):`,
      err.message
    );
    return { success: false, error: err.message };
  }
}

async function flushAllBlogs() {
  console.log("Starting cache flush for all blogs...");
  console.log("Iterating over all blogs in series...\n");

  let totalBlogs = 0;
  let flushedBlogs = 0;
  let failedBlogs = 0;
  const errors = [];

  await new Promise((resolve, reject) => {
    eachBlog(
      async function (user, blog, nextBlog) {
        totalBlogs++;

        try {
          await flushCacheAsync(blog.id);
          flushedBlogs++;

          if (totalBlogs % 100 === 0) {
            console.log(
              `Progress: ${totalBlogs} blogs processed, ${flushedBlogs} flushed...`
            );
          }

          nextBlog();
        } catch (err) {
          console.error(
            `Failed to flush cache for blog ${blog.id} (${
              blog.handle || "no handle"
            }):`,
            err.message
          );
          failedBlogs++;
          errors.push({
            blogID: blog.id,
            handle: blog.handle,
            error: err.message,
          });
          nextBlog();
        }
      },
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });

  console.log("\n" + "=".repeat(60));
  console.log("Flush complete:");
  console.log(`  Total blogs processed: ${totalBlogs}`);
  console.log(`  Blogs flushed: ${flushedBlogs}`);
  console.log(`  Blogs failed: ${failedBlogs}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.slice(0, 10).forEach((error) => {
      console.log(
        `  Blog ${error.blogID} (${error.handle || "no handle"}): ${
          error.error
        }`
      );
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }

  if (failedBlogs > 0) {
    console.log("\n⚠️  Some flushes failed. Review errors above.");
    return 1;
  }

  console.log("\n✅ All blogs flushed successfully!");
  return 0;
}

async function flushCacheForBlog(identifier) {
  if (identifier) {
    // Flush a single blog
    console.log(`Flushing cache for blog: ${identifier}\n`);

    try {
      const blog = await getBlogAsync(identifier);
      if (!blog) {
        console.error(`❌ Blog not found: ${identifier}`);
        return 1;
      }

      const result = await flushSingleBlog(blog.id, blog.handle);

      // wait for flush to clear
      console.log("waiting");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      console.log("waited");

      return result.success ? 0 : 1;
    } catch (err) {
      console.error(`❌ Error loading blog ${identifier}:`, err.message);
      return 1;
    }
  } else {
    // Flush all blogs
    await flushAllBlogs();

    // wait for flush to clear
    console.log("waiting a few minutes...");
    await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
    console.log("waited");
    return;
  }
}

if (require.main === module) {
  const identifier = process.argv[2];
  flushCacheForBlog(identifier)
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((err) => {
      console.error("Flush failed:", err);
      process.exit(1);
    });
}

module.exports = flushCacheForBlog;
