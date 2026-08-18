# buzz-antigravity-acp

> **Agent Client Protocol (ACP) adapter wrapping the Google Antigravity CLI (`agy`).**  
> Seamlessly connect Google Antigravity to **Buzz Desktop** and any ACP-compliant agent client.

---

## 🌟 Key Features

- ⚡ **Full ACP Compliance**: Standard JSON-RPC 2.0 over `stdio` (Newline-Delimited JSON).
- 🧠 **Dynamic Model Discovery**: Automatically queries available models from local `agy models` (Gemini 3.7 / 3.6 / 3.5 Flash, Gemini 3.1 Pro, Claude Sonnet/Opus 4.6 Thinking, GPT-OSS 120B).
- 🚀 **Unlimited Prompt Length**: Streams system prompts and multi-turn channel history directly through `stdin` (bypassing Windows `ENAMETOOLONG` command-line length limits).
- 🛡️ **Headless Auto-Permissions**: Automatically runs non-interactively with `--dangerously-skip-permissions` for uninterrupted automation.
- 📝 **Real-Time Debug Logging**: Automatically writes stdio events to a local `debug.log` file for easy diagnosis.

---

## 📋 Prerequisites

Make sure the Google Antigravity CLI (`agy`) is installed and authenticated on your machine:

```bash
# Verify agy is installed and logged in
agy --version
agy auth login
```

---

## 📦 Installation

Install the adapter globally via npm:

```bash
npm install -g buzz-antigravity-acp
```

---

## 🖥️ Buzz Desktop Configuration

Follow these two simple steps to set up Google Antigravity in **Buzz Desktop**:

### Step 1: Add Custom Runtime (Harness)

1. Open **Buzz Desktop** ➔ Go to **Settings** (⚙️).
2. In the left menu under **App**, click on **Agents**.
3. Scroll down to the **"Your runtimes"** section and click the **"+ Add runtimes"** button:

   ![Step 1 - Settings Your Runtimes](https://raw.githubusercontent.com/vietanhvu225/buzz-antigravity-acp/main/docs/images/01-settings-your-runtimes.png)

4. In the modal popup, click **"+ Custom harness"** at the bottom of the left sidebar.
5. Fill in the form fields:
   - **Name:** `Antigravity`
   - **ID (auto-derived):** `antigravity`
   - **Command:** `buzz-antigravity-acp`
   - **Arguments:** *(Leave empty)*
6. Click **Save** in the bottom-right corner:

   ![Step 2 - Custom Harness Form](https://raw.githubusercontent.com/vietanhvu225/buzz-antigravity-acp/main/docs/images/02-custom-harness-form.png)

---

### Step 2: Create Agent with the Antigravity Runtime

1. Return to the main app view and click **Agents** in the left sidebar.
2. In the Agents grid, click the **`+` (Add agent)** card:

   ![Step 3 - Agents Grid](https://raw.githubusercontent.com/vietanhvu225/buzz-antigravity-acp/main/docs/images/03-agents-menu-add.png)

3. In the **Add agent** popup:
   - **Agent name:** `Antigravity` *(or your preferred name)*.
   - **Agent instructions:** *(Optional custom system instructions)*.
   - **AI configuration:** Switch to the **"Customize for this agent"** tab.
   - **Agent harness:** Select **`Antigravity`** from the dropdown.
   - **Model:** Select your desired model (e.g. `Gemini 3.7 Flash`, `Gemini 3.6 Flash`, `Claude Sonnet 4.6 (Thinking)`, etc.).
4. Click **Add agent** in the bottom-right:

   ![Step 4 - Add Agent Form](https://raw.githubusercontent.com/vietanhvu225/buzz-antigravity-acp/main/docs/images/04-add-agent-form.png)

5. 🎉 **You're ready!** Start chatting with Antigravity directly via Direct Messages or tag `@Antigravity` in any channel:

   ![Step 5 - Chat with Antigravity in Buzz](https://raw.githubusercontent.com/vietanhvu225/buzz-antigravity-acp/main/docs/images/05-chat-with-antigravity.png)

---

## 🧪 Testing Locally

You can test the adapter directly from your terminal:

```bash
# Query available models in ACP JSON format
buzz-antigravity-acp models
```

---

## 📄 License

MIT © Andy Vu Viet
