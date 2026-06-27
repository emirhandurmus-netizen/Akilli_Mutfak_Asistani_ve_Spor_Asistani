"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function normalizeLf(text) {
  return text.replace(/\r\n/g, "\n");
}

function writeTextFile(filePath, content) {
  fs.writeFileSync(filePath, content.split("\n").join(os.EOL), "utf8");
}

function patchClientFile(content) {
  const marker =
    "// codex-ngrok-patch-v1: Guard missing HTTP responses and keep retry flow stable.";
  if (content.includes(marker)) {
    return { changed: false, content };
  }

  const requestCatchOld = `    } catch (error) {
      let clientError;
      try {
        const response = JSON.parse(error.response.body);
        clientError = new NgrokClientError(
          response.msg,
          error.response,
          response
        );
      } catch (e) {
        clientError = new NgrokClientError(
          error.response.body,
          error.response,
          error.response.body
        );
      }
      throw clientError;
    }`;

  const requestCatchNew = `    } catch (error) {
      const httpResponse = error.response;
      if (!httpResponse) {
        throw new NgrokClientError(
          error.message || "ngrok internal API request failed",
          null,
          { code: error.code || null, message: error.message || null }
        );
      }

      let clientError;
      try {
        const response = JSON.parse(httpResponse.body);
        clientError = new NgrokClientError(
          response.msg || error.message,
          httpResponse,
          response
        );
      } catch (e) {
        clientError = new NgrokClientError(
          httpResponse.body || error.message,
          httpResponse,
          httpResponse.body || null
        );
      }
      throw clientError;
    }`;

  const booleanCatchOld = `    } catch (error) {
      const response = JSON.parse(error.response.body);
      throw new NgrokClientError(response.msg, error.response, response);
    }`;

  const booleanCatchNew = `    } catch (error) {
      const httpResponse = error.response;
      if (!httpResponse) {
        throw new NgrokClientError(
          error.message || "ngrok internal API request failed",
          null,
          { code: error.code || null, message: error.message || null }
        );
      }

      let responseBody;
      try {
        responseBody = JSON.parse(httpResponse.body);
      } catch (e) {
        responseBody = {
          msg: httpResponse.body || error.message || "ngrok request failed",
        };
      }
      throw new NgrokClientError(responseBody.msg, httpResponse, responseBody);
    }`;

  let patched = content;
  if (!patched.includes(requestCatchOld)) {
    throw new Error("Unexpected @expo/ngrok client.js format (request catch block).");
  }
  patched = patched.replace(requestCatchOld, requestCatchNew);

  if (!patched.includes(booleanCatchOld)) {
    throw new Error("Unexpected @expo/ngrok client.js format (boolean catch block).");
  }
  patched = patched.replace(booleanCatchOld, booleanCatchNew);
  patched = patched.replace('const got = require("got");', `const got = require("got");\n${marker}`);

  return { changed: true, content: patched };
}

function patchUtilsFile(content) {
  const oldSnippet = `function isRetriable(err) {
  if (!err.response) {
    return false;
  }
  const statusCode = err.response.statusCode;
  const body = err.body;
  const notReady500 = statusCode === 500 && /panic/.test(body);`;

  const newSnippet = `function isRetriable(err) {
  if (!err || !err.response) {
    const errorCode = String((err && err.body && err.body.code) || err.code || "").toLowerCase();
    const errorMessage = String((err && err.message) || "").toLowerCase();
    return (
      errorCode === "econnrefused" ||
      errorCode === "econnreset" ||
      errorCode === "etimedout" ||
      errorMessage.includes("econnrefused") ||
      errorMessage.includes("econnreset") ||
      errorMessage.includes("etimedout")
    );
  }
  const statusCode = err.response.statusCode;
  const body = err.body || {};
  const bodyText = typeof body === "string" ? body : JSON.stringify(body);
  const notReady500 = statusCode === 500 && /panic/.test(bodyText);`;

  if (!content.includes(oldSnippet)) {
    return { changed: false, content };
  }

  return { changed: true, content: content.replace(oldSnippet, newSnippet) };
}

function main() {
  const root = process.cwd();
  const clientPath = path.join(root, "node_modules", "@expo", "ngrok", "src", "client.js");
  const utilsPath = path.join(root, "node_modules", "@expo", "ngrok", "src", "utils.js");

  if (!fs.existsSync(clientPath) || !fs.existsSync(utilsPath)) {
    process.exit(0);
  }

  const clientRaw = normalizeLf(fs.readFileSync(clientPath, "utf8"));
  const clientPatched = patchClientFile(clientRaw);
  if (clientPatched.changed) {
    writeTextFile(clientPath, clientPatched.content);
    console.log("Patched @expo/ngrok client.js");
  }

  const utilsRaw = normalizeLf(fs.readFileSync(utilsPath, "utf8"));
  const utilsPatched = patchUtilsFile(utilsRaw);
  if (utilsPatched.changed) {
    writeTextFile(utilsPath, utilsPatched.content);
    console.log("Patched @expo/ngrok utils.js");
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
