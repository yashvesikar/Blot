const client = require("models/client");
const ensure = require("helper/ensure");
const key = require("./key");

module.exports = async function getPopular(blogID, limit = 10, callback) {
  try {
    ensure(blogID, "string").and(callback, "function");

    // Get all tags
    const allTags = await new Promise((resolve, reject) => {
      client.smembers(key.all(blogID), (err, result) => {
        if (err) return reject(err);
        resolve(result || []);
      });
    });

    if (allTags.length === 0) {
      return callback(null, []); // No tags to process
    }

    // Batch all SCARD commands
    const counts = await new Promise((resolve, reject) => {
      const batch = client.batch();
      allTags.forEach(tag => {
        batch.scard(key.tag(blogID, tag));
      });
      batch.exec((err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Get top N tags
    const topTags = allTags
      .map((tag, i) => ({ tag, count: counts[i] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Batch fetch details for top tags
    const details = await new Promise((resolve, reject) => {
      const batch = client.batch();
      topTags.forEach(({ tag }) => {
        batch.smembers(key.tag(blogID, tag));
        batch.get(key.name(blogID, tag));
      });
      batch.exec((err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    // Process results
    const tags = [];
    for (let i = 0; i < topTags.length; i++) {
      const entries = details[i * 2];
      const name = details[i * 2 + 1];
      const { tag, count } = topTags[i];

      if (entries && entries.length > 0) {
        tags.push({
          name: name || "",
          slug: tag,
          entries,
          count
        });
      }
    }

    return callback(null, tags);
  } catch (error) {
    return callback(error);
  }
};