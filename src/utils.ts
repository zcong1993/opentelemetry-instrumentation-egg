/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  KoaContext,
  KoaMiddleware,
  KoaLayerType,
  EggInstrumentationConfig,
  IgnoreMatcher,
} from './types'
import { AttributeNames } from './enums/AttributeNames'
import { SpanAttributes } from '@opentelemetry/api'
import { SemanticAttributes } from '@opentelemetry/semantic-conventions'

export const getMiddlewareMetadata = (
  context: KoaContext,
  layer: KoaMiddleware,
  isRouter: boolean,
  layerPath?: string
): {
  attributes: SpanAttributes
  name: string
} => {
  if (isRouter) {
    return {
      attributes: {
        [AttributeNames.KOA_NAME]: layerPath,
        [AttributeNames.KOA_TYPE]: KoaLayerType.ROUTER,
        [SemanticAttributes.HTTP_ROUTE]: layerPath,
      },
      name: `router - ${layerPath}`,
    }
  } else {
    return {
      attributes: {
        [AttributeNames.KOA_NAME]: layer.name ?? 'middleware',
        [AttributeNames.KOA_TYPE]: KoaLayerType.MIDDLEWARE,
      },
      name: `middleware - ${layer.name}`,
    }
  }
}

/**
 * Check whether the given obj match pattern
 * @param constant e.g URL of request
 * @param obj obj to inspect
 * @param pattern Match pattern
 */
const satisfiesPattern = (
  constant: string,
  pattern: IgnoreMatcher
): boolean => {
  if (typeof pattern === 'string') {
    return pattern === constant
  } else if (pattern instanceof RegExp) {
    return pattern.test(constant)
  } else if (typeof pattern === 'function') {
    return pattern(constant)
  } else {
    throw new TypeError('Pattern is in unsupported datatype')
  }
}

/**
 * Check whether the given request is ignored by configuration
 * It will not re-throw exceptions from `list` provided by the client
 * @param constant e.g URL of request
 * @param [list] List of ignore patterns
 * @param [onException] callback for doing something when an exception has
 *     occurred
 */
export const isLayerIgnored = (
  name: string,
  type: KoaLayerType,
  config?: EggInstrumentationConfig
): boolean => {
  if (
    Array.isArray(config?.ignoreLayersType) &&
    config?.ignoreLayersType?.includes(type)
  ) {
    return true
  }
  if (Array.isArray(config?.ignoreLayers) === false) return false
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const pattern of config!.ignoreLayers!) {
      if (satisfiesPattern(name, pattern)) {
        return true
      }
    }
  } catch (e) {
    /* catch block*/
  }

  return false
}
