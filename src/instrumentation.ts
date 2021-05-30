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

import * as api from '@opentelemetry/api'
import {
  isWrapped,
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
} from '@opentelemetry/instrumentation'

import type * as koa from 'koa'
import type * as eggCore from 'egg-core'
import {
  KoaMiddleware,
  KoaContext,
  KoaComponentName,
  kLayerPatched,
  KoaLayerType,
  EggInstrumentationConfig,
} from './types'
import { AttributeNames } from './enums/AttributeNames'
import { VERSION } from './version'
import { getMiddlewareMetadata, isLayerIgnored } from './utils'

/**
 * ignore egg default middlewares
 */
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

/** Koa instrumentation for OpenTelemetry */
export class EggInstrumentation extends InstrumentationBase<typeof eggCore> {
  static readonly component = KoaComponentName
  constructor(config?: EggInstrumentationConfig) {
    super('@opentelemetry/instrumentation-egg', VERSION, {
      ...defaultConfig,
      ...config,
    })
  }
  protected init() {
    return new InstrumentationNodeModuleDefinition<typeof eggCore>(
      'egg-core',
      ['^4.20.0'],
      (moduleExports) => {
        if (moduleExports == null) {
          return moduleExports
        }
        api.diag.debug('Patching Egg')
        const routerProto = moduleExports.EggCore.prototype
        if (isWrapped(routerProto.use)) {
          this._unwrap(routerProto, 'use')
        }
        this._wrap(routerProto, 'use', this._getKoaUsePatch.bind(this))
        return moduleExports
      },
      (moduleExports) => {
        api.diag.debug('Unpatching Egg')
        if (isWrapped(moduleExports.EggCore.prototype.use)) {
          this._unwrap(moduleExports.EggCore.prototype, 'use')
        }
      }
    )
  }

  /**
   * Patches the Koa.use function in order to instrument each original
   * middleware layer which is introduced
   * @param {KoaMiddleware} middleware - the original middleware function
   */
  private _getKoaUsePatch(original: (middleware: KoaMiddleware) => koa) {
    const plugin = this // eslint-disable-line @typescript-eslint/no-this-alias
    return function use(this: koa, middlewareFunction: KoaMiddleware) {
      let patchedFunction: KoaMiddleware
      if (middlewareFunction.router) {
        patchedFunction = plugin._patchRouterDispatch(middlewareFunction)
      } else {
        patchedFunction = plugin._patchLayer(middlewareFunction, false)
      }
      return original.apply(this, [patchedFunction])
    }
  }

  /**
   * Patches the dispatch function used by @koa/router. This function
   * goes through each routed middleware and adds instrumentation via a call
   * to the @function _patchLayer function.
   * @param {KoaMiddleware} dispatchLayer - the original dispatch function which dispatches
   * routed middleware
   */
  private _patchRouterDispatch(dispatchLayer: KoaMiddleware): KoaMiddleware {
    api.diag.debug('Patching @koa/router dispatch')

    const router = dispatchLayer.router

    const routesStack = router?.stack ?? []
    for (const pathLayer of routesStack) {
      const path = pathLayer.path
      const pathStack = pathLayer.stack
      for (let j = 0; j < pathStack.length; j++) {
        const routedMiddleware: KoaMiddleware = pathStack[j]
        pathStack[j] = this._patchLayer(routedMiddleware, true, path)
      }
    }

    return dispatchLayer
  }

  /**
   * Patches each individual @param middlewareLayer function in order to create the
   * span and propagate context. It does not create spans when there is no parent span.
   * @param {KoaMiddleware} middlewareLayer - the original middleware function.
   * @param {boolean} isRouter - tracks whether the original middleware function
   * was dispatched by the router originally
   * @param {string?} layerPath - if present, provides additional data from the
   * router about the routed path which the middleware is attached to
   */
  private _patchLayer(
    middlewareLayer: KoaMiddleware,
    isRouter: boolean,
    layerPath?: string
  ): KoaMiddleware {
    if (middlewareLayer[kLayerPatched] === true) return middlewareLayer
    middlewareLayer[kLayerPatched] = true
    api.diag.debug('patching Koa middleware layer')

    const metadata = getMiddlewareMetadata(
      null,
      middlewareLayer,
      isRouter,
      layerPath
    )

    if (
      isLayerIgnored(
        metadata.name,
        metadata.attributes[AttributeNames.KOA_TYPE] as KoaLayerType,
        this._config
      )
    ) {
      api.diag.debug(`ignore Koa middleware layer ${metadata.name}`)
      return middlewareLayer
    }

    return async (context: KoaContext, next: koa.Next) => {
      const parent = api.getSpan(api.context.active())
      if (parent === undefined) {
        return middlewareLayer(context, next)
      }

      const metadata = getMiddlewareMetadata(
        context,
        middlewareLayer,
        isRouter,
        layerPath
      )

      const span = this.tracer.startSpan(metadata.name, {
        attributes: metadata.attributes,
      })

      if (!context.request.ctx.parentSpan) {
        context.request.ctx.parentSpan = parent
      }

      if (
        metadata.attributes[AttributeNames.KOA_TYPE] === KoaLayerType.ROUTER
      ) {
        if (context.request.ctx.parentSpan.name) {
          const parentRoute = context.request.ctx.parentSpan.name.split(' ')[1]
          if (
            context._matchedRoute &&
            !context._matchedRoute.toString().includes(parentRoute)
          ) {
            context.request.ctx.parentSpan.updateName(
              `${context.method} ${context._matchedRoute}`
            )

            delete context.request.ctx.parentSpan
          }
        }
      }

      return api.context.with(
        api.setSpan(api.context.active(), span),
        async () => {
          try {
            return await middlewareLayer(context, next)
          } catch (err) {
            span.recordException(err)
            throw err
          } finally {
            span.end()
          }
        }
      )
    }
  }
}
