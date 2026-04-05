import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const githubInstallCallback = async (req, res) => {
  try {
    const { installation_id, token } = req.query;

    console.log("📥 Install Callback HIT:", installation_id);

    if (!installation_id || !token) {
      return res.redirect(`${process.env.FRONTEND_URL}/error`);
    }

    // 🔐 Decode user from token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login`);
    }

    // 🔥 SAVE installationId
    user.installationId = installation_id;
    await user.save();

    console.log("✅ Installation saved:", installation_id);

    // ✅ Redirect back to dashboard
    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?installation_id=${installation_id}`
    );

  } catch (err) {
    console.log("❌ Install callback error:", err.message);
    return res.redirect(`${process.env.FRONTEND_URL}/error`);
  }
};
