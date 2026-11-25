# TypeScript + C# WebAssembly calculator

A Node.js console calculator with a TypeScript expression parser and typed glue to C# functions running inside .NET WebAssembly.

```text
Node.js CLI → TypeScript parser → typed glue → C# exports in .NET WASM
```

TypeScript evaluates `+`, `-`, and unary signs. C# evaluates `*`, `/`, `^`, `sqrt(x)`, `pow(base, exponent)`, and `factorial(n)`. Parentheses, decimals, and scientific notation are supported. Expressions are parsed without `eval`.

Use the [Docker build and run instructions](#build-and-run-with-docker) to build everything inside containers, or follow the [local build instructions](#build-and-run-locally).

## Local prerequisites

Install Node.js 22 or later, npm, and the .NET 10 SDK. `global.json` selects .NET 10, starting at version 10.0.100, and searches the project-local `.dotnet` directory before the system SDK.

Install the WebAssembly workloads once for the SDK you use. For a system SDK:

```sh
dotnet workload install wasm-tools wasm-experimental
```

For a system-wide SDK on macOS or Linux, workload installation may require `sudo dotnet workload install wasm-tools wasm-experimental`.

If using the ignored project-local SDK, manage its workloads through its own executable:

```sh
./.dotnet/dotnet workload install wasm-tools wasm-experimental
./.dotnet/dotnet workload list
```

With the local SDK installed, ordinary `dotnet restore` and `dotnet build` commands select it through `global.json`.

## Build and run locally

Run these commands from the project root:

```sh
npm install
dotnet restore
dotnet build
npm run build
npm run start
```

| Command | Role |
| --- | --- |
| `npm install` | Install TypeScript and Node.js type definitions |
| `dotnet restore` | Restore the C# project's dependencies through `Calculator.slnx` |
| `dotnet build` | Compile C# and generate the Debug WASM `AppBundle` |
| `npm run build` | Copy that existing bundle to `dist/wasm` and compile TypeScript to `dist/src` |
| `npm run start` | Run the compiled Node.js console application |

The npm build consumes `dotnet/Calculator/bin/Debug/net10.0/browser-wasm/AppBundle`. It reports a missing bundle if the C# build has not run. Installation and startup have no build hooks; .NET compilation belongs to the explicit `dotnet build` step.

Despite the `browser-wasm` runtime identifier's name, Node.js hosts the runtime directly. No browser, HTTP server, or Blazor is needed.

For a Release build:

```sh
dotnet build -c Release
DOTNET_CONFIGURATION=Release npm run build
npm run start
```

After C# changes, run `dotnet build` followed by `npm run build`. After TypeScript changes, run `npm run build`.

## Build and run with Docker

Install Docker and make sure its engine is running. The container build installs .NET, the WASM workloads, and Node.js inside its build stages.

The Dockerfile provides two targets: `runtime` for a runnable image and `artefacts` for exporting the compiled application to your filesystem. Both use the same C# and TypeScript build stages.

### Runtime image

From the project root, where `Dockerfile` is located, build the runtime target:

```sh
docker build --target runtime -t wasm-calculator .
```

`runtime` is also the default target, so omitting `--target runtime` produces the same image.

Start the interactive calculator:

```sh
docker run --rm -it wasm-calculator
```

Enter expressions at the `calc>` prompt and type `exit` to stop. `--rm` removes the container when it exits.

For a single expression:

```sh
docker run --rm wasm-calculator npm start -- "sqrt(81) + 2 * 3"
# 15
```

To pass multiple expressions through standard input:

```sh
printf '%s\n' 'sqrt(81)' 'factorial(5)' 'exit' | docker run --rm -i wasm-calculator
```

After changing the application, rebuild the runtime target before starting a new container.

### Artefact export

Export the compiled application into the local `artefacts` directory:

```sh
docker build --target artefacts --output type=local,dest=./artefacts .
```

The exported files have this layout:

```text
artefacts/
├── package.json
├── package-lock.json
└── dist/
    ├── package.json
    ├── src/
    └── wasm/
```

The export includes the compiled application and WASM assets. Development tools, tests, and `node_modules` are excluded. With Node.js 22 or later installed, run it directly:

```sh
cd artefacts
npm install --omit=dev
npm start -- "sqrt(81) + 2 * 3"
# 15
```

Use `npm start` without an expression for an interactive session. Re-run the export command after changing the application.

### Build stages and targets

| Stage or target | Image | Role |
| --- | --- | --- |
| `dotnet-build` | `mcr.microsoft.com/dotnet/sdk:10.0` | Install WASM workloads, restore dependencies, and build C# in Release mode |
| `node-build` | `node:24-bookworm` | Install development dependencies, compile TypeScript, and run tests |
| `artefacts` | `scratch` | Export package manifests and the compiled `dist` files |
| `runtime` | `node:24-bookworm-slim` | Install production dependencies and run the same compiled application |

These use the official [Microsoft .NET SDK image](https://github.com/dotnet/dotnet-docker/blob/main/README.sdk.md) and [Node.js images](https://hub.docker.com/_/node). `--omit=dev` installs production dependencies only. The runtime image owns its application files as the `node` user, and runs a calculator expression as that user during the build to verify the packaged WASM loads. `.dockerignore` excludes the local SDK, dependencies, build output, and exported artefacts from the build context.

## Run

```sh
npm start -- "sqrt(81) + 2 * 3"
# 15

npm start -- "factorial(5) / pow(2, 3)"
# 15

npm start -- "2 ^ 3 ^ 2"
# 512

npm start -- "-2 ^ 2"
# -4
```

Quote expressions so the shell does not expand `*` or interpret parentheses. Powers associate to the right, and exponentiation has higher precedence than a leading minus: `(-2)^2` is `4`.

Start an interactive session with `npm start`, then enter expressions at `calc>`. Use `help`, `exit`, or `quit`; EOF also exits. Errors are printed and the session continues. Piped input accepts one expression per line:

```sh
printf '%s\n' 'sqrt(81)' 'factorial(5)' | npm start --silent
# 9
# 120
```

After building, run the compiled application directly with `node dist/src/cli.js "sqrt(81) + 2 * 3"`. The complete `dist` directory and Node.js are sufficient to run it on another machine; .NET is needed for building, while its WASM runtime ships in the output.

## Typed API

From an ES module at the project root, after building:

```js
import { createDotnetCalculator } from './dist/src/dotnet.js';
import { evaluateExpression } from './dist/src/calculator.js';

const csharp = await createDotnetCalculator();
console.log(csharp.multiply(6, 7)); // 42, executed in C#
console.log(csharp.sqrt(81)); // 9, executed in C#
console.log(evaluateExpression('sqrt(81) + 2 * 3', csharp)); // 15
```

The TypeScript interface is `DotnetCalculator` in `src/dotnet.ts`. The loader initializes one runtime per process, obtains `Calculator.dll` exports with `getAssemblyExports`, checks that the expected functions exist, and wraps their C# names in the typed API. These types are handwritten; runtime checks validate function availability, not TypeScript signatures. The runtime lives until Node.js exits.

## Limits and errors

- Numbers use JavaScript `number` and C# `double` (IEEE 754). Decimal arithmetic and large integer factorials may round; for example, `0.1 + 0.2` is not exactly `0.3`.
- `factorial(n)` accepts integers from `0` to `170`; `factorial(0)` is `1`.
- C# rejects nonfinite arguments, division by zero, negative square roots, and results outside the finite real number range. C# exceptions cross the WASM boundary and appear as calculator errors.
- Syntax errors and unknown functions report an error. A failed single-expression invocation exits with code `1`; interactive and piped sessions continue after individual expression errors.

## Project files

| File | Purpose |
| --- | --- |
| `Calculator.slnx` | Root solution for `dotnet restore` and `dotnet build` |
| `global.json` | .NET SDK version and local/system SDK search paths |
| `src/cli.ts` | Arguments, interactive console, piped input, and error output |
| `src/calculator.ts` | Tokenizer, expression grammar, and TypeScript arithmetic |
| `src/dotnet.ts` | Runtime loading, C# export types, and typed wrappers |
| `dotnet/Calculator/Calculator.cs` | C# methods exposed with `[JSExport]` |
| `dotnet/Calculator/Calculator.csproj` | .NET 10 WASM build configuration |
| `dotnet/Calculator/main.mjs` | Entry file for the .NET console bundle |
| `scripts/copy-wasm.mjs` | Copy the already built WASM bundle to `dist/wasm` |
| `test/` | Parser, actual C# WASM interop, and CLI tests |

## Add a C# function

1. Add a static method marked `[JSExport]` to `WasmCalculator.Calculator` in `Calculator.cs`. Use supported interop types, such as `double` parameters and return values.
2. Update `CalculatorExports`, the expected method names, `DotnetCalculator`, and the wrapper returned by `loadCalculator()` in `src/dotnet.ts` to match the C# method.
3. To expose the function in expressions, add its name, argument count, and dispatch in `src/calculator.ts`, then update CLI help.
4. Add a test against the real WASM export in `test/dotnet.test.ts`, add parser coverage if needed, then rebuild and test using the commands below.

## Check changes

```sh
npm run typecheck  # TypeScript checks without building WASM
dotnet build       # Rebuild the C# WASM bundle
npm run build      # Copy the bundle and compile TypeScript
npm test           # Run tests against the built dist directory
```

`npm test` executes the existing compiled tests; build the application first. The interop tests load the built .NET WASM runtime in Node.js and call C# functions directly.

See Microsoft's [JavaScript interop and WASM console guidance](https://learn.microsoft.com/en-us/aspnet/core/client-side/dotnet-interop/wasm-browser-app?view=aspnetcore-10.0) and [.NET JavaScript interop type mappings](https://learn.microsoft.com/en-us/aspnet/core/client-side/dotnet-interop/?view=aspnetcore-10.0) for the underlying APIs.
