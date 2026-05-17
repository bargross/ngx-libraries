import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';

export function ngAdd(options: any): Rule {
  return (tree: Tree, context: SchematicContext) => {
    // Add version.json to assets in angular.json
    const angularJsonPath = '/angular.json';
    if (tree.exists(angularJsonPath)) {
      const angularJson = JSON.parse(tree.read(angularJsonPath)!.toString('utf-8'));
      const projects = Object.keys(angularJson.projects);

      projects.forEach(project => {
        const buildTarget = angularJson.projects[project].architect?.build;
        if (buildTarget?.options?.assets) {
          buildTarget.options.assets.push({
            glob: 'version.json',
            input: 'src',
            output: '/'
          });
        }
      });

      tree.overwrite(angularJsonPath, JSON.stringify(angularJson, null, 2));
    }

    // Create version.json file
    const packageJson = JSON.parse(tree.read('/package.json')!.toString('utf-8'));
    const version = packageJson.version || '1.0.0';
    tree.create('/src/version.json', JSON.stringify({ version }, null, 2));

    context.addTask(new NodePackageInstallTask());

    return tree;
  };
}
