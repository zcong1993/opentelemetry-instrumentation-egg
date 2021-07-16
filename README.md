# opentelemetry-instrumentation-egg

[![NPM version](https://img.shields.io/npm/v/opentelemetry-instrumentation-egg.svg?style=flat)](https://npmjs.com/package/opentelemetry-instrumentation-egg) [![NPM downloads](https://img.shields.io/npm/dm/opentelemetry-instrumentation-egg.svg?style=flat)](https://npmjs.com/package/opentelemetry-instrumentation-egg) [![CI](https://github.com/zcong1993/opentelemetry-instrumentation-egg/actions/workflows/release.yml/badge.svg)](https://github.com/zcong1993/opentelemetry-instrumentation-egg/actions/workflows/release.yml)

This module provides automatic instrumentation for [`Egg`](https://github.com/eggjs/egg).

For automatic instrumentation see the
[@opentelemetry/node](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages/opentelemetry-node) package.

Since `Egg` is based on [`Koa`](https://github.com/koajs/koa) packaging, we also based it on [opentelemetry-instrumentation-koa](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-koa), just adjusting some details and adaptations.

## Installation

This instrumentation relies on HTTP calls to also be instrumented. Make sure you install and enable both, otherwise you will not see any spans being exported from the instrumentation.

```bash
npm install --save @opentelemetry/instrumentation-http opentelemetry-instrumentation-egg
```

### Supported Versions

- `^4.20.0`

## Usage

OpenTelemetry Egg Instrumentation allows the user to automatically collect trace data and export them to their backend of choice, to give observability to distributed systems.

To load the instrumentation, specify it in the Node Tracer's configuration:

```js
const { NodeTracerProvider } = require('@opentelemetry/node')
const { registerInstrumentations } = require('@opentelemetry/instrumentation')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { EggInstrumentation } = require('opentelemetry-instrumentation-egg')

const provider = new NodeTracerProvider()
provider.register()

registerInstrumentations({
  instrumentations: [
    // Egg instrumentation expects HTTP layer to be instrumented
    new HttpInstrumentation(),
    new EggInstrumentation(),
  ],
})
```

<!-- See [examples/express](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/examples/express) for a short example. -->

### Egg Instrumentation Options

Egg instrumentation has few options available to choose from. You can set the following:

| Options            | Type              | Example               | Description                      |
| ------------------ | ----------------- | --------------------- | -------------------------------- |
| `ignoreLayers`     | `IgnoreMatcher[]` | `[/^\/_internal\//]`  | Ignore layers that by match.     |
| `ignoreLayersType` | `KoaLayerType[]`  | `['request_handler']` | Ignore layers of specified type. |

`ignoreLayers` accepts an array of elements of types:

- `string` for full match of the path,
- `RegExp` for partial match of the path,
- `function` in the form of `(path) => boolean` for custom logic.

`ignoreLayersType` accepts an array of following strings:

- `router` is the name of `egg app.Router`,
- `middleware`,

By default, we disable the following `egg` default middlewares:

```ts
export const defaultConfig: EggInstrumentationConfig = {
  ignoreLayers: [
    (name: string) => {
      return [
        'middleware - meta',
        'middleware - siteFile',
        'middleware - notfound',
        'middleware - static',
        'middleware - overrideMethod',
        'middleware - session',
        'middleware - i18n',
        'middleware - bodyParser',
        'middleware - securities',
        'middleware - eggLoaderTrace',
      ].includes(name)
    },
  ],
}
```

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry JavaScript: <https://github.com/open-telemetry/opentelemetry-js>

## References

- [opentelemetry-instrumentation-koa](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-koa)
- [opentelemetry-instrumentation-express](https://github.com/open-telemetry/opentelemetry-js-contrib/tree/main/plugins/node/opentelemetry-instrumentation-express)

## License

MIT &copy; zcong1993
