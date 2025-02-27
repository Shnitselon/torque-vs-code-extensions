import { existsSync } from "fs";
import { join } from "path";
import { ExtensionContext, ProgressLocation, window, workspace } from "vscode";
import { IS_WIN, LS_VENV_NAME, LS_VENV_PATH, TORQUE_LS_SERVER } from "./constants";
import { execAsync, readdirAsync } from "./utils";

async function checkPythonVersion(python: string): Promise<boolean> {
  try {
    const [major, minor] = await getPythonVersion(python);
    return major === 3 && minor > 5;
  } catch {
    return false;
  }
}

async function createVirtualEnvironment(python: string, name: string, cwd: string): Promise<string> {
  const path = join(cwd, name);
  if (!existsSync(path)) {
    if (IS_WIN && !python.startsWith('"'))
        python = '"' + python + '"';
    const createVenvCmd = `${python} -m venv ${name}`;
    await execAsync(createVenvCmd, { cwd });
  }
  return path;
}

export async function getPython(): Promise<string> {
  let python = workspace.getConfiguration("python").get<string>("pythonPath", getPythonCrossPlatform());
  if (await checkPythonVersion(python)) {
    return python;
  }

  python = await window.showInputBox({
    ignoreFocusOut: true,
    placeHolder: "Enter a path to the python 3.6+.",
    prompt: "This python will be used to create a virtual environment inside the extension directory.",
    validateInput: async (value: string) => {
      if (await checkPythonVersion(value)) {
        return null;
      } else {
        return "Not a valid python path!";
      }
    },
  });

  // User canceled the input
  if (python === "undefined") {
    throw new Error("Python 3.6+ is required!");
  }

  if (IS_WIN)
    python = '"' + python + '"';
  return python;
}

function getPythonCrossPlatform(): string {
  return IS_WIN ? "python.exe" : "python3";
}

export function getPythonFromVenvPath(venvPath: string = LS_VENV_PATH): string {
  return IS_WIN ? join(venvPath, "Scripts", "python.exe") : join(venvPath, "bin", "python");
}

async function getPythonVersion(python: string): Promise<number[]> {
    if (IS_WIN && !python.startsWith('"'))
        python = `"${python}"`;
  const getPythonVersionCmd = `${python} --version`;
  const version = await execAsync(getPythonVersionCmd);
  return version.match(new RegExp(/\d/g)).map((v) => Number.parseInt(v));
}

// async function getVenvPackageVersion(python: string, name: string): Promise<number[] | null> {
//   const listPipPackagesCmd = `${python} -m pip show ${name}`;
//   try {
//     const packageInfo = await execAsync(listPipPackagesCmd);
//     const packageVersion = packageInfo.match(new RegExp(/Version: \d\.\d\.\d/g));
//     return packageVersion.pop().match(new RegExp(/\d/g)).map((v) => Number.parseInt(v));
//   } catch (err) {
//     return null;
//   }
// }

async function installRequirements(python: string, cwd: string) {
  if (existsSync(cwd)) {
    if (IS_WIN && !python.startsWith('"'))
        python = `"${python}"`;
    await execAsync(`${python} -m pip install --upgrade --force-reinstall -r requirements.txt`, { cwd });
  }
}

export async function installLSWithProgress(context: ExtensionContext): Promise<string> {
  // Check if LS is already installed
  let venvPython = getPythonFromVenvPath();
  if (existsSync(venvPython))
  {
    return Promise.resolve(venvPython);
  }
  
  // Install with progress bar
  return window.withProgress({
    location: ProgressLocation.Notification,
  }, (progress): Promise<string> => {
    return new Promise<string>(async (resolve, reject) => {
      try {
        progress.report({ message: "First-time Torque language server initialization" });

        // Get python interpreter
        const python = await getPython();

        // Create virtual environment
        const venv = await createVirtualEnvironment(python, LS_VENV_NAME, context.extensionPath);

        // Install source from wheels
        venvPython = getPythonFromVenvPath(venv);
        const requirementsPath = join(context.extensionPath, "out", "server");
        await installRequirements(venvPython, requirementsPath);

        window.showInformationMessage("Torque extension is ready! :)");
        resolve(venvPython);
      } catch (err) {
        reject(err);
      }
    });
  });

}
