import { workspace, Uri, ConfigurationTarget, window, Extension, extensions, commands } from 'vscode';
import * as path from 'path';

export const VSCODE_YAML_EXTENSION_ID = 'redhat.vscode-yaml';

export const YAML_SCHEMA_CONFIG_NAME_OF_VSCODE_YAML_EXTENSION = 'yaml.schemas';

export const BLUEPRINT_SCHEME_TARGET_FILES = '**/blueprints/*.yaml';
export const APPLICATION_SCHEME_TARGET_FILES = '**/applications/**/*.yaml';
export const SERVICE_SCHEME_TARGET_FILES = '**/services/**/*.yaml';

export async function addSchemasToYamlConfig(extensionPath: string) {
    const config = workspace.getConfiguration().inspect(YAML_SCHEMA_CONFIG_NAME_OF_VSCODE_YAML_EXTENSION);
    let newValue: any = {};
    if (config!.globalValue) {
        newValue = Object.assign({}, config!.globalValue);
    }
    
    const blueprint_scheme_path = path.join(extensionPath, 'schemas', 'blueprint-schema.json').toString();
    newValue = addSchemaToConfigAtScope(
        Uri.file(blueprint_scheme_path).toString(),
        BLUEPRINT_SCHEME_TARGET_FILES,
        newValue
    );
    const application_scheme_path = path.join(extensionPath, 'schemas', 'application-schema.json').toString();
    newValue = addSchemaToConfigAtScope(
        Uri.file(application_scheme_path).toString(),
        APPLICATION_SCHEME_TARGET_FILES,
        newValue
    );
    const service_scheme_path = path.join(extensionPath, 'schemas', 'service-schema.json').toString();
    newValue = addSchemaToConfigAtScope(
        Uri.file(service_scheme_path).toString(),
        SERVICE_SCHEME_TARGET_FILES,
        newValue
    );

    await workspace.getConfiguration().update(YAML_SCHEMA_CONFIG_NAME_OF_VSCODE_YAML_EXTENSION, newValue, ConfigurationTarget.Global);
}

function addSchemaToConfigAtScope(
    key: string,
    value: string,
    valueAtScope: any
) {
    let newValue: any = {};
    if (valueAtScope) {
        newValue = valueAtScope;
    }
    Object.keys(newValue).forEach((configKey) => {
        var configValue = newValue[configKey];
        if (value === configValue) {
            delete newValue[configKey];
        }
    });
    newValue[key] = value;
    return newValue;
}

// Find redhat.vscode-yaml extension and try to activate it
export async function activateYamlExtension() {
    const ext: Extension<any> | undefined = extensions.getExtension(VSCODE_YAML_EXTENSION_ID);
    if (!ext) {
        window
            .showWarningMessage(
                "Please install 'YAML Support by Red Hat' via the Extensions pane.",
                'install yaml extension'
            )
            .then((sel) => {
                commands.executeCommand('workbench.extensions.installExtension', VSCODE_YAML_EXTENSION_ID);
            });
        return;
    }
    const yamlPlugin = await ext.activate();

    if (!yamlPlugin || !yamlPlugin.registerContributor) {
        window.showWarningMessage(
            "The installed Red Hat YAML extension doesn't support Intellisense. Please upgrade 'YAML Support by Red Hat' via the Extensions pane."
        );
        return;
    }
    return yamlPlugin;
}