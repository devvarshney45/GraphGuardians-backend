import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const tgConfig = {
    host: process.env.TG_URL,
    graph: process.env.TG_GRAPH,
    secret: process.env.TG_SECRET
};

let cachedToken = null;

/**
 * Token fetch karne ke liye function
 */
export async function getAccessToken() {
    // Agar token pehle se hai, toh wahi return karo
    if (cachedToken) return cachedToken;

    try {
        const url = `${tgConfig.host}/gsqlserver/gsql/privileged/token`;
        
        const response = await axios.post(url, {
            secret: tgConfig.secret,
            graph: tgConfig.graph,
            lifetime: "1000000"
        });

        if (response.data.error === false) {
            console.log("✅ TigerGraph: Token generated successfully!");
            cachedToken = response.data.token;
            return cachedToken;
        } else {
            throw new Error(response.data.message);
        }
    } catch (error) {
        console.error("❌ TigerGraph Error:", error.response?.data || error.message);
        throw error;
    }
}

/**
 * Kisi bhi Graph Query ko run karne ke liye helper
 */
export async function runQuery(queryName, params = {}) {
    try {
        const token = await getAccessToken();
        const url = `${tgConfig.host}/restpp/query/${tgConfig.graph}/${queryName}`;

        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: params
        });

        return res.data;
    } catch (error) {
        console.error(`❌ Query ${queryName} failed:`, error.message);
        throw error;
    }
}