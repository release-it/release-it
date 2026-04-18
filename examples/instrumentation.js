// ABOUTME: OTel SDK bootstrap — loaded via Node.js --import flag before application code
// ABOUTME: Configures tracing with OTLP HTTP exporter for local Datadog Agent on port 4318

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// Disable auto-metrics — SDK 2.x auto-instantiates a Metrics SDK.
// For IS scoring runs: set IS_SCORING_RUN=1 to enable the metrics exporter so
// MET rules can be evaluated.
if (!process.env.OTEL_METRICS_EXPORTER && !process.env.IS_SCORING_RUN) {
  process.env.OTEL_METRICS_EXPORTER = 'none';
}

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'release-it',
    'service.version': pkg.version,
    'deployment.environment': process.env.NODE_ENV || 'development',
  }),
  // SimpleSpanProcessor exports each span immediately on span.end() — better
  // for CLI apps where process.exit() can kill the event loop before a
  // BatchSpanProcessor flushes.
  spanProcessors: [new SimpleSpanProcessor(traceExporter)],
});

sdk.start();

// Graceful shutdown — flush pending spans before exit.
// SIGTERM uses 143 (128 + SIGTERM signal number 15).
// SIGINT uses 130 (128 + SIGINT signal number 2).
process.on('SIGTERM', async () => {
  await sdk.shutdown().catch((err) => console.error('OTel SDK shutdown error:', err));
  process.exit(143);
});

process.on('SIGINT', async () => {
  await sdk.shutdown().catch((err) => console.error('OTel SDK shutdown error:', err));
  process.exit(130);
});
