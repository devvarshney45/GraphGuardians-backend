import cron from "node-cron";

export const startCron = () => {
  cron.schedule("0 * * * *", () => {
    console.log("Running scheduled scan...");
  });
};