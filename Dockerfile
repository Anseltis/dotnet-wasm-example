# Stage 1: build C# and its .NET WebAssembly bundle.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dotnet-build
WORKDIR /app

RUN dotnet workload install wasm-tools wasm-experimental --skip-manifest-update

COPY global.json Calculator.slnx ./
COPY dotnet/Calculator/Calculator.csproj ./dotnet/Calculator/
RUN dotnet restore

COPY dotnet/ ./dotnet/
RUN dotnet build --configuration Release --no-restore

# Stage 2: install development dependencies and build TypeScript.
FROM node:24-bookworm AS node-build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY tsconfig.json ./
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY test/ ./test/
COPY --from=dotnet-build /app/dotnet/Calculator/bin/Release/net10.0/browser-wasm/AppBundle/ ./dotnet/Calculator/bin/Release/net10.0/browser-wasm/AppBundle/

ENV DOTNET_CONFIGURATION=Release
RUN npm run build
RUN npm test

# Generated .NET boot files can be owner-readable only (0600).
# Make the exported application readable by its eventual deployment user.
RUN chmod -R a+rX dist package.json package-lock.json

# Export target: application files only, suitable for --output type=local.
FROM scratch AS artefacts
COPY --from=node-build /app/package.json /app/package-lock.json /
COPY --from=node-build /app/dist/package.json /dist/package.json
COPY --from=node-build /app/dist/src/ /dist/src/
COPY --from=node-build /app/dist/wasm/ /dist/wasm/

# Runtime target (default): install production dependencies and run the app.
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=artefacts /package.json /package-lock.json ./
RUN npm install --omit=dev

COPY --from=artefacts --chown=node:node /dist/ ./dist/

USER node
RUN node dist/src/cli.js "sqrt(81) + 2 * 3"
CMD ["npm", "start"]
