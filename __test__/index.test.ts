import { NodeTracerProvider } from '@opentelemetry/node'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

import {
  SimpleSpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/tracing'

import { registerInstrumentations } from '@opentelemetry/instrumentation'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { EggInstrumentation } from '../src'

const setup = () => {
  const serviceName = process.env.serviceName || 'server'

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ALL)

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
  })

  provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))

  registerInstrumentations({
    instrumentations: [new EggInstrumentation(), new HttpInstrumentation()],
  })

  provider.register()
}

it('should work well', () => {
  setup()
})
