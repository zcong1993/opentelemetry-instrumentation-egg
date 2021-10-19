import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { EggInstrumentation } from '../src'

const setup = async () => {
  const serviceName = process.env.serviceName || 'server'

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

  const traceExporter = new ConsoleSpanExporter()

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    traceExporter,
    instrumentations: [new EggInstrumentation()],
  })

  await sdk.start()
  await sdk.shutdown()
}

it('should work well', async () => {
  await setup()
})
