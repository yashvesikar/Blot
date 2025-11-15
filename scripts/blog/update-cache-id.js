// docker exec -it blot-node-app-1 node scripts/blog/update-cache-id.js [blog-identifier]
// Updates the cacheID for blogs to Date.now()
//
// If a blog identifier is provided (handle, domain, or ID), updates only that blog.
// Otherwise, iterates over all blogs in series.
//
// This script:
// 1. Iterates over all blogs in series (or updates a single blog if identifier provided)
// 2. Sets each blog's cacheID to Date.now()
// 3. Reports progress and completion statistics

const eachBlog = require("../each/blog");
const getBlog = require("../get/blog");
const Blog = require("models/blog");
const { promisify } = require("util");

const blogSetAsync = promisify(Blog.set);
const getBlogAsync = (identifier) =>
  new Promise((resolve, reject) => {
    getBlog(identifier, function (err, user, blog) {
      if (blog) resolve(blog);
      reject(new Error("No blog: " + identifier));
    });
  });

async function updateSingleBlog(blogID, handle) {
  try {
    const newCacheID = Date.now();
    await blogSetAsync(blogID, { cacheID: newCacheID });
    console.log(
      `✅ Updated cacheID for blog ${blogID} (${handle || "no handle"})`
    );
    return { success: true };
  } catch (err) {
    console.error(
      `❌ Failed to update cacheID for blog ${blogID} (${
        handle || "no handle"
      }):`,
      err.message
    );
    return { success: false, error: err.message };
  }
}

async function updateAllBlogs() {
  console.log("Starting cacheID update for all blogs...");
  console.log("Iterating over all blogs in series...\n");

  let totalBlogs = 0;
  let updatedBlogs = 0;
  let failedBlogs = 0;
  const errors = [];

  await new Promise((resolve, reject) => {
    eachBlog(
      async function (user, blog, nextBlog) {
        totalBlogs++;

        try {
          const newCacheID = Date.now();
          await blogSetAsync(blog.id, { cacheID: newCacheID });
          updatedBlogs++;

          if (totalBlogs % 100 === 0) {
            console.log(
              `Progress: ${totalBlogs} blogs processed, ${updatedBlogs} updated...`
            );
          }

          nextBlog();
        } catch (err) {
          console.error(
            `Failed to update cacheID for blog ${blog.id} (${
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
  console.log("Update complete:");
  console.log(`  Total blogs processed: ${totalBlogs}`);
  console.log(`  Blogs updated: ${updatedBlogs}`);
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
    console.log("\n⚠️  Some updates failed. Review errors above.");
    return 1;
  }

  console.log("\n✅ All blogs updated successfully!");
  return 0;
}

async function updateCacheID(identifier) {
  if (identifier) {
    // Update a single blog
    console.log(`Updating cacheID for blog: ${identifier}\n`);

    try {
      const blog = await getBlogAsync(identifier);
      if (!blog) {
        console.error(`❌ Blog not found: ${identifier}`);
        return 1;
      }

      const result = await updateSingleBlog(blog.id, blog.handle);
      return result.success ? 0 : 1;
    } catch (err) {
      console.error(`❌ Error loading blog ${identifier}:`, err.message);
      return 1;
    }
  } else {
    // Update all blogs
    return await updateAllBlogs();
  }
}

if (require.main === module) {
  const identifier = process.argv[2];
  updateCacheID(identifier)
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((err) => {
      console.error("Update failed:", err);
      process.exit(1);
    });
}

module.exports = updateCacheID;
