const { Module, Responder } = require('adapt-authoring-core');
const lib = require('./lib');
const schema = require('../schema/coursebuild.schema');
/**
* @extends {Module}
*/
class Output extends Module {
  /** @override */
  preload(app, resolve, reject) {
    ['build', 'preview', 'download'].forEach(this.setUpRoute, this);

    this.app.getModule('mongodb').on('boot', db => {
      db.addModel({ name: schema.name, schema: schema.definition });
    });

    this.app.getModule('server').api.createChildRouter('builds').addMiddleware((req, res, next) => {
      if(req.dsquery && !req.dsquery.type) {
        req.dsquery.type = schema.name;
      }
      next();
    }).addRoute({
      route: '/',
      handlers: { get: this.listBuildsHandler() }
    });

    resolve();
  }
  /**
  * Adds a child router with a single getter to the api router
  * @param {String} route String to be used as the API endpoint
  */
  setUpRoute(route) {
    this.app.getModule('server').api.createChildRouter(route).addRoute({
      route: '/:_id?',
      handlers: { post: this.genericRouteHandler(route) }
    });
  }
  /**
  * Generic handler for output routes
  * @param {String} route The route endpoint
  */
  genericRouteHandler(route) {
    return (req, res, next) => {
      if(!lib[route] === 'function') {
        return this.log('warn', `output module doesn't support '${route}' function`);
      }
      const r = new Responder(res);
      lib[route](req.body).then(d => r.success(d)).catch(e => r.error(e));
    };
  }

  listBuildsHandler() {
    return (req, res, next) => {
      req.dsquery.type = schema.name;
      const r = new Responder(res);
      lib.listBuilds(req.dsquery).then(d => r.success(d)).catch(e => r.error(e));
    }
  }
}

module.exports = Output;
