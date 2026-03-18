export const suggestFix = async (req, res) => {
  try {
    const { packageName, currentVersion, severity } = req.body;

    if (!packageName) {
      return res.status(400).json({ msg: "packageName required" });
    }

    // 🔥 simple smart logic
    const command = `npm install ${packageName}@latest`;

    // 🧠 impact estimation
    let impact = "Low impact";

    if (severity === "CRITICAL") impact = "Fixes critical security risk";
    else if (severity === "HIGH") impact = "Fixes high severity issue";
    else impact = "Improves package security";

    res.json({
      package: packageName,
      currentVersion,
      fixCommand: command,
      impact,
      note: "Always test after updating dependencies"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
