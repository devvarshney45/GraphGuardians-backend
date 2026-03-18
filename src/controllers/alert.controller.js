import Alert from "../models/alert.model.js";

export const getAlerts = async (req, res) => {
  res.json(await Alert.find());
};