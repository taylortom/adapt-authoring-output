const { DataStoreQuery, Module, Responder } = require('adapt-authoring-core');
const lib = require('./lib');
const schema = require('../schema/coursebuild.schema');
/**
* @extends {Module}
*/
class Output extends Module {
  /** @override */
  preload(app, resolve, reject) {
    ['build', 'preview', 'download'].forEach(r => {
      this.setUpRoute(r, {
        route: '/:course?',
        handlers: { post: this.genericRouteHandler(r) },
        scopes: { post: [`${r}:courses`] }
      });
    }, this);

    this.setUpBuildsRoute();

    resolve();
  }
  setUpBuildsRoute() {
    this.app.getModule('mongodb').on('boot', db => {
      db.addModel({ name: schema.name, schema: schema.definition });
    });
    this.setUpRoute('builds', {
      route: '/',
      handlers: { get: this.listBuildsHandler() },
      scopes: { get: ['read:builds'] }
    });
  }
  /**
  * Adds a child router with a single getter to the api router
  * @param {String} route String to be used as the API endpoint
  */
  setUpRoute(route, config) {
    const r = this.app.getModule('server').api.createChildRouter(route);

    r.addMiddleware(this.outputMiddleware);
    r.addRoute({ route: config.route, handlers: config.handlers });

    Object.entries(config.scopes).forEach(([method,scopes]) => {
      this.app.auth.secureRoute(`${r.path}${config.route}`, method, scopes);
    });

    return r;
  }
  /**
  * Generic handler for output routes
  * @param {String} route The route endpoint
  */
  genericRouteHandler(route) {
    return (req, res, next) => {
      if(!(typeof lib[route] === 'function')) {
        return this.log('warn', this.app.lang.t('error.unsupportedfunc', { route }));
      }
      const r = new Responder(res);

      lib[route]({ course: req.params.course })
        .then(d => r.success(d))
        .catch(e => r.error(e));
    };
  }

  listBuildsHandler() {
    return (req, res, next) => {
      req.type = schema.name;
      try {
        DataStoreQuery.fromRequest(req);
      } catch(e) {
        next(e);
      }
      const r = new Responder(res);
      lib.listBuilds(req.dsquery).then(d => r.success(d)).catch(e => r.error(e));
    }
  }
}

module.exports = Output;
