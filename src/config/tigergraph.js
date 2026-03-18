import axios from "axios";

const TG_URL = process.env.TIGERGRAPH_URL;
const USERNAME = process.env.TIGERGRAPH_USERNAME;
const PASSWORD = process.env.TIGERGRAPH_PASSWORD;

let authToken = null;

// 🔐 Login and get token
export const getTigerGraphToken = async () => {
  try {
    const res = await axios.post(`${TG_URL}/requesttoken`, null, {
      auth: {
        username: USERNAME,
        password: PASSWORD
      }
    });

    authToken = res.data?.results?.token;
    return authToken;

  } catch (err) {
    console.log("TigerGraph Auth Error:", err.message);
  }
};

// 🔗 Get headers
export const getTGHeaders = async () => {
  if (!authToken) {
    await getTigerGraphToken();
  }

  return {
    Authorization: `Bearer ${authToken}`
  };
};