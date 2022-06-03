/* eslint-disable no-console */
/* eslint-disable import/no-dynamic-require */
import * as ts from 'typescript';
import { existsSync } from 'fs';
import * as os from 'os';
import { join, dirname, posix } from 'path';
import tsPaths = require('tsconfig-paths');

function tsconfigPathsBeforeHookFactory(compilerOptions: ts.CompilerOptions) {
  const tsBinary = new TypeScriptBinaryLoader().load();
  const { paths = {}, baseUrl = './' } = compilerOptions;
  const matcher = tsPaths.createMatchPath(baseUrl, paths, ['main']);

  return (ctx: ts.TransformationContext): ts.Transformer<any> => {
    return (sf: ts.SourceFile) => {
      const visitNode = (node: ts.Node): ts.Node => {
        if (tsBinary.isImportDeclaration(node) || (tsBinary.isExportDeclaration(node) && node.moduleSpecifier)) {
          try {
            const newNode = tsBinary.getMutableClone(node);
            const importPathWithQuotes = node.moduleSpecifier && node.moduleSpecifier.getText();

            if (!importPathWithQuotes) {
              return node;
            }
            const text = importPathWithQuotes.substr(1, importPathWithQuotes.length - 2);
            const result = getNotAliasedPath(sf, matcher, text);
            if (!result) {
              return node;
            }
            (newNode as any).moduleSpecifier = tsBinary.createLiteral(result);
            (newNode as any).moduleSpecifier.parent = (node as any).moduleSpecifier.parent;
            (newNode as any).flags = node.flags;
            return newNode;
          } catch {
            return node;
          }
        }
        return tsBinary.visitEachChild(node, visitNode, ctx);
      };
      return tsBinary.visitNode(sf, visitNode);
    };
  };
}

function getNotAliasedPath(sf: ts.SourceFile, matcher: tsPaths.MatchPath, text: string) {
  try {
    let result = matcher(text, undefined, undefined, ['.ts', '.js']);
    if (!result) {
      return undefined;
    }
    if (os.platform() === 'win32') {
      result = result.replace(/\\/g, '/');
    }
    const resolvedPath = posix.relative(dirname(sf.fileName), result) || './';
    return resolvedPath[0] === '.' ? resolvedPath : './' + resolvedPath;
  } catch (err) {
    console.error('getNotAliasedPath err', err);
    return '';
  }
}

class TypeScriptBinaryLoader {
  private tsBinary?: typeof ts;

  public load(): typeof ts {
    if (this.tsBinary) {
      return this.tsBinary;
    }

    try {
      const tsBinaryPath = require.resolve('typescript', {
        paths: [process.cwd(), ...this.getModulePaths()],
      });
      // eslint-disable-next-line global-require
      const tsBinary = require(tsBinaryPath);
      this.tsBinary = tsBinary;
      return tsBinary;
    } catch {
      throw new Error('TypeScript could not be found! Please, install "typescript" package.');
    }
  }

  public getModulePaths() {
    const modulePaths = module.paths.slice(2, module.paths.length);
    const packageDeps = modulePaths.slice(0, 3);
    return [...packageDeps.reverse(), ...modulePaths.slice(3, modulePaths.length).reverse()];
  }
}

class TsConfigProvider {
  constructor(private readonly typescriptLoader: TypeScriptBinaryLoader) {}

  public getByConfigFilename(configFilename: string) {
    if (!existsSync(configFilename)) {
      throw new Error(`MISSING_TYPESCRIPT: ${configFilename}`);
    }
    const tsBinary = this.typescriptLoader.load();
    const parsedCmd = tsBinary.getParsedCommandLineOfConfigFile(
      configFilename,
      undefined!,
      tsBinary.sys as unknown as ts.ParseConfigFileHost,
    );
    const { options, fileNames, projectReferences } = parsedCmd!;
    return { options, fileNames, projectReferences };
  }
}

class Compiler {
  constructor(
    private readonly tsConfigProvider: TsConfigProvider,
    private readonly typescriptLoader: TypeScriptBinaryLoader,
  ) {}

  public run(configFilename: string) {
    const tsBinary = this.typescriptLoader.load();
    const formatHost: ts.FormatDiagnosticsHost = {
      getCanonicalFileName: path => path,
      getCurrentDirectory: tsBinary.sys.getCurrentDirectory,
      getNewLine: () => tsBinary.sys.newLine,
    };
    const { options, fileNames, projectReferences } = this.tsConfigProvider.getByConfigFilename(configFilename);

    const createProgram = tsBinary.createIncrementalProgram || tsBinary.createProgram;
    const program = createProgram.call(ts, {
      rootNames: fileNames,
      projectReferences,
      options,
    });

    const tsconfigPathsPlugin = tsconfigPathsBeforeHookFactory(options);
    const emitResult = program.emit(undefined, undefined, undefined, undefined, {
      before: [tsconfigPathsPlugin],
    });

    const errorsCount = this.reportAfterCompilationDiagnostic(program as any, emitResult, tsBinary, formatHost);
    if (errorsCount) {
      process.exit(1);
    } else {
      console.log('compile success!');
    }
  }

  private reportAfterCompilationDiagnostic(
    program: ts.EmitAndSemanticDiagnosticsBuilderProgram,
    emitResult: ts.EmitResult,
    tsBinary: typeof ts,
    formatHost: ts.FormatDiagnosticsHost,
  ): number {
    const diagnostics = tsBinary.getPreEmitDiagnostics(program as unknown as ts.Program).concat(emitResult.diagnostics);

    if (diagnostics.length > 0) {
      console.error(tsBinary.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
      console.info(`Found ${diagnostics.length} error(s).` + tsBinary.sys.newLine);
    }
    return diagnostics.length;
  }
}

const typeScriptBinaryLoader = new TypeScriptBinaryLoader();
const compiler = new Compiler(new TsConfigProvider(typeScriptBinaryLoader), typeScriptBinaryLoader);
compiler.run(join(__dirname, './tsconfig.json'));
