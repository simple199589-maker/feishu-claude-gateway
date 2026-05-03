import path from 'node:path';

export class WorkspaceRegistry {
  constructor(
    private root: string,
    private defaultWorkspace: string,
  ) {}

  getDefault(): string {
    return this.defaultWorkspace;
  }

  resolve(nameOrPath: string): string {
    const target = path.isAbsolute(nameOrPath)
      ? path.resolve(nameOrPath)
      : path.resolve(this.root, nameOrPath);

    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new Error('Workspace is outside allowed root');
    }

    return target;
  }
}
