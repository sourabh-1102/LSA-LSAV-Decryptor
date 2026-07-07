const { execSync } = require("child_process");

const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const isNetlify = process.env.NETLIFY === "true";
const isCI = process.env.CI === "true";

try {
  console.log("==================================================");

  if (isVercel) {
    console.log("Vercel environment detected.");
    console.log("Installing frontend dependencies only...");
    console.log("==================================================");

    execSync("npm install --prefix client", {
      stdio: "inherit",
    });
  } else if (isNetlify) {
    console.log("Netlify environment detected.");
    console.log("Installing frontend dependencies only...");
    console.log("==================================================");

    execSync("npm install --prefix client", {
      stdio: "inherit",
    });
  } else if (isCI) {
    console.log("CI environment detected.");
    console.log("Installing frontend dependencies only...");
    console.log("==================================================");

    execSync("npm install --prefix client", {
      stdio: "inherit",
    });
  } else {
    console.log("Local development environment detected.");
    console.log("Installing client and server dependencies...");
    console.log("==================================================");

    execSync("npm install --prefix client", {
      stdio: "inherit",
    });

    execSync("npm install --prefix server", {
      stdio: "inherit",
    });
  }

  console.log("==================================================");
  console.log("Dependency installation completed successfully.");
  console.log("==================================================");
} catch (error) {
  console.error("Postinstall dependency installation failed.");
  console.error(error);
  process.exit(1);
}