#!/usr/bin/env node
"use strict";
/**
 * antigravity-acp
 * ACP (Agent Client Protocol) adapter wrapping Google Antigravity CLI (`agy`).
 * Reads JSON-RPC 2.0 NDJSON over stdio and forwards prompts to `agy` CLI.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const LOG_FILE = path.join(__dirname, "..", "debug.log");
function logDebug(msg) {
    try {
        const timestamp = new Date().toISOString();
        fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
    }
    catch (_e) {
        // Ignore file log errors gracefully
    }
}
logDebug("--- ACP Adapter Started ---");
// If run interactively in a terminal, print a friendly status message to stderr (leaving stdout pure for JSON-RPC)
if (process.stdin.isTTY) {
    process.stderr.write("🤖 Antigravity ACP Server is running and listening for JSON-RPC 2.0 over stdio.\n" +
        "👉 To list available models, run: buzz-antigravity-acp models\n" +
        "👉 When used by Buzz Desktop, Buzz communicates with this process automatically.\n\n");
}
function resolveAgyExecutable() {
    // 1. Try finding via system where.exe (Windows) or which (Unix)
    try {
        const lookupCmd = process.platform === "win32" ? "where.exe agy" : "which agy";
        const foundPath = (0, child_process_1.execSync)(lookupCmd, { env: process.env, stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .split(/\r?\n/)[0]
            ?.trim();
        if (foundPath && fs.existsSync(foundPath)) {
            logDebug(`RESOLVED agy via CLI lookup >>> ${foundPath}`);
            const dir = path.dirname(foundPath);
            if (process.env.PATH && !process.env.PATH.includes(dir)) {
                process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
            }
            return foundPath;
        }
    }
    catch (_e) {
        // Continue to candidate list below
    }
    // 2. Scan standard install locations
    const candidates = [];
    if (process.platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData) {
            candidates.push(path.join(localAppData, "agy", "bin", "agy.exe"));
            candidates.push(path.join(localAppData, "Programs", "agy", "bin", "agy.exe"));
            candidates.push(path.join(localAppData, "Google", "Antigravity", "bin", "agy.exe"));
        }
        const appData = process.env.APPDATA;
        if (appData) {
            candidates.push(path.join(appData, "npm", "agy.cmd"));
            candidates.push(path.join(appData, "npm", "agy.exe"));
        }
        const userProfile = process.env.USERPROFILE;
        if (userProfile) {
            candidates.push(path.join(userProfile, "AppData", "Local", "agy", "bin", "agy.exe"));
            candidates.push(path.join(userProfile, ".local", "bin", "agy.exe"));
            candidates.push(path.join(userProfile, ".local", "bin", "agy"));
            candidates.push(path.join(userProfile, "agy", "bin", "agy.exe"));
            candidates.push(path.join(userProfile, ".cargo", "bin", "agy.exe"));
        }
        candidates.push("agy.exe", "agy.cmd", "agy.bat", "agy");
    }
    else {
        const home = process.env.HOME;
        if (home) {
            candidates.push(path.join(home, ".local", "bin", "agy"));
            candidates.push(path.join(home, ".cargo", "bin", "agy"));
            candidates.push(path.join(home, ".agy", "bin", "agy"));
        }
        candidates.push("/usr/local/bin/agy", "/opt/homebrew/bin/agy", "/usr/bin/agy", "agy");
    }
    for (const candidate of candidates) {
        if (path.isAbsolute(candidate)) {
            try {
                if (fs.existsSync(candidate)) {
                    logDebug(`RESOLVED agy via candidate list >>> ${candidate}`);
                    const dir = path.dirname(candidate);
                    if (process.env.PATH && !process.env.PATH.includes(dir)) {
                        process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
                    }
                    return candidate;
                }
            }
            catch (_e) {
                // Ignore filesystem check errors
            }
        }
    }
    return process.platform === "win32" ? "agy.exe" : "agy";
}
function getAvailableModels() {
    const agyExec = resolveAgyExecutable();
    const availableModels = [];
    try {
        const rawOutput = (0, child_process_1.execSync)(`"${agyExec}" models`, {
            env: process.env,
            timeout: 10000,
            encoding: "utf-8",
        }).toString();
        const lines = rawOutput.split("\n");
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("Fetching"))
                continue;
            const parts = trimmed.split("\t");
            if (parts.length >= 2) {
                const modelId = parts[0].trim();
                const name = parts[1].trim();
                availableModels.push({
                    modelId,
                    name,
                    description: `Google Antigravity ${name}`
                });
            }
        }
        logDebug(`FETCH MODELS >>> dynamically fetched ${availableModels.length} models from agy CLI`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logDebug(`FETCH MODELS ERR >>> failed to query agy models (${msg})`);
        if (msg.includes("ENOENT")) {
            throw new Error(`Google Antigravity CLI ('agy') is not installed or not found on PATH. ` +
                `Please install Google Antigravity CLI, ensure 'agy' is on your PATH, and run 'agy auth login'.`);
        }
        throw new Error(`Failed to fetch Google Antigravity models: ${msg}. Please ensure 'agy' is authenticated via 'agy auth login'.`);
    }
    if (availableModels.length === 0) {
        throw new Error("No models returned by Google Antigravity CLI ('agy models'). Please run 'agy auth login' to authenticate.");
    }
    return availableModels;
}
// CLI command model discovery query handler for Buzz
if (process.argv.includes("models") || process.argv.includes("--models")) {
    logDebug("CLI QUERY >>> models command requested");
    try {
        const models = getAvailableModels();
        const modelResponse = {
            agent: {
                name: "Antigravity",
                version: "0.1.0"
            },
            stable: {
                configOptions: [
                    {
                        configId: "model",
                        category: "model",
                        displayName: "Model",
                        options: models.map(m => ({
                            value: m.modelId,
                            displayName: m.name
                        }))
                    }
                ]
            },
            unstable: {
                currentModelId: models[0]?.modelId || "gemini-3.7-flash-high",
                availableModels: models
            }
        };
        logDebug(`CLI QUERY OUT >>> ${JSON.stringify(modelResponse)}`);
        console.log(JSON.stringify(modelResponse));
        process.exit(0);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logDebug(`CLI QUERY ERR >>> ${msg}`);
        process.stderr.write(`Error: ${msg}\n`);
        process.exit(1);
    }
}
const sessions = new Map();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
});
rl.on("line", (line) => {
    if (!line.trim())
        return;
    logDebug(`IN <<< ${line}`);
    try {
        const req = JSON.parse(line);
        handleRequest(req);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendResponse({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error: " + message },
        });
    }
});
function sendResponse(res) {
    const jsonStr = JSON.stringify(res);
    logDebug(`OUT >>> ${jsonStr}`);
    process.stdout.write(jsonStr + "\n");
}
function sendNotification(method, params) {
    const jsonStr = JSON.stringify({ jsonrpc: "2.0", method, params });
    logDebug(`NOTIFY >>> ${jsonStr}`);
    process.stdout.write(jsonStr + "\n");
}
function handleRequest(req) {
    const { id, method, params } = req;
    switch (method) {
        case "initialize":
            sendResponse({
                jsonrpc: "2.0",
                id,
                result: {
                    protocolVersion: "2024-11-05",
                    capabilities: {
                        prompts: {},
                        tools: {},
                    },
                    serverInfo: {
                        name: "antigravity-acp",
                        version: "0.1.0",
                    },
                },
            });
            break;
        case "session/new": {
            const sessionId = "session-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7);
            let models = [];
            try {
                models = getAvailableModels();
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logDebug(`SESSION NEW ERR >>> ${msg}`);
                sendResponse({
                    jsonrpc: "2.0",
                    id,
                    error: {
                        code: -32000,
                        message: msg,
                    },
                });
                break;
            }
            const defaultModel = models[0]?.modelId || "gemini-3.7-flash-high";
            sessions.set(sessionId, { sessionId, selectedModel: defaultModel });
            sendResponse({
                jsonrpc: "2.0",
                id,
                result: {
                    sessionId,
                    configOptions: [
                        {
                            configId: "model",
                            category: "model",
                            displayName: "Model",
                            options: models.map(m => ({
                                value: m.modelId,
                                displayName: m.name
                            }))
                        }
                    ],
                    models: {
                        currentModelId: defaultModel,
                        availableModels: models
                    }
                },
            });
            break;
        }
        case "session/set_config_option": {
            const sessionId = typeof params?.sessionId === "string" ? params.sessionId : undefined;
            const configId = params?.configId;
            const value = params?.value;
            logDebug(`CONFIG OPTION >>> sessionId: ${sessionId}, configId: ${configId}, value: ${value}`);
            if (sessionId) {
                const session = sessions.get(sessionId) || { sessionId };
                if (configId === "model" && typeof value === "string") {
                    session.selectedModel = value;
                    logDebug(`SET MODEL >>> session ${sessionId} model set to ${value}`);
                }
                sessions.set(sessionId, session);
            }
            sendResponse({
                jsonrpc: "2.0",
                id,
                result: { status: "ok" },
            });
            break;
        }
        case "session/prompt":
            executeAntigravityPrompt(id, params);
            break;
        case "session/cancel": {
            const targetSessionId = typeof params?.sessionId === "string" ? params.sessionId : undefined;
            let cancelled = false;
            logDebug(`CANCEL REQ >>> session: ${targetSessionId || "all"}`);
            if (targetSessionId && sessions.has(targetSessionId)) {
                const session = sessions.get(targetSessionId);
                if (session.activeChild) {
                    session.activeChild.kill();
                    session.activeChild = undefined;
                    cancelled = true;
                }
            }
            else {
                for (const session of sessions.values()) {
                    if (session.activeChild) {
                        session.activeChild.kill();
                        session.activeChild = undefined;
                        cancelled = true;
                    }
                }
            }
            sendResponse({
                jsonrpc: "2.0",
                id,
                result: { cancelled },
            });
            break;
        }
        default:
            sendResponse({
                jsonrpc: "2.0",
                id,
                error: { code: -32601, message: `Method not found: ${method}` },
            });
    }
}
function executeAntigravityPrompt(requestId, params) {
    const sessionId = typeof params?.sessionId === "string" ? params.sessionId : Array.from(sessions.keys()).pop();
    if (!sessionId) {
        sendResponse({
            jsonrpc: "2.0",
            id: requestId,
            error: { code: -32602, message: "Invalid params: missing valid sessionId" },
        });
        return;
    }
    const session = sessions.get(sessionId) || { sessionId };
    sessions.set(sessionId, session);
    session.activeRequestId = requestId;
    const promptText = extractPromptText(params);
    const selectedModel = typeof params?.model === "string"
        ? params.model
        : (typeof params?.modelId === "string" ? params.modelId : session.selectedModel);
    // Resolve `agy` CLI binary (checks standard locations and PATH)
    const agyExec = resolveAgyExecutable();
    const agyArgs = ["--output-format", "stream-json", "--dangerously-skip-permissions"];
    if (selectedModel) {
        agyArgs.push("--model", selectedModel);
    }
    logDebug(`SPAWN >>> ${agyExec} ${agyArgs.join(" ")} (prompt length: ${promptText.length} chars)`);
    const isCmdOrBat = agyExec.toLowerCase().endsWith(".cmd") || agyExec.toLowerCase().endsWith(".bat");
    const child = (0, child_process_1.spawn)(agyExec, agyArgs, {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: isCmdOrBat,
    });
    session.activeChild = child;
    let stderrData = "";
    let finished = false;
    let lineBuffer = "";
    let fullAgentText = "";
    // Write promptText directly into child STDIN stream
    if (child.stdin) {
        child.stdin.write(promptText);
        child.stdin.end();
    }
    child.on("error", (err) => {
        if (finished)
            return;
        finished = true;
        session.activeChild = undefined;
        logDebug(`SUBPROC ERR >>> ${err.message}`);
        let userFriendlyMessage = `Failed to spawn agy executable (${agyExec}): ${err.message}`;
        if (err.message.includes("ENOENT")) {
            userFriendlyMessage = `Google Antigravity CLI ('agy') was not found on this machine (${err.message}). ` +
                `Please install Google Antigravity CLI and ensure 'agy' is on your PATH, then run 'agy auth login'.`;
        }
        sendResponse({
            jsonrpc: "2.0",
            id: requestId,
            error: {
                code: -32000,
                message: userFriendlyMessage,
            },
        });
    });
    const processLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed)
            return;
        try {
            const json = JSON.parse(trimmed);
            if (json.event === "step_update" && json.step_update) {
                const step = json.step_update;
                if (step.step_type === "agent_response" && typeof step.text_delta === "string" && step.text_delta) {
                    fullAgentText += step.text_delta;
                    sendNotification("session/update", {
                        sessionId,
                        update: {
                            sessionUpdate: "agent_message_chunk",
                            content: {
                                type: "text",
                                text: step.text_delta,
                            },
                        },
                    });
                }
            }
            else if (json.event === "result" && json.result?.response) {
                if (!fullAgentText) {
                    fullAgentText = json.result.response;
                    sendNotification("session/update", {
                        sessionId,
                        update: {
                            sessionUpdate: "agent_message_chunk",
                            content: {
                                type: "text",
                                text: json.result.response,
                            },
                        },
                    });
                }
            }
        }
        catch (_e) {
            // Non-JSON output fallback
            fullAgentText += trimmed + "\n";
            sendNotification("session/update", {
                sessionId,
                update: {
                    sessionUpdate: "agent_message_chunk",
                    content: {
                        type: "text",
                        text: trimmed + "\n",
                    },
                },
            });
        }
    };
    child.stdout?.on("data", (chunk) => {
        lineBuffer += chunk.toString();
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || "";
        for (const l of lines) {
            processLine(l);
        }
    });
    child.stderr?.on("data", (chunk) => {
        const errText = chunk.toString();
        stderrData += errText;
        logDebug(`SUBPROC STDERR >>> ${errText.trim()}`);
    });
    child.on("close", (code) => {
        if (finished)
            return;
        finished = true;
        session.activeChild = undefined;
        logDebug(`SUBPROC CLOSE >>> exit code: ${code}`);
        if (lineBuffer.trim()) {
            processLine(lineBuffer);
            lineBuffer = "";
        }
        if (code === 0) {
            sendResponse({
                jsonrpc: "2.0",
                id: requestId,
                result: {
                    stopReason: "end_turn",
                },
            });
        }
        else {
            sendResponse({
                jsonrpc: "2.0",
                id: requestId,
                error: {
                    code: -32000,
                    message: stderrData.trim() || `agy CLI exited with code ${code}`,
                },
            });
        }
    });
}
function extractPromptText(params) {
    if (!params)
        return "";
    if (typeof params.prompt === "string")
        return params.prompt;
    if (Array.isArray(params.prompt)) {
        return params.prompt
            .map((p) => (typeof p === "string" ? p : p?.text || ""))
            .filter(Boolean)
            .join("\n\n");
    }
    if (Array.isArray(params.messages)) {
        const lastMsg = params.messages[params.messages.length - 1];
        if (typeof lastMsg?.content === "string")
            return lastMsg.content;
        if (Array.isArray(lastMsg?.content)) {
            return lastMsg.content
                .map((c) => (typeof c === "string" ? c : c?.text || ""))
                .filter(Boolean)
                .join("\n\n");
        }
    }
    return "";
}
