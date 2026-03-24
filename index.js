const express = require("express");
const app = express();
const axios = require("axios");
const os = require('os');
const fs = require("fs");
const path = require("path");
const net = require('net');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// --- 基础配置 ---
// Xserver 常用 25565 跑游戏，我们用 25575 跑 Web 界面
const PORT = process.env.SERVER_PORT || process.env.PORT || 25575; 
const FILE_PATH = process.env.FILE_PATH || './tmp';
const SUB_PATH = process.env.SUB_PATH || 'sub';
const UUID = process.env.UUID || '9afd1229-b893-40c1-84dd-51e7ce204913';

// --- Komari 变量 ---
const NEZHA_SERVER = process.env.NEZHA_SERVER || 'https://komari.afnos86.xx.kg'; 
const NEZHA_KEY = process.env.NEZHA_KEY || 'RwHYwef7yYHT6hRTylfRzz';       

// --- Argo 变量 ---
const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'xserver.afnos.eu.cc';
const ARGO_AUTH = process.env.ARGO_AUTH || 'eyJhIjoiZjZhMGEwMjdiZmJiOGEwZjAwODUzOWY2NmQ1MmU2NWUiLCJ0IjoiNGU1M2M3YjEtM2QzNi00NzkyLTllNmUtYjJiOTUxMWU5OWE1IiwicyI6IllUSmpZMlk1TURBdFkyWTJPUzAwTTJFekxXRTRZV0V0TVRNMVlXVTRPR05rWVRWaSJ9';
const ARGO_PORT = 8001; 
const CFIP = process.env.CFIP || 'cdns.doon.eu.org';
const CFPORT = process.env.CFPORT || 443;
const NAME = process.env.NAME || '';

if (!fs.existsSync(FILE_PATH)) fs.mkdirSync(FILE_PATH, { recursive: true });

const npmName = "komari_agent";
const webName = "xray_bin";
const botName = "argo_bin";
const npmPath = path.join(FILE_PATH, npmName);
const webPath = path.join(FILE_PATH, webName);
const botPath = path.join(FILE_PATH, botName);
const bootLogPath = path.join(FILE_PATH, 'boot.log');

// --- 核心：防暂停/防睡眠逻辑 ---
function startAntiSleep() {
    // 1. 定时控制台心跳，干扰空闲检测
    setInterval(() => {
        console.log(`[Heartbeat] Active at ${new Date().toLocaleTimeString()}`);
    }, 40000);

    // 2. 模拟本地玩家连接（关键！针对 Xserver 暂停机制）
    setInterval(() => {
        const client = new net.Socket();
        client.setTimeout(2000);
        // 尝试连接游戏端口 25565
        client.connect(25565, '127.0.0.1', () => {
            client.destroy(); 
        });
        client.on('error', () => {}); // 忽略报错（游戏没开时会报错）
    }, 50000);
}

// 根目录
app.get("/", (req, res) => res.send("Hello world!"));

async function getKomariUrl(arch) {
    try {
        const res = await axios.get('https://api.github.com/repos/komari-monitor/komari-agent/releases/latest', { timeout: 10000 });
        const asset = res.data.assets.find(a => a.name.toLowerCase().includes('linux') && a.name.toLowerCase().includes(arch) && !a.name.endsWith('.sha256'));
        return asset ? asset.browser_download_url : null;
    } catch (e) { return `https://github.com/komari-monitor/komari-agent/releases/download/v1.1.40/komari-agent-linux-${arch}`; }
}

async function download(name, url, savePath) {
    if (!url) return;
    try {
        const writer = fs.createWriteStream(savePath);
        const response = await axios({ method: 'get', url: url, responseType: 'stream', timeout: 60000 });
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => { fs.chmodSync(savePath, 0o775); console.log(`[OK] ${name} downloaded.`); resolve(); });
            writer.on('error', reject);
        });
    } catch (e) { console.error(`[Error] ${name} download failed: ${e.message}`); }
}

async function main() {
    const isArm = os.arch().includes('arm');
    const arch = isArm ? 'arm64' : 'amd64';
    
    const xrayUrl = isArm ? "https://arm64.ssss.nyc.mn/web" : "https://amd64.ssss.nyc.mn/web";
    const argoUrl = isArm ? "https://arm64.ssss.nyc.mn/bot" : "https://amd64.ssss.nyc.mn/bot";
    
    await download('Xray', xrayUrl, webPath);
    await download('Argo', argoUrl, botPath);
    if (NEZHA_SERVER && NEZHA_KEY) {
        const komariUrl = await getKomariUrl(arch);
        await download('Komari', komariUrl, npmPath);
    }

    // 1. 启动 Xray
    if (fs.existsSync(webPath)) {
        const config = {
            log: { loglevel: 'none' },
            inbounds: [
                {
                    port: ARGO_PORT, listen: "127.0.0.1", protocol: "vless",
                    settings: { clients: [{ id: UUID }], decryption: "none" },
                    streamSettings: { network: "ws", wsSettings: { path: "/vless-argo" } }
                }
            ],
            outbounds: [{ protocol: "freedom" }]
        };
        fs.writeFileSync(path.join(FILE_PATH, 'config.json'), JSON.stringify(config));
        exec(`nohup ${webPath} -c ${FILE_PATH}/config.json >/dev/null 2>&1 &`);
        console.log("[System] Xray binary executed.");
    }

    // 2. 启动 Komari
    if (fs.existsSync(npmPath) && NEZHA_SERVER && NEZHA_KEY) {
        exec(`nohup ${npmPath} -e ${NEZHA_SERVER} -t ${NEZHA_KEY} >/dev/null 2>&1 &`);
    }

    // 3. 启动 Argo
    if (fs.existsSync(botPath)) {
        let argoArgs = ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/) 
            ? `tunnel --no-autoupdate --protocol http2 run --token ${ARGO_AUTH}`
            : `tunnel --no-autoupdate --protocol http2 --logfile ${bootLogPath} --url http://localhost:${ARGO_PORT}`;
        exec(`nohup ${botPath} ${argoArgs} >/dev/null 2>&1 &`);
        console.log("[System] Argo tunnel starting...");
    }

    // 4. 生成链接
    setTimeout(() => {
        let domain = ARGO_DOMAIN;
        if (domain) {
            const nodeName = NAME || 'Komari-Node';
            const vlessSub = `vless://${UUID}@${CFIP}:${CFPORT}?encryption=none&security=tls&sni=${domain}&type=ws&host=${domain}&path=%2Fvless-argo#${nodeName}`;
            app.get(`/${SUB_PATH}`, (req, res) => res.send(Buffer.from(vlessSub).toString('base64')));
            console.log(`[Success] Node ready on ${domain}`);
        }
    }, 15000);

    // 启动防睡眠循环
    startAntiSleep();
}

main().catch(e => console.error(e));
app.listen(PORT, () => console.log(`Express active on port ${PORT}`));
