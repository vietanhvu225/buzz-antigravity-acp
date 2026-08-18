#!/usr/bin/env node

/**
 * antigravity-acp
 * ACP (Agent Client Protocol) adapter wrapping Google Antigravity CLI (`agy`).
 * Reads JSON-RPC 2.0 NDJSON over stdio and forwards prompts to `agy` CLI.
 */

import { spawn, execSync, ChildProcess } from "child_process";
import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";

const LOG_FILE = path.join(__dirname, "..", "debug.log");

function logDebug(msg: string): void {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
  } catch (_e) {
    // Ignore file log errors gracefully
  }
}

logDebug("--- ACP Adapter Started ---");

// If run interactively in a terminal, print a friendly status message to stderr (leaving stdout pure for JSON-RPC)
if (process.stdin.isTTY) {
  process.stderr.write(
    "🤖 Antigravity ACP Server is running and listening for JSON-RPC 2.0 over stdio.\n" +
    "👉 To list available models, run: buzz-antigravity-acp models\n" +
    "👉 When used by Buzz Desktop, Buzz communicates with this process automatically.\n\n"
  );
}

interface ModelInfo {
  modelId: string;
  name: string;
  description: string;
}

function getAvailableModels(): ModelInfo[] {
  const agyExec = process.platform === "win32" ? "agy.exe" : "agy";
  const availableModels: ModelInfo[] = [];

  try {
    const rawOutput = execSync(`${agyExec} models`, { env: process.env }).toString();
    const lines = rawOutput.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("Fetching")) continue;
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
  } catch (_e) {
    // Ignore execSync errors and fall back below
  }

  if (availableModels.length > 0) {
    return availableModels;
  }

  // Static fallback matching local agy CLI models
  return [
    { modelId: "gemini-3.6-flash-high", name: "Gemini 3.6 Flash (High)", description: "Google Antigravity Gemini 3.6 Flash (High)" },
    { modelId: "gemini-3.6-flash-medium", name: "Gemini 3.6 Flash (Medium)", description: "Google Antigravity Gemini 3.6 Flash (Medium)" },
    { modelId: "gemini-3.6-flash-low", name: "Gemini 3.6 Flash (Low)", description: "Google Antigravity Gemini 3.6 Flash (Low)" },
    { modelId: "gemini-3.5-flash-high", name: "Gemini 3.5 Flash (High)", description: "Google Antigravity Gemini 3.5 Flash (High)" },
    { modelId: "gemini-3.5-flash-medium", name: "Gemini 3.5 Flash (Medium)", description: "Google Antigravity Gemini 3.5 Flash (Medium)" },
    { modelId: "gemini-3.5-flash-low", name: "Gemini 3.5 Flash (Low)", description: "Google Antigravity Gemini 3.5 Flash (Low)" },
    { modelId: "gemini-3.1-pro-high", name: "Gemini 3.1 Pro (High)", description: "Google Antigravity Gemini 3.1 Pro (High)" },
    { modelId: "gemini-3.1-pro-low", name: "Gemini 3.1 Pro (Low)", description: "Google Antigravity Gemini 3.1 Pro (Low)" },
    { modelId: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Thinking)", description: "Google Antigravity Claude Sonnet 4.6 (Thinking)" },
    { modelId: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking)", description: "Google Antigravity Claude Opus 4.6 (Thinking)" },
    { modelId: "gpt-oss-120b-medium", name: "GPT-OSS 120B (Medium)" , description: "Google Antigravity GPT-OSS 120B (Medium)" }
  ];
}

// CLI command model discovery query handler for Buzz
if (process.argv.includes("models") || process.argv.includes("--models")) {
  logDebug("CLI QUERY >>> models command requested");
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
      currentModelId: models[0]?.modelId || "gemini-3.6-flash-high",
      availableModels: models
    }
  };
  logDebug(`CLI QUERY OUT >>> ${JSON.stringify(modelResponse)}`);
  console.log(JSON.stringify(modelResponse));
  process.exit(0);
}

interface AcpRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface AcpResponse {
  jsonrpc: "2.0";
  id?: number | string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

interface SessionContext {
  sessionId: string;
  activeChild?: ChildProcess;
  activeRequestId?: number | string;
}

const sessions = new Map<string, SessionContext>();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line: string) => {
  if (!line.trim()) return;

  logDebug(`IN <<< ${line}`);

  try {
    const req = JSON.parse(line) as AcpRequest;
    handleRequest(req);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendResponse({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error: " + message },
    });
  }
});

function sendResponse(res: AcpResponse): void {
  const jsonStr = JSON.stringify(res);
  logDebug(`OUT >>> ${jsonStr}`);
  process.stdout.write(jsonStr + "\n");
}

function sendNotification(method: string, params: Record<string, unknown>): void {
  const jsonStr = JSON.stringify({ jsonrpc: "2.0", method, params });
  logDebug(`NOTIFY >>> ${jsonStr}`);
  process.stdout.write(jsonStr + "\n");
}

function handleRequest(req: AcpRequest): void {
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
      sessions.set(sessionId, { sessionId });
      const models = getAvailableModels();

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
            currentModelId: models[0]?.modelId || "gemini-3.6-flash-high",
            availableModels: models
          }
        },
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
        const session = sessions.get(targetSessionId)!;
        if (session.activeChild) {
          session.activeChild.kill();
          session.activeChild = undefined;
          cancelled = true;
        }
      } else {
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

function executeAntigravityPrompt(requestId: number | string | undefined, params: Record<string, unknown> | undefined): void {
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
  const selectedModel = typeof params?.model === "string" ? params.model : (typeof params?.modelId === "string" ? params.modelId : undefined);

  // Spawn `agy` CLI subprocess reading prompt directly from STDIN (no -p flag needed for agy)
  const agyExec = process.platform === "win32" ? "agy.exe" : "agy";
  const agyArgs = ["--output-format", "stream-json", "--dangerously-skip-permissions"];
  if (selectedModel) {
    agyArgs.push("--model", selectedModel);
  }

  logDebug(`SPAWN >>> ${agyExec} ${agyArgs.join(" ")} (prompt length: ${promptText.length} chars)`);

  const child = spawn(agyExec, agyArgs, {
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
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

  child.on("error", (err: Error) => {
    if (finished) return;
    finished = true;
    session.activeChild = undefined;
    logDebug(`SUBPROC ERR >>> ${err.message}`);
    sendResponse({
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: -32000,
        message: `Failed to spawn agy executable (${agyExec}): ${err.message}`,
      },
    });
  });

  const processLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

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
      } else if (json.event === "result" && json.result?.response) {
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
    } catch (_e) {
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

  child.stdout?.on("data", (chunk: Buffer | string) => {
    lineBuffer += chunk.toString();
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() || "";
    for (const l of lines) {
      processLine(l);
    }
  });

  child.stderr?.on("data", (chunk: Buffer | string) => {
    const errText = chunk.toString();
    stderrData += errText;
    logDebug(`SUBPROC STDERR >>> ${errText.trim()}`);
  });

  child.on("close", (code: number | null) => {
    if (finished) return;
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
    } else {
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

function extractPromptText(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  if (typeof params.prompt === "string") return params.prompt;
  if (Array.isArray(params.messages)) {
    const lastMsg = params.messages[params.messages.length - 1] as Record<string, unknown> | undefined;
    if (typeof lastMsg?.content === "string") return lastMsg.content;
  }
  return JSON.stringify(params);
}
