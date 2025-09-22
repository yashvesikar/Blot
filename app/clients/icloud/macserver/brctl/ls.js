const exec = require("../exec");

module.exports = async (dirPath) => {
  let contents;

  try {
    const { stdout, stderr } = await exec("ls", ["-la1F", dirPath]);
    if (stderr) {
      throw new Error(`Error listing directory ${dirPath}: ${stderr}`);
    }
    contents = stdout;
  } catch (error) {
    // this error is expected if the directory is not downloaded
    if (error && !error.message.includes("Resource deadlock avoided")) {
      console.error(`Error listing directory ${dirPath}: ${error.message}`);
      return;
    }

    try {
      // we need to try to download the directory first
      console.log(`Directory not downloaded, downloading: ${dirPath}`);
      await exec("brctl", ["download", dirPath]);
      // wait a moment for the download to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log(`Downloaded directory: ${dirPath}`);

      // re-attempt the ls
      const { stdout, stderr } = await exec("ls", ["-la1F", dirPath]);
      if (stderr) {
        throw new Error(`Error listing directory ${dirPath}: ${stderr}`);
      }
      contents = stdout;
    } catch (error) {
      console.error(
        `Error listing directory ${dirPath} after download: ${error.message}`
      );
      return;
    }
  }

  return contents;
};
